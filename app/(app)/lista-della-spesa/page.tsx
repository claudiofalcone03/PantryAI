"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry, addProduct } from "@/lib/firestore/products";
import { getShoppingListItemsByPantry, removeProductFromShoppingList, addProductToShoppingList } from "@/lib/firestore/shoppingList";
import { type Product } from "@/types/firestore/productType";
import { type ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItemType";
import { DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantryType";
import {
  ShoppingListTopBar,
  ProductAddPopup,
  BarcodeScannerPopup,
  ShoppingListItem,
  ShoppingListItemSkeleton,
  Skeleton,
  AddToShoppingListDesktopModal,
} from "@/components";
import { Search, Loader, CheckCircle, Plus, Camera } from "lucide-react";
import { saveCachedProducts, getCachedProducts, saveCachedShoppingItems, getCachedShoppingItems } from "@/lib/offline/indexedDb";
import { CATEGORY_FALLBACK_EMOJIS } from "@/lib/utils/foodIcons";

export default function ListaSpesaPage() {
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [pantryName, setPantryName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [listItems, setListItems] = useState<ShoppingListItemType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [isAddPopUpOpen, setAddPopUpOpen] = useState(false);
  const [isDesktopAddModalOpen, setIsDesktopAddModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedProductName, setScannedProductName] = useState("");
  const [scannedCarbonFootprint, setScannedCarbonFootprint] = useState<number | null>(null);
  const [pantryCategories, setPantryCategories] = useState<string[]>([]);

  const fetchData = React.useCallback(async () => {
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

      //Recupero nome e categorie dispensa
      const pantryDoc = await getDoc(doc(db, "pantries", pantryIdToFetch));
      if (pantryDoc.exists()) {
        const data = pantryDoc.data();
        setPantryName(data.pantryName || "Dispensa unknown");
        setPantryCategories(data.pantryCategories?.length ? data.pantryCategories : DEFAULT_PANTRY_CATEGORIES);
      }

      // Caricamento prodotti e lista spesa in parallelo con supporto offline-first
      try {
        const [fetchedProducts, fetchedListItems] = await Promise.all([
          getProductsByPantry(pantryIdToFetch),
          getShoppingListItemsByPantry(pantryIdToFetch)
        ]);

        setProducts(fetchedProducts);
        setListItems(fetchedListItems);

        await Promise.all([
          saveCachedProducts(pantryIdToFetch, fetchedProducts),
          saveCachedShoppingItems(pantryIdToFetch, fetchedListItems),
        ]);
      } catch (loadErr) {
        console.warn("[PantryAI] Errore rete caricamento spesa, recupero da cache offline IndexedDB...", loadErr);
        const [cachedProducts, cachedItems] = await Promise.all([
          getCachedProducts(pantryIdToFetch),
          getCachedShoppingItems(pantryIdToFetch),
        ]);
        if (cachedProducts && cachedProducts.length > 0) setProducts(cachedProducts);
        if (cachedItems && cachedItems.length > 0) setListItems(cachedItems);
      }
    } catch (error) {
      console.error("Errore caricamento lista della spesa:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await fetchData();
      }
    };

    init();

    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener("shopping-list-updated", handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("shopping-list-updated", handleUpdate);
    };
  }, [fetchData]);

  // Completamento Spesa
  const handleCheckout = async () => {
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const purchasedItems = listItems.filter(item => item.listItemStatus === "purchased");
      if (purchasedItems.length === 0) return;

      const promises = purchasedItems.map(async (item) => {
        const product = products.find(p => p.productId === item.listItemProductId);
        if (product) {
          await removeProductFromShoppingList(product);
        }
      });

      await Promise.all(promises);
      await fetchData();
    } catch (error) {
      console.error("Errore completamento spesa:", error);
    } finally {
      setIsCheckingOut(false);
    }
  };


  const itemsWithProduct = listItems.map(item => {
    return {
      item,
      product: products.find(p => p.productId === item.listItemProductId)
    };
  });

  // Estrazione categorie dai prodotti che sono nella lista
  const categories = React.useMemo(() => {
    const cates = itemsWithProduct
      .map(x => x.product?.productCategory)
      .filter(Boolean) as string[];
    return Array.from(new Set(cates)).sort();
  }, [itemsWithProduct]);



  // Ricerca e filtro
  const filteredItems = itemsWithProduct.filter(x => {
    const matchesSearch = x.item.listItemName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "" || x.product?.productCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Ordinamento: toBuy e reserved prima, purchased in fondo
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.item.listItemStatus === "purchased" && b.item.listItemStatus !== "purchased") return 1;
    if (a.item.listItemStatus !== "purchased" && b.item.listItemStatus === "purchased") return -1;
    return 0;
  });

  const hasPurchasedItems = listItems.some(item => item.listItemStatus === "purchased");

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="md:hidden">
          <ShoppingListTopBar pantryName="Caricamento..." />
        </div>
        <main className="flex-1 p-3 sm:p-6 w-full max-w-5xl mx-auto flex flex-col gap-4">
          <div className="hidden md:flex items-center justify-between pb-2">
            <Skeleton className="h-8 w-48 rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
          <div className="flex gap-2 overflow-x-hidden pb-1">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto pb-24 space-y-2.5">
            <ShoppingListItemSkeleton />
            <ShoppingListItemSkeleton />
            <ShoppingListItemSkeleton />
            <ShoppingListItemSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Mobile TopBar (nascosta su desktop >= md) */}
      <div className="md:hidden shrink-0">
        <ShoppingListTopBar
          pantryName={pantryName || "Caricamento..."}
          onAddProduct={() => {
            setScannedProductName("");
            setScannedCarbonFootprint(null);
            setAddPopUpOpen(true);
          }}
          onScanClick={() => setIsScannerOpen(true)}
        />
      </div>

      {/* Desktop Header coerente con /inventario - PERMANENTEMENTE ANCORATO: shrink-0 */}
      <header className="hidden md:flex items-center justify-between py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {pantryName || "Lista Spesa"}
          </h1>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            {listItems.length} da acquistare
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Tasto Spesa Completata su desktop (se ci sono articoli spuntati) */}
          {hasPurchasedItems && (
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isCheckingOut ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Completa Spesa</span>
            </button>
          )}

          {/* Tasto Primario Aggiungi alla Spesa su Desktop (Modalità Ibrida) */}
          <button
            onClick={() => setIsDesktopAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Aggiungi alla Spesa</span>
          </button>

          {/* Tasto Scansione Fotocamera */}
          <button
            onClick={() => setIsScannerOpen(true)}
            title="Scansiona codice a barre o Smart Vision"
            className="p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Blocco Ricerca & Categorie: PERMANENTEMENTE ANCORATO (shrink-0) */}
      <div className="shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 px-3 sm:px-6 pt-3 pb-3 z-10">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-3">
          {/* Checkout Button su Mobile */}
          {hasPurchasedItems && (
            <div className="md:hidden">
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white p-3 rounded-2xl font-bold shadow-xs transition-all cursor-pointer"
              >
                {isCheckingOut ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                <span>Spesa Completata ({listItems.filter(i => i.listItemStatus === "purchased").length} acquistati)</span>
              </button>
            </div>
          )}

          {/* Barra di ricerca */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 sm:py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-white dark:bg-zinc-900 placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors shadow-2xs"
              placeholder="Cerca nella lista spesa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtro Categorie con Emoji */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                onClick={() => setSelectedCategory("")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedCategory === ""
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                Tutte
              </button>
              {categories.map((cat) => {
                const emoji = CATEGORY_FALLBACK_EMOJIS[cat] || "🏷️";
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-sm leading-none">{emoji}</span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Area Lista Elementi Spesa: L'UNICA AREA CHE SCORRE */}
      <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 w-full max-w-5xl mx-auto flex flex-col gap-3.5">
        {sortedItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-500 dark:text-zinc-400">
              {(searchQuery || selectedCategory)
                ? "Nessun prodotto trovato per i filtri selezionati."
                : "La tua lista della spesa è vuota."}
            </p>
          </div>
        ) : (
          <div className="pb-24 flex flex-col gap-2.5">
            {sortedItems.map(({ item, product }) => (
              <ShoppingListItem
                key={item.listItemId}
                item={item}
                product={product}
                onItemUpdated={fetchData}
              />
            ))}
          </div>
        )}
      </main>

      <ProductAddPopup
        isOpen={isAddPopUpOpen}
        onClose={() => setAddPopUpOpen(false)}
        pantryId={currentPantryId}
        onProductAdded={fetchData}
        pantryCategories={pantryCategories}
        addToShoppingListByDefault={true}
        isShoppingListMode={true}
        initialName={scannedProductName}
        initialCarbonFootprint={scannedCarbonFootprint}
      />

      <BarcodeScannerPopup
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(name, carbonFootprint) => {
          setScannedProductName(name);
          setScannedCarbonFootprint(carbonFootprint ?? null);
          setIsScannerOpen(false);
          setAddPopUpOpen(true);
        }}
      />

      <AddToShoppingListDesktopModal
        isOpen={isDesktopAddModalOpen}
        onClose={() => setIsDesktopAddModalOpen(false)}
        pantryProducts={products}
        currentShoppingList={listItems}
        pantryId={currentPantryId}
        onProductAdded={fetchData}
        onCreateNewProduct={(initialQuery) => {
          setScannedProductName(initialQuery || "");
          setScannedCarbonFootprint(null);
          setIsDesktopAddModalOpen(false);
          setAddPopUpOpen(true);
        }}
      />
    </div>
  );
}
