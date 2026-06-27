/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry } from "@/lib/firestore/products";
import { getShoppingListItemsByPantry, removeProductFromShoppingList } from "@/lib/firestore/shoppingList";
import { type Product } from "@/types/firestore/product";
import { type ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItem";
import { ShoppingListTopBar } from "@/components/ShoppingListTopBar";
import { ProductAddPopup } from "@/components/ProductAddPopup";
import { ShoppingListItem } from "@/components/ShoppingListItem";
import { Search, Loader, CheckCircle } from "lucide-react";
import { InventoryTopBar } from "@/components/InventoryTopBar";

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

      //Recupero nome dispensa
      const pantryDoc = await getDoc(doc(db, "pantries", pantryIdToFetch));
      if (pantryDoc.exists()) {
        const data = pantryDoc.data();
        setPantryName(data.pantryName || "Dispensa unknown");
      }

      // Caricamento prodotti e lista spesa in parallelo
      const [fetchedProducts, fetchedListItems] = await Promise.all([
        getProductsByPantry(pantryIdToFetch),
        getShoppingListItemsByPantry(pantryIdToFetch)
      ]);

      setProducts(fetchedProducts);
      setListItems(fetchedListItems);

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

    return () => {
      mounted = false;
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
      <ShoppingListTopBar
        pantryName={pantryName || "Caricamento..."}
        onAddProduct={() => setAddPopUpOpen(true)}
      />

      <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-4">

        {/* Checkout Button */}
        {hasPurchasedItems && (
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white p-3 rounded-2xl font-bold shadow-sm transition-colors"
          >
            {isCheckingOut ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Spesa Completata
          </button>
        )}

        {/* Barra di ricerca */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-white dark:bg-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors shadow-sm text-zinc-900 dark:text-zinc-100"
              placeholder="Cerca nella lista spesa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
              Tutte
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

        {/* Lista elementi */}
        <div className="flex-1 overflow-y-auto">
          {sortedItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-zinc-500 dark:text-zinc-400">
                {(searchQuery || selectedCategory)
                  ? "Nessun prodotto trovato per i filtri selezionati."
                  : "La tua lista della spesa è vuota."}
              </p>
            </div>
          ) : (
            <div className="pb-24">
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
        </div>
      </main>

      <ProductAddPopup
        isOpen={isAddPopUpOpen}
        onClose={() => setAddPopUpOpen(false)}
        pantryId={currentPantryId}
        onProductAdded={fetchData}
        pantryCategories={categories}
        addToShoppingListByDefault={true}
      />
    </div>
  );
}
