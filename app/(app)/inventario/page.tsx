"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry, updateProduct } from "@/lib/firestore/products";
import { type Product } from "@/types/firestore/productType";
import { DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantryType";
import {
  InventoryTopBar,
  ProductListItem,
  ProductEditPopup,
  ProductAddPopup,
  BarcodeScannerPopup,
  ManageCategoriesPopup,
  VisionReviewSheetPopup,
  SortFilterPopup,
  ProductListItemSkeleton,
  Skeleton,
} from "@/components";
import type { SortCriteria } from "@/components/popups/SortFilterPopup";
import Link from "next/link";
import {
  Search,
  PackageOpen,
  ArrowUpDown,
  Clock,
  SlidersHorizontal,
  Snowflake,
  Plus,
  LayoutGrid,
  List,
  Bell,
  Camera,
} from "lucide-react";
import { getEffectiveExpiryDate } from "@/lib/firestore/pantries";
import type { DetectedProductItem } from "@/lib/genkit/genkit";
import { saveCachedProducts, getCachedProducts } from "@/lib/offline/indexedDb";
import { CATEGORY_FALLBACK_EMOJIS, getFoodIcon } from "@/lib/utils/foodIcons";

export default function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [pantryName, setPantryName] = useState("");
  const [pantryCategories, setPantryCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showOnlyOpened, setShowOnlyOpened] = useState(false);
  const [showOnlyExpiring, setShowOnlyExpiring] = useState(false);
  const [showOnlyFrozen, setShowOnlyFrozen] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>("none");
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("inventory_view_mode");
      if (saved === "list" || saved === "grid") {
        setViewMode(saved);
      }
    } catch {}
  }, []);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "low_stock" | "out_of_stock" | "frozen" | "expiring"
  >("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPopUpOpen, setPopUpOpen] = useState(false);
  const [isAddPopUpOpen, setAddPopUpOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);

  // Stati per scansione Smart Vision & Coda
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState<DetectedProductItem[]>([]);
  const [photoThumbnail, setPhotoThumbnail] = useState<string | null>(null);
  const [productQueue, setProductQueue] = useState<DetectedProductItem[]>([]);

  // Dati del singolo prodotto scansionato
  const [scannedProductName, setScannedProductName] = useState("");
  const [scannedCategory, setScannedCategory] = useState("");
  const [scannedExpiryDate, setScannedExpiryDate] = useState("");
  const [scannedShelfLifeDays, setScannedShelfLifeDays] = useState<number | null>(null);
  const [scannedCarbonFootprint, setScannedCarbonFootprint] = useState<number | null>(null);

  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [nowTimestamp, setNowTimestamp] = useState<number>(0);

  const fetchInventoryData = React.useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data();
      const pantryIdToFetch = userData?.userProfileCurrentPantryId;

      if (!pantryIdToFetch) {
        setLoading(false);
        return;
      }

      setCurrentPantryId(pantryIdToFetch);

      // Recupero nome dispensa e categorie
      const pantryDoc = await getDoc(doc(db, "pantries", pantryIdToFetch));
      if (pantryDoc.exists()) {
        const data = pantryDoc.data();
        setPantryName(data.pantryName || "Dispensa");
        setPantryCategories(
          data.pantryCategories && data.pantryCategories.length > 0
            ? data.pantryCategories
            : DEFAULT_PANTRY_CATEGORIES
        );
      }

      // Caricamento prodotti (con supporto offline-first IndexedDB)
      try {
        const fetchProducts = await getProductsByPantry(pantryIdToFetch);
        setProducts(fetchProducts);
        setNowTimestamp(Date.now());
        // Salva in cache IndexedDB per l'uso offline
        await saveCachedProducts(pantryIdToFetch, fetchProducts);

        // Auto-assegnazione intelligente delle icone in background per prodotti sprovvisti
        const hasMissingIcons = fetchProducts.some((p) => !p.productIcon || p.productIcon.trim() === "");
        if (hasMissingIcons && typeof navigator !== "undefined" && navigator.onLine) {
          import("@/lib/firestore/products").then(({ autoAssignIconsToPantryProducts }) => {
            autoAssignIconsToPantryProducts(pantryIdToFetch)
              .then((updatedCount) => {
                if (updatedCount > 0) {
                  getProductsByPantry(pantryIdToFetch).then((updated) => setProducts(updated));
                }
              })
              .catch((e) => console.warn("Auto-assegnazione icone background:", e));
          });
        }
      } catch (prodErr) {
        console.warn("[PantryAI] Errore rete caricamento prodotti, tentativo da cache offline IndexedDB...", prodErr);
        const cached = await getCachedProducts(pantryIdToFetch);
        if (cached && cached.length > 0) {
          setProducts(cached);
          setNowTimestamp(Date.now());
        }
      }
    } catch (error) {
      console.error("Errore caricamento inventario:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await fetchInventoryData();
      }
    };

    init();

    const handleUpdate = () => {
      fetchInventoryData();
    };
    window.addEventListener("inventory-updated", handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("inventory-updated", handleUpdate);
    };
  }, [fetchInventoryData]);

  // Apertura popup modifica prodotto
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setPopUpOpen(true);
  };

  // Conteggio prodotti per categoria
  const categoryCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      if (p.productCategory) {
        map[p.productCategory] = (map[p.productCategory] || 0) + 1;
      }
    });
    return map;
  }, [products]);

  // Conteggio prodotti in scadenza (<= 3 giorni o già scaduti)
  const expiringCount = React.useMemo(() => {
    if (nowTimestamp === 0) return 0;
    return products.filter((p) => {
      const eff = getEffectiveExpiryDate(p);
      if (!eff) return false;
      const diffDays = (eff.getTime() - nowTimestamp) / (1000 * 60 * 60 * 24);
      return diffDays <= 3;
    }).length;
  }, [products, nowTimestamp]);

  // Conteggio prodotti congelati nel freezer
  const frozenCount = React.useMemo(() => {
    return products.filter((p) => Boolean(p.isFrozen)).length;
  }, [products]);

  // Conteggi aggregati per filtri di stato
  const statusCounts = React.useMemo(() => {
    let available = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let frozen = 0;
    let expiring = 0;

    products.forEach((p) => {
      const qty = p.productQuantity || 0;
      if (qty > 0) available++;
      if (qty > 0 && qty <= 2) lowStock++;
      if (qty <= 0) outOfStock++;
      if (p.isFrozen) frozen++;

      if (nowTimestamp !== 0) {
        const eff = getEffectiveExpiryDate(p);
        if (eff) {
          const diffDays = (eff.getTime() - nowTimestamp) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3) expiring++;
        }
      }
    });

    return { available, lowStock, outOfStock, frozen, expiring };
  }, [products, nowTimestamp]);

  // Ricerca e filtri avanzati
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "" || p.productCategory === selectedCategory;
    const matchesOpened = showOnlyOpened ? !!p.productOpenedAt : true;
    const matchesFrozen = showOnlyFrozen ? Boolean(p.isFrozen) : true;

    const matchesExpiring = showOnlyExpiring
      ? (() => {
          if (nowTimestamp === 0) return true;
          const eff = getEffectiveExpiryDate(p);
          if (!eff) return false;
          const diffDays = (eff.getTime() - nowTimestamp) / (1000 * 60 * 60 * 24);
          return diffDays <= 3;
        })()
      : true;

    const matchesStatus = (() => {
      if (statusFilter === "all") return true;
      const qty = p.productQuantity || 0;
      if (statusFilter === "available") return qty > 0;
      if (statusFilter === "low_stock") return qty > 0 && qty <= 2;
      if (statusFilter === "out_of_stock") return qty <= 0;
      if (statusFilter === "frozen") return Boolean(p.isFrozen);
      if (statusFilter === "expiring") {
        if (nowTimestamp === 0) return false;
        const eff = getEffectiveExpiryDate(p);
        if (!eff) return false;
        const diffDays = (eff.getTime() - nowTimestamp) / (1000 * 60 * 60 * 24);
        return diffDays <= 3;
      }
      return true;
    })();

    return (
      matchesSearch &&
      matchesCategory &&
      matchesOpened &&
      matchesExpiring &&
      matchesFrozen &&
      matchesStatus
    );
  });

  // Ordinamento avanzato (alfabetico, scadenza, quantità, recenti)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortCriteria === "none") return 0;

    if (sortCriteria === "az") {
      return (a.productName || "").localeCompare(b.productName || "", "it", { sensitivity: "base" });
    }

    if (sortCriteria === "za") {
      return (b.productName || "").localeCompare(a.productName || "", "it", { sensitivity: "base" });
    }

    if (sortCriteria === "expiry_asc" || sortCriteria === "expiry_desc") {
      const getExpiry = (product: Product) => {
        const expiry = getEffectiveExpiryDate(product);
        return expiry ? expiry.getTime() : Infinity;
      };
      const timeA = getExpiry(a);
      const timeB = getExpiry(b);
      return sortCriteria === "expiry_asc" ? timeA - timeB : timeB - timeA;
    }

    if (sortCriteria === "qty_desc") {
      return (b.productQuantity || 0) - (a.productQuantity || 0);
    }

    if (sortCriteria === "qty_asc") {
      return (a.productQuantity || 0) - (b.productQuantity || 0);
    }

    if (sortCriteria === "newest") {
      const getCreated = (product: Product) => {
        const raw = product.productCreatedAt as unknown;
        if (raw && typeof raw === "object" && "toMillis" in raw && typeof (raw as { toMillis?: () => number }).toMillis === "function") {
          return (raw as { toMillis: () => number }).toMillis();
        }
        return 0;
      };
      return getCreated(b) - getCreated(a);
    }

    return 0;
  });

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="md:hidden">
          <InventoryTopBar pantryName="Caricamento..." />
        </div>
        <main className="flex-1 p-3 sm:p-6 w-full max-w-6xl mx-auto flex flex-col gap-4">
          <div className="hidden md:flex items-center justify-between pb-2">
            <Skeleton className="h-8 w-48 rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <div className="flex items-center gap-2 md:hidden">
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
              <Skeleton className="h-11 w-[46px] rounded-2xl shrink-0" />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-hidden pb-1">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="flex gap-2 overflow-x-hidden pb-1">
            <Skeleton className="h-7 w-16 rounded-xl" />
            <Skeleton className="h-7 w-24 rounded-xl" />
            <Skeleton className="h-7 w-28 rounded-xl" />
          </div>
          <div className="flex flex-col gap-2.5 max-w-4xl mx-auto w-full pb-24">
            <ProductListItemSkeleton />
            <ProductListItemSkeleton />
            <ProductListItemSkeleton />
            <ProductListItemSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile TopBar (nascosta su desktop >= md) */}
      <div className="md:hidden shrink-0">
        <InventoryTopBar
          pantryName={pantryName || "Nessuna dispensa selezionata"}
          onAddProduct={() => {
            setScannedProductName("");
            setScannedCategory("");
            setScannedExpiryDate("");
            setScannedShelfLifeDays(null);
            setScannedCarbonFootprint(null);
            setProductQueue([]);
            setAddPopUpOpen(true);
          }}
          onScanClick={() => setIsScannerOpen(true)}
        />
      </div>

      {/* Desktop Header: Titolo dispensa + cluster di azioni in stile PantryFlow - PERMANENTEMENTE ANCORATO: shrink-0 */}
      <header className="hidden md:flex items-center justify-between py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {pantryName || "Dispensa"}
          </h1>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            {products.length} articoli
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Tasto Primario Aggiungi Prodotto (Verde Smeraldo PantryFlow) */}
          <button
            onClick={() => {
              setScannedProductName("");
              setScannedCategory("");
              setScannedExpiryDate("");
              setScannedShelfLifeDays(null);
              setScannedCarbonFootprint(null);
              setProductQueue([]);
              setAddPopUpOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Aggiungi Articolo</span>
          </button>

          {/* Scansione Fotocamera / Barcode / Vision */}
          <button
            onClick={() => setIsScannerOpen(true)}
            title="Scansiona codice a barre o Smart Vision"
            className="p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Camera className="w-5 h-5" />
          </button>

          {/* Tasto Ordina / Filtra */}
          <button
            onClick={() => setIsSortFilterOpen(true)}
            title="Ordina e filtra inventario"
            className={`p-2 rounded-xl border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer ${
              sortCriteria !== "none"
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 font-semibold"
                : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <ArrowUpDown className="w-5 h-5" />
            {sortCriteria !== "none" && (
              <span className="text-xs font-semibold">
                {sortCriteria === "az"
                  ? "A-Z"
                  : sortCriteria === "za"
                  ? "Z-A"
                  : sortCriteria === "expiry_asc"
                  ? "Scadenza ↑"
                  : sortCriteria === "expiry_desc"
                  ? "Scadenza ↓"
                  : sortCriteria === "qty_desc"
                  ? "Qtà ↓"
                  : sortCriteria === "qty_asc"
                  ? "Qtà ↑"
                  : "Recenti"}
              </span>
            )}
          </button>

          {/* Toggle Modalità Vista (Lista vs Griglia) */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              onClick={() => {
                setViewMode("list");
                try {
                  localStorage.setItem("inventory_view_mode", "list");
                } catch {}
              }}
              title="Vista Lista"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setViewMode("grid");
                try {
                  localStorage.setItem("inventory_view_mode", "grid");
                } catch {}
              }}
              title="Vista Griglia"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-bold"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Campanella Notifiche Scadenze */}
          <button
            onClick={() => {
              setStatusFilter((prev) => (prev === "expiring" ? "all" : "expiring"));
            }}
            title={
              statusFilter === "expiring"
                ? "Mostra tutti i prodotti"
                : expiringCount > 0
                ? `${expiringCount} prodotti in scadenza`
                : "Nessun prodotto in scadenza"
            }
            className={`relative p-2 rounded-xl border transition-colors shadow-2xs cursor-pointer ${
              statusFilter === "expiring"
                ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
                : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            <Bell className="w-5 h-5" />
            {expiringCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-xs">
                {expiringCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Blocco Ricerca & Filtri: PERMANENTEMENTE ANCORATO sotto l'header (shrink-0) */}
      <div className="shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 px-3 sm:px-6 pt-3 pb-3 z-10">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-3">
          {/* Barra di ricerca con filtri rapidi su mobile */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-white dark:bg-zinc-900 placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors shadow-2xs"
              placeholder="Cerca prodotti per nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtri rapidi visibili SOLO su mobile */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={() => setShowOnlyExpiring(!showOnlyExpiring)}
              title={showOnlyExpiring ? "Mostra tutti i prodotti" : "Filtra prodotti in scadenza"}
              className={`relative p-2.5 rounded-2xl border transition-colors shrink-0 ${
                showOnlyExpiring
                  ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
              }`}
            >
              <Clock className="w-5 h-5" />
              {expiringCount > 0 && !showOnlyExpiring && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow">
                  {expiringCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowOnlyOpened(!showOnlyOpened)}
              title={showOnlyOpened ? "Mostra tutti" : "Mostra solo aperti"}
              className={`p-2.5 rounded-2xl border transition-colors shrink-0 ${
                showOnlyOpened
                  ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
              }`}
            >
              <PackageOpen className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowOnlyFrozen(!showOnlyFrozen)}
              title={showOnlyFrozen ? "Mostra tutti i prodotti" : "Filtra prodotti congelati nel freezer"}
              className={`relative p-2.5 rounded-2xl border transition-colors shrink-0 ${
                showOnlyFrozen
                  ? "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-950/60 dark:border-cyan-800 dark:text-cyan-300"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-cyan-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
              }`}
            >
              <Snowflake className="w-5 h-5" />
              {frozenCount > 0 && !showOnlyFrozen && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white shadow">
                  {frozenCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsSortFilterOpen(true)}
              title="Ordina e filtra inventario"
              className={`p-2.5 rounded-2xl border transition-colors flex items-center justify-center shrink-0 ${
                sortCriteria !== "none"
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 font-semibold"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
              }`}
            >
              <ArrowUpDown className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Riga 1: Chip Categorie con Icone Emoji e contatori */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 shrink-0 cursor-pointer ${
              selectedCategory === ""
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <span>Tutti</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === ""
                  ? "bg-emerald-700/60 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              }`}
            >
              {products.length}
            </span>
          </button>

          {pantryCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            const emoji = CATEGORY_FALLBACK_EMOJIS[cat] || "🏷️";
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? "" : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="text-sm leading-none">{emoji}</span>
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-emerald-700/60 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsManageCategoriesOpen(true)}
            title="Gestisci categorie personalizzate"
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-emerald-600 hover:border-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Modifica</span>
          </button>
        </div>

        {/* Riga 2: Chip Stato / Disponibilità (In Stock, Low Stock, etc.) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 text-xs">
          {[
            { id: "all", label: "Tutti", count: products.length },
            { id: "available", label: "Disponibili", count: statusCounts.available },
            { id: "low_stock", label: "In esaurimento", count: statusCounts.lowStock },
            { id: "out_of_stock", label: "Terminati", count: statusCounts.outOfStock },
            { id: "frozen", label: "Congelati", count: statusCounts.frozen },
            { id: "expiring", label: "In scadenza", count: statusCounts.expiring },
          ].map((item) => {
            const isSelected = statusFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id as typeof statusFilter)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors border flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 font-semibold shadow-2xs"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{item.label}</span>
                {item.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800 font-bold"
                        : item.id === "expiring" && item.count > 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-semibold"
                        : item.id === "low_stock" && item.count > 0
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 font-semibold"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Area Lista Prodotti: L'UNICA AREA CHE SCORRE */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 w-full max-w-6xl mx-auto flex flex-col">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-xl mx-auto shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-2xl">
                🥫
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                Nessun prodotto trovato
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">
                {searchQuery || selectedCategory || statusFilter !== "all" || showOnlyOpened || showOnlyExpiring || showOnlyFrozen
                  ? "Prova a modificare i filtri o la ricerca per visualizzare altri alimenti."
                  : "La tua dispensa è vuota. Aggiungi il tuo primo articolo con il pulsante verde!"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="flex flex-col gap-2.5 max-w-4xl mx-auto w-full pb-24">
              {sortedProducts.map((product) => (
                <ProductListItem
                  key={product.productId}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  onProductUpdated={fetchInventoryData}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5 pb-24">
              {sortedProducts.map((product) => (
                <ProductListItem
                  key={product.productId}
                  product={product}
                  onClick={() => handleProductClick(product)}
                  onProductUpdated={fetchInventoryData}
                />
              ))}
            </div>
          )}
      </main>

      {/* Popup Modifica Prodotto */}
      <ProductEditPopup
        isOpen={isPopUpOpen}
        onClose={() => setPopUpOpen(false)}
        product={selectedProduct}
        onProductUpdated={fetchInventoryData}
        pantryCategories={pantryCategories}
      />

      {/* Popup Aggiunta Prodotto (Singolo o in Coda Sequenziale) */}
      <ProductAddPopup
        isOpen={isAddPopUpOpen}
        onClose={() => {
          setAddPopUpOpen(false);
          setProductQueue([]);
        }}
        pantryId={currentPantryId}
        onProductAdded={fetchInventoryData}
        pantryCategories={pantryCategories}
        initialName={scannedProductName}
        initialCategory={scannedCategory}
        initialExpiryDate={scannedExpiryDate}
        initialShelfLifeDays={scannedShelfLifeDays}
        initialCarbonFootprint={scannedCarbonFootprint}
        productQueue={productQueue}
        onQueueFinished={() => {
          setAddPopUpOpen(false);
          setProductQueue([]);
          fetchInventoryData();
        }}
      />

      {/* Popup Scanner / Fotocamera Dual-Mode con supporto Smart Vision */}
      <BarcodeScannerPopup
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        pantryCategories={pantryCategories}
        onScanSuccess={(name, carbonFootprint, category, expiryDate, shelfLifeDays) => {
          setScannedProductName(name);
          setScannedCarbonFootprint(carbonFootprint ?? null);
          setScannedCategory(category || "");
          setScannedExpiryDate(expiryDate || "");
          setScannedShelfLifeDays(shelfLifeDays ?? null);
          setProductQueue([]);
          setIsScannerOpen(false);
          setAddPopUpOpen(true);
        }}
        onMultipleProductsDetected={(products, photoDataUrl) => {
          setDetectedProducts(products);
          setPhotoThumbnail(photoDataUrl);
          setIsScannerOpen(false);
          setIsReviewSheetOpen(true);
        }}
      />

      {/* Review Sheet Selezione Alimenti Smart Vision */}
      <VisionReviewSheetPopup
        isOpen={isReviewSheetOpen}
        onClose={() => {
          setIsReviewSheetOpen(false);
          setDetectedProducts([]);
          setPhotoThumbnail(null);
        }}
        detectedProducts={detectedProducts}
        photoThumbnail={photoThumbnail}
        onConfirmSelection={(selectedProducts) => {
          setIsReviewSheetOpen(false);
          if (selectedProducts.length === 1) {
            const single = selectedProducts[0];
            setScannedProductName(single.name);
            setScannedCategory(single.category);
            setScannedCarbonFootprint(null);
            setScannedExpiryDate(single.expiryDate || "");
            setScannedShelfLifeDays(single.shelfLifeDays ?? null);
            setProductQueue([]);
            setAddPopUpOpen(true);
          } else {
            setProductQueue(selectedProducts);
            setAddPopUpOpen(true);
          }
        }}
      />

      {/* Modale Gestione Categorie */}
      <ManageCategoriesPopup
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        pantryId={currentPantryId}
        currentCategories={pantryCategories}
        onCategoriesUpdated={(newCats) => {
          setPantryCategories(newCats);
        }}
      />

      {/* Modale Ordina e Filtra Avanzato */}
      <SortFilterPopup
        isOpen={isSortFilterOpen}
        onClose={() => setIsSortFilterOpen(false)}
        currentSort={sortCriteria}
        onSelectSort={(sort) => setSortCriteria(sort)}
        showOnlyExpiring={showOnlyExpiring}
        onToggleExpiring={() => setShowOnlyExpiring(!showOnlyExpiring)}
        showOnlyOpened={showOnlyOpened}
        onToggleOpened={() => setShowOnlyOpened(!showOnlyOpened)}
        showOnlyFrozen={showOnlyFrozen}
        onToggleFrozen={() => setShowOnlyFrozen(!showOnlyFrozen)}
      />
    </div>
  );
}
