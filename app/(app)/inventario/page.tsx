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
  ProductListItemSkeleton,
  Skeleton,
} from "@/components";
import {
  Search,
  PackageOpen,
  ArrowDownUp,
  ArrowDown,
  ArrowUp,
  Clock,
  SlidersHorizontal,
  Snowflake,
} from "lucide-react";
import { getEffectiveExpiryDate } from "@/lib/firestore/pantries";
import type { DetectedProductItem } from "@/lib/genkit/genkit";
import { saveCachedProducts, getCachedProducts } from "@/lib/offline/indexedDb";

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
  const [sortOrder, setSortOrder] = useState<"ascendente" | "discendente" | "none">("none");
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

    return matchesSearch && matchesCategory && matchesOpened && matchesExpiring && matchesFrozen;
  });

  // Ordinamento per data di scadenza
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === "none") return 0;

    const getExpiry = (product: Product) => {
      const expiry = getEffectiveExpiryDate(product);
      return expiry ? expiry.getTime() : Infinity;
    };

    const timeA = getExpiry(a);
    const timeB = getExpiry(b);

    if (sortOrder === "ascendente") return timeA - timeB;
    if (sortOrder === "discendente") return timeB - timeA;
    return 0;
  });

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <InventoryTopBar pantryName="Caricamento..." />
        <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
            <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
            <Skeleton className="h-11 w-[46px] rounded-2xl shrink-0" />
          </div>
          <div className="flex gap-2 overflow-x-hidden pb-2">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto pb-24">
            <ProductListItemSkeleton />
            <ProductListItemSkeleton />
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
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
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

      <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-4">
        {/* Barra di ricerca e filtri rapidi */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-white dark:bg-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors shadow-sm text-zinc-900 dark:text-zinc-100"
              placeholder="Cerca prodotti..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtro Rapido In Scadenza */}
          <button
            onClick={() => setShowOnlyExpiring(!showOnlyExpiring)}
            title={showOnlyExpiring ? "Mostra tutti i prodotti" : "Filtra prodotti in scadenza"}
            className={`relative p-3 rounded-2xl border transition-colors shrink-0 ${
              showOnlyExpiring
                ? "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Clock className="w-5 h-5" />
            {expiringCount > 0 && !showOnlyExpiring && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow">
                {expiringCount}
              </span>
            )}
          </button>

          {/* Filtro Rapido Aperti */}
          <button
            onClick={() => setShowOnlyOpened(!showOnlyOpened)}
            title={showOnlyOpened ? "Mostra tutti" : "Mostra solo aperti"}
            className={`p-3 rounded-2xl border transition-colors shrink-0 ${
              showOnlyOpened
                ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <PackageOpen className="w-5 h-5" />
          </button>

          {/* Filtro Rapido Freezer (Congelati) */}
          <button
            onClick={() => setShowOnlyFrozen(!showOnlyFrozen)}
            title={showOnlyFrozen ? "Mostra tutti i prodotti" : "Filtra prodotti congelati nel freezer"}
            className={`relative p-3 rounded-2xl border transition-colors shrink-0 ${
              showOnlyFrozen
                ? "bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-950/60 dark:border-cyan-800 dark:text-cyan-300"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-cyan-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-cyan-300 dark:hover:bg-zinc-800"
            }`}
          >
            <Snowflake className="w-5 h-5" />
            {frozenCount > 0 && !showOnlyFrozen && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white shadow">
                {frozenCount}
              </span>
            )}
          </button>

          {/* Ordinamento per scadenza */}
          <button
            onClick={() =>
              setSortOrder((prev) =>
                prev === "none" ? "ascendente" : prev === "ascendente" ? "discendente" : "none"
              )
            }
            title={
              sortOrder === "none"
                ? "Ordina per scadenza"
                : sortOrder === "ascendente"
                ? "Scadenza: più vicina"
                : "Scadenza: più lontana"
            }
            className={`p-3 rounded-2xl border transition-colors flex items-center justify-center shrink-0 min-w-[46px] ${
              sortOrder !== "none"
                ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {sortOrder === "none" && <ArrowDownUp className="w-5 h-5" />}
            {sortOrder === "ascendente" && <ArrowUp className="w-5 h-5" />}
            {sortOrder === "discendente" && <ArrowDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Barra Chip Categorie con contatori e tasto Gestione */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {/* Tutti */}
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 shrink-0 ${
              selectedCategory === ""
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <span>Tutti</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedCategory === ""
                  ? "bg-green-700/60 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* Chip Rapido Freezer */}
          {(frozenCount > 0 || showOnlyFrozen) && (
            <button
              onClick={() => setShowOnlyFrozen(!showOnlyFrozen)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 shrink-0 ${
                showOnlyFrozen
                  ? "bg-cyan-600 text-white border-cyan-600 shadow-sm"
                  : "bg-white text-cyan-700 border-cyan-200 hover:bg-cyan-50 dark:bg-zinc-900 dark:border-cyan-900/40 dark:text-cyan-400 dark:hover:bg-zinc-800"
              }`}
            >
              <Snowflake className="w-3.5 h-3.5" />
              <span>Freezer</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  showOnlyFrozen
                    ? "bg-cyan-700/60 text-white"
                    : "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300"
                }`}
              >
                {frozenCount}
              </span>
            </button>
          )}

          {/* Categorie Attive della Dispensa */}
          {pantryCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? "" : cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-green-600 text-white border-green-600 shadow-sm"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-green-700/60 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {/* Bottone Rapido Modifica Categorie */}
          <button
            type="button"
            onClick={() => setIsManageCategoriesOpen(true)}
            title="Gestisci categorie personalizzate"
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-green-600 hover:border-green-500 dark:text-zinc-400 dark:hover:text-green-400 transition-colors flex items-center gap-1 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Modifica</span>
          </button>
        </div>

        {/* Lista prodotti */}
        <div className="flex-1 overflow-y-auto">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                {searchQuery || selectedCategory || showOnlyOpened || showOnlyExpiring
                  ? "Nessun prodotto trovato per i filtri selezionati."
                  : "La tua dispensa è vuota. Aggiungi il tuo primo prodotto!"}
              </p>
            </div>
          ) : (
            <div className="pb-24">
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
        </div>
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
    </div>
  );
}
