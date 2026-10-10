"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Plus,
  ShoppingCart,
  Check,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import type { Product } from "@/types/firestore/productType";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItemType";
import { addProductToShoppingList } from "@/lib/firestore/shoppingList";
import { getFoodIcon } from "@/lib/utils/foodIcons";

interface AddToShoppingListDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
  pantryProducts: Product[];
  currentShoppingList: ShoppingListItemType[];
  pantryId: string;
  onProductAdded: () => void;
  onCreateNewProduct: (searchQuery?: string) => void;
}

export function AddToShoppingListDesktopModal({
  isOpen,
  onClose,
  pantryProducts,
  currentShoppingList,
  pantryId,
  onProductAdded,
  onCreateNewProduct,
}: AddToShoppingListDesktopModalProps) {
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Set di ID prodotti già presenti nella lista della spesa
  const existingInShoppingSet = useMemo(() => {
    return new Set(currentShoppingList.map((item) => item.listItemProductId));
  }, [currentShoppingList]);

  // Filtra prodotti dispensa per query
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pantryProducts;
    return pantryProducts.filter(
      (p) =>
        p.productName.toLowerCase().includes(q) ||
        (p.productCategory && p.productCategory.toLowerCase().includes(q))
    );
  }, [pantryProducts, query]);

  if (!isOpen) return null;

  const handleAddExisting = async (product: Product) => {
    if (!product.productId || addingId || existingInShoppingSet.has(product.productId) || addedIds.has(product.productId)) {
      return;
    }

    setAddingId(product.productId);
    try {
      await addProductToShoppingList(product);
      setAddedIds((prev) => new Set([...prev, product.productId!]));
      onProductAdded();
    } catch (err) {
      console.error("Errore aggiunta prodotto a lista spesa:", err);
      alert("Si è verificato un errore durante l'aggiunta alla spesa.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Aggiungi alla Lista Spesa
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Scegli tra gli alimenti della dispensa o creane uno nuovo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra di Ricerca & Tasto Rapido Nuovo Prodotto */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca prodotto in dispensa..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-2xs"
            />
          </div>

          {/* Opzione ibrida: Crea nuovo alimento non presente */}
          <button
            type="button"
            onClick={() => {
              onCreateNewProduct(query);
            }}
            className="w-full flex items-center justify-between p-3 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 transition-all text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <PackagePlus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {query.trim()
                    ? `Crea "${query.trim()}" come nuovo alimento`
                    : "Crea un nuovo prodotto (non presente in dispensa)"}
                </span>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Aggiunge un alimento inedito direttamente alla spesa
                </p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </button>
        </div>

        {/* Elenco Prodotti in Dispensa */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400 pb-1">
            <span>Prodotti censiti in dispensa ({filteredProducts.length})</span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Azzera ricerca
              </button>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 px-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/60">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Nessun prodotto trovato in dispensa per &quot;{query}&quot;.
              </p>
              <button
                type="button"
                onClick={() => onCreateNewProduct(query)}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crealo subito come nuovo</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const icon = product.productIcon || getFoodIcon(product.productName, product.productCategory);
              const isAlreadyInShopping = existingInShoppingSet.has(product.productId!) || addedIds.has(product.productId!);
              const isCurrentAdding = addingId === product.productId;

              return (
                <div
                  key={product.productId}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isAlreadyInShopping
                      ? "bg-zinc-50/70 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800/60 opacity-80"
                      : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg shrink-0">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {product.productName}
                        </span>
                        {product.productCategory && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                            {product.productCategory}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {product.productQuantity > 0 ? (
                          <>In dispensa: <b className="text-zinc-700 dark:text-zinc-300">{product.productQuantity} {product.productUnitOfMeasure || "pz"}</b></>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">Attualmente esaurito</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="ml-3 shrink-0">
                    {isAlreadyInShopping ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        <Check className="w-3.5 h-3.5" />
                        <span>In lista</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddExisting(product)}
                        disabled={Boolean(addingId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{isCurrentAdding ? "Aggiunta..." : "Aggiungi"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
