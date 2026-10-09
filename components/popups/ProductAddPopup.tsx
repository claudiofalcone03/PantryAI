"use client";

import React, { useState } from "react";
import { X, Plus, Save, SkipForward, Sparkles, Snowflake } from "lucide-react";
import { addProduct } from "@/lib/firestore/products";
import { addProductToShoppingList } from "@/lib/firestore/shoppingList";
import { Timestamp } from "firebase/firestore";
import type { Product } from "@/types/firestore/productType";
import type { DetectedProductItem } from "@/lib/genkit/genkit";

interface ProductAddPopupProps {
  isOpen: boolean;
  onClose: () => void;
  pantryId: string;
  onProductAdded: () => void;
  pantryCategories?: string[];
  addToShoppingListByDefault?: boolean;
  isShoppingListMode?: boolean;
  initialName?: string;
  initialCategory?: string;
  initialQuantity?: number;
  initialExpiryDate?: string;
  initialShelfLifeDays?: number | null;
  initialCarbonFootprint?: number | null;
  // Supporto alla modalità coda Smart Vision:
  productQueue?: DetectedProductItem[];
  onQueueFinished?: () => void;
}

export function ProductAddPopup({
  isOpen,
  onClose,
  pantryId,
  onProductAdded,
  pantryCategories = [],
  addToShoppingListByDefault = false,
  isShoppingListMode = false,
  initialName = "",
  initialCategory = "",
  initialQuantity = 1,
  initialExpiryDate = "",
  initialShelfLifeDays = null,
  initialCarbonFootprint = null,
  productQueue = [],
  onQueueFinished,
}: ProductAddPopupProps) {
  if (!isOpen || !pantryId) return null;

  return (
    <ProductAddPopupContent
      pantryId={pantryId}
      onClose={onClose}
      onProductAdded={onProductAdded}
      pantryCategories={pantryCategories}
      addToShoppingListByDefault={addToShoppingListByDefault}
      isShoppingListMode={isShoppingListMode}
      initialName={initialName}
      initialCategory={initialCategory}
      initialQuantity={initialQuantity}
      initialExpiryDate={initialExpiryDate}
      initialShelfLifeDays={initialShelfLifeDays}
      initialCarbonFootprint={initialCarbonFootprint}
      productQueue={productQueue}
      onQueueFinished={onQueueFinished}
    />
  );
}

function ProductAddPopupContent({
  pantryId,
  onClose,
  onProductAdded,
  pantryCategories,
  addToShoppingListByDefault,
  isShoppingListMode,
  initialName = "",
  initialCategory = "",
  initialQuantity = 1,
  initialExpiryDate = "",
  initialShelfLifeDays = null,
  initialCarbonFootprint = null,
  productQueue = [],
  onQueueFinished,
}: {
  pantryId: string;
  onClose: () => void;
  onProductAdded: () => void;
  pantryCategories: string[];
  addToShoppingListByDefault: boolean;
  isShoppingListMode: boolean;
  initialName: string;
  initialCategory?: string;
  initialQuantity?: number;
  initialExpiryDate?: string;
  initialShelfLifeDays?: number | null;
  initialCarbonFootprint: number | null;
  productQueue?: DetectedProductItem[];
  onQueueFinished?: () => void;
}) {
  const isQueueMode = productQueue && productQueue.length > 0;
  const [queueIndex, setQueueIndex] = useState(0);

  const activeItem = isQueueMode ? productQueue[queueIndex] : null;

  const [name, setName] = useState(activeItem ? activeItem.name : initialName || "");
  const [quantity, setQuantity] = useState(activeItem ? activeItem.quantity : initialQuantity || 1);
  const [expiryDate, setExpiryDate] = useState(activeItem ? activeItem.expiryDate || "" : initialExpiryDate || "");
  const [category, setCategory] = useState(activeItem ? activeItem.category : initialCategory || "");
  const [shelfLifeDays, setShelfLifeDays] = useState<number | "">(
    activeItem && activeItem.shelfLifeDays !== null && activeItem.shelfLifeDays !== undefined
      ? activeItem.shelfLifeDays
      : initialShelfLifeDays !== null && initialShelfLifeDays !== undefined
      ? initialShelfLifeDays
      : ""
  );
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenMonths, setFrozenMonths] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  const advanceQueueOrClose = () => {
    setIsFrozen(false);
    setFrozenMonths(3);
    if (isQueueMode && queueIndex + 1 < productQueue.length) {
      const nextIdx = queueIndex + 1;
      const nextItem = productQueue[nextIdx];
      setQueueIndex(nextIdx);
      if (nextItem) {
        setName(nextItem.name);
        setCategory(nextItem.category);
        setQuantity(nextItem.quantity || 1);
        setExpiryDate(nextItem.expiryDate || "");
        setShelfLifeDays(
          nextItem.shelfLifeDays !== null && nextItem.shelfLifeDays !== undefined
            ? nextItem.shelfLifeDays
            : ""
        );
      }
    } else {
      if (onQueueFinished) {
        onQueueFinished();
      } else {
        onClose();
      }
    }
  };

  const handleSkip = () => {
    advanceQueueOrClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Inserisci il nome del prodotto");
      return;
    }

    setIsSaving(true);
    try {
      let expiryTimestamp: Timestamp | null = null;
      if (expiryDate) {
        expiryTimestamp = Timestamp.fromDate(new Date(expiryDate));
      }

      let frozenFields: Partial<Product> = {};
      if (isFrozen && !isShoppingListMode) {
        const now = new Date();
        const fExpiry = new Date(now);
        fExpiry.setMonth(fExpiry.getMonth() + frozenMonths);
        frozenFields = {
          isFrozen: true,
          productFrozenAt: Timestamp.fromDate(now),
          productFrozenExpiryAt: Timestamp.fromDate(fExpiry),
          frozenMonthsDuration: frozenMonths,
          originalExpiryDateBeforeFreeze: expiryTimestamp,
        };
      }

      const newProduct: Omit<Product, "productId" | "productCreatedAt" | "productUpdatedAt"> = {
        productName: name.trim(),
        productQuantity: isShoppingListMode ? 0 : quantity,
        ...(category ? { productCategory: category } : {}),
        shelfLifeDays: shelfLifeDays === "" ? null : Number(shelfLifeDays),
        expiryDateProduct: expiryTimestamp,
        productPantryId: pantryId,
        addToShoppingList: false,
        productOpenedAt: null,
        productOpenedExpiryAt: null,
        carbonFootprint: initialCarbonFootprint,
        ...frozenFields,
      };

      const newProductId = await addProduct(newProduct);

      if (addToShoppingListByDefault) {
        const productForList = { ...newProduct, productId: newProductId } as Product;
        await addProductToShoppingList(productForList);
      }

      onProductAdded();
      advanceQueueOrClose();
    } catch (error) {
      console.error("Errore salvataggio prodotto:", error);
      alert("Errore durante il salvataggio del prodotto");
    } finally {
      setIsSaving(false);
    }
  };

  const isLastQueueItem = !isQueueMode || queueIndex + 1 === productQueue.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col p-6 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con eventuale badge coda */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isShoppingListMode ? "Aggiungi alla Lista" : "Nuovo Prodotto"}
            </h2>
            {isQueueMode && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-3 h-3" />
                  <span>Prodotto {queueIndex + 1} di {productQueue.length} (Smart Vision)</span>
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campi Form */}
        <div className="space-y-4 pt-4 overflow-y-auto flex-1 overscroll-contain pr-1">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              Nome Prodotto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Latte Intero, Mele, Pasta..."
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Categoria & Quantità */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Seleziona...</option>
                {pantryCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Quantità
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Data di Scadenza */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Data di Scadenza
              </label>
              {activeItem?.expiryDate && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Rilevata da etichetta OCR
                </span>
              )}
            </div>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Durata post-apertura / Shelf-life stima */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Durata stimata (giorni)
              </label>
              {activeItem?.shelfLifeDays && !activeItem.expiryDate && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                  Stima IA per prodotto fresco
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              placeholder="Es. 4 giorni dopo l'apertura o sfuso"
              value={shelfLifeDays}
              onChange={(e) =>
                setShelfLifeDays(e.target.value === "" ? "" : parseInt(e.target.value) || "")
              }
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Opzione Conservazione nel Freezer */}
          {!isShoppingListMode && (
            <div className="p-3 rounded-2xl border border-cyan-200/60 dark:border-cyan-900/40 bg-cyan-50/40 dark:bg-cyan-950/20">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Snowflake className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Conserva subito nel freezer
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isFrozen}
                  onChange={(e) => setIsFrozen(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded-sm focus:ring-cyan-500 accent-cyan-600"
                />
              </label>

              {isFrozen && (
                <div className="mt-2.5 pt-2 border-t border-cyan-200/40 dark:border-cyan-900/40 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Durata nel freezer:</span>
                  <div className="flex gap-1.5">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFrozenMonths(m)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                          frozenMonths === m
                            ? "bg-cyan-600 text-white shadow-xs"
                            : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        +{m}m
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con Azioni */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
          {isQueueMode && !isLastQueueItem ? (
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Salta questo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-semibold transition-colors"
            >
              Annulla
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-green-900/20 transition-all"
          >
            {isSaving ? (
              <span>Salvataggio...</span>
            ) : isQueueMode && !isLastQueueItem ? (
              <>
                <Plus className="w-4 h-4" />
                <span>Salva e Continua</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isShoppingListMode ? "Aggiungi alla Lista" : "Salva Prodotto"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
