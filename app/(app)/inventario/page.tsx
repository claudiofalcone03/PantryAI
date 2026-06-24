"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry } from "@/lib/firestore/products";
import type { Product } from "@/types/firestore/product";
import { InventoryTopBar } from "@/components/InventoryTopBar";
import { ProductListItem } from "@/components/ProductListItem";
import { ProductEditPopup } from "@/components/ProductEditPopup";
import { Search, Loader } from "lucide-react";

export default function InventarioPage() {
  const [loading, setLoading] = useState(true);
  const [pantryName, setPantryName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPopUpOpen, setPopUpOpen] = useState(false);

  const fetchInventoryData = React.useCallback(async () => {
    if (!auth.currentUser) return;
    
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data();
      const currentPantryId = userData?.userProfileCurrentPantryId;

      if (!currentPantryId) {
        setLoading(false);
        return;
      }

      //Recupero nome dispensa
      const pantryDoc = await getDoc(doc(db, "pantries", currentPantryId));
      if (pantryDoc.exists()) {
        setPantryName(pantryDoc.data().pantryName || "Dispensa unknown");
      }

      // Caricamento prodotti
      const fetchProducts = await getProductsByPantry(currentPantryId);
      setProducts(fetchProducts);

    } catch (error) {
      console.error("Errore caricamento inventario:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true; //Oer capire se il componente è montato nel DOM
    
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

  //Ricerca prodotti
  const filteredProducts = products.filter(p => 
    p.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <InventoryTopBar pantryName={pantryName || "Nessuna dispensa selezionata"} />

      <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-4">
        {/* Barra di ricerca */}
        <div className="relative">
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

        {/* Lista prodotti */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-zinc-500 dark:text-zinc-400">
                {searchQuery ? "Nessun prodotto trovato per la ricerca." : "La tua dispensa è vuota. Aggiungi un prodotto!"}
              </p>
            </div>
          ) : (
            <div className="pb-24">
              {filteredProducts.map(product => (
                <ProductListItem 
                  key={product.productId} 
                  product={product} 
                  onClick={() => handleProductClick(product)} 
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
      />
    </div>
  );
}
