/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry } from "@/lib/firestore/products";
import { type Product } from "@/types/firestore/product";
import { DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantry";
import { InventoryTopBar } from "@/components/InventoryTopBar";
import { ProductListItem } from "@/components/ProductListItem";
import { ProductEditPopup } from "@/components/ProductEditPopup";
import { ProductAddPopup } from "@/components/ProductAddPopup";
import { Search, Loader, PackageOpen, ArrowDownUp, ArrowDown, ArrowUp } from "lucide-react";

export default function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [pantryName, setPantryName] = useState("");
  const [pantryCategories, setPantryCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showOnlyOpened, setShowOnlyOpened] = useState(false);
  const [sortOrder, setSortOrder] = useState<"ascendente" | "discendente" | "none">("none");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPopUpOpen, setPopUpOpen] = useState(false);
  const [isAddPopUpOpen, setAddPopUpOpen] = useState(false);
  const [currentPantryId, setCurrentPantryId] = useState<string>("");

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

      //Recupero nome dispensa e categorie
      const pantryDoc = await getDoc(doc(db, "pantries", pantryIdToFetch));
      if (pantryDoc.exists()) {
        const data = pantryDoc.data();
        setPantryName(data.pantryName || "Dispensa unknown");
        setPantryCategories(data.pantryCategories?.length > 0 ? data.pantryCategories : DEFAULT_PANTRY_CATEGORIES);
      }

      // Caricamento prodotti
      const fetchProducts = await getProductsByPantry(pantryIdToFetch);
      setProducts(fetchProducts);

    } catch (error) {
      console.error("Errore caricamento inventario:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true; //Per capire se il componente è montato nel DOM

    const init = async () => {
      if (mounted) {
        await fetchInventoryData();
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchInventoryData]);

  //Apertura popup modifica prodotto
  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setPopUpOpen(true);
  };

  // Estrazione categorie
  const categories = React.useMemo(() => {
    const cates = products.map(p => p.productCategory).filter(Boolean) as string[];
    return Array.from(new Set(cates)).sort();
  }, [products]);

  //Ricerca e filtro prodotti
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "" || p.productCategory === selectedCategory;
    const matchesOpened = showOnlyOpened ? !!p.productOpenedAt : true;
    return matchesSearch && matchesCategory && matchesOpened;
  });

  //Ordinamento per data
  //Verifica sia la scadenza standard che quella calcolata in base all'apertura del prodotto
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOrder === "none") return 0;

    const getExpiry = (product: Product) => {
      let expiry: Date | null = null;
      if (product.productOpenedExpiryAt) {
        expiry = typeof (product.productOpenedExpiryAt as any).toDate === 'function'
          ? (product.productOpenedExpiryAt as any).toDate()
          : new Date(product.productOpenedExpiryAt as any);
      } else if (product.expiryDateProduct) {
        expiry = typeof (product.expiryDateProduct as any).toDate === 'function'
          ? (product.expiryDateProduct as any).toDate()
          : new Date(product.expiryDateProduct as any);
      }
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
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <InventoryTopBar pantryName="Caricamento..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <InventoryTopBar 
        pantryName={pantryName || "Nessuna dispensa selezionata"} 
        onAddProduct={() => setAddPopUpOpen(true)}
      />

      <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-4">
        {/* Barra di ricerca e filtri */}
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

          <button
            onClick={() => setShowOnlyOpened(!showOnlyOpened)}
            title={showOnlyOpened ? "Mostra tutti" : "Mostra solo aperti"}
            className={`p-3 rounded-2xl border transition-colors shrink-0 ${showOnlyOpened
              ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
              : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
          >
            <PackageOpen className="w-5 h-5" />
          </button>

          <button
            onClick={() => setSortOrder(prev => prev === "none" ? "ascendente" : prev === "ascendente" ? "discendente" : "none")}
            title={sortOrder === "none" ? "Ordina per scadenza" : sortOrder === "ascendente" ? "Scadenza: più vicina" : "Scadenza: più lontana"}
            className={`p-3 rounded-2xl border transition-colors flex items-center justify-center shrink-0 min-w-[46px] ${sortOrder !== "none"
              ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
              : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
          >
            {sortOrder === "none" && <ArrowDownUp className="w-5 h-5" />}
            {sortOrder === "ascendente" && <ArrowUp className="w-5 h-5" />}
            {sortOrder === "discendente" && <ArrowDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Filtro Categorie */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${selectedCategory === ""
                ? "bg-green-600 text-white border-green-600 dark:bg-green-600"
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
            >
              Tutti
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${selectedCategory === cat
                  ? "bg-green-600 text-white border-green-600 dark:bg-green-600"
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Lista prodotti */}
        <div className="flex-1 overflow-y-auto">
          {sortedProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-zinc-500 dark:text-zinc-400">
                {(searchQuery || selectedCategory || showOnlyOpened) ? "Nessun prodotto trovato per i filtri selezionati." : "La tua dispensa è vuota. Aggiungi un prodotto!"}
              </p>
            </div>
          ) : (
            <div className="pb-24">
              {sortedProducts.map(product => (
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

      <ProductEditPopup
        isOpen={isPopUpOpen}
        onClose={() => setPopUpOpen(false)}
        product={selectedProduct}
        onProductUpdated={fetchInventoryData}
        pantryCategories={pantryCategories}
      />

      <ProductAddPopup
        isOpen={isAddPopUpOpen}
        onClose={() => setAddPopUpOpen(false)}
        pantryId={currentPantryId}
        onProductAdded={fetchInventoryData}
        pantryCategories={pantryCategories}
      />
    </div>
  );
}
