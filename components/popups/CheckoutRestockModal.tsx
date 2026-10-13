"use client";

import React, { useState, useEffect } from "react";
import { X, ShoppingBag, Plus, Minus, Check, Loader2 } from "lucide-react";
import type { Product } from "@/types/firestore/productType";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItemType";
import { getFoodIcon } from "@/lib/utils/foodIcons";

export interface CheckoutRestockItem {
  item: ShoppingListItemType;
  product: Product;
}

interface CheckoutRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CheckoutRestockItem[];
  onConfirm: (quantities: Record<string, number>) => Promise<void>;
}

export function CheckoutRestockModal({
  isOpen,
  onClose,
  items,
  onConfirm,
}: CheckoutRestockModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      items.forEach(({ product }) => {
        if (product.productId) {
          // Default: carica 1 confezione/unità per ciascun alimento acquistato a quantità zero
          initial[product.productId] = 1;
        }
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuantities(initial);
    }
  }, [isOpen, items]);

  if (!isOpen || items.length === 0) return null;

  const handleQtyChange = (productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] ?? 1;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleDirectQtyInput = (productId: string, val: string) => {
    const parsed = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(parsed) || parsed < 0 ? 0 : parsed,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(quantities);
      onClose();
    } catch (err) {
      console.error("Errore durante il caricamento in dispensa:", err);
      alert("Si è verificato un errore durante il caricamento in dispensa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Carica in Dispensa
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Conferma la quantità acquistata per gli alimenti a scorta zero
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Elenco alimenti da caricare */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/60 leading-relaxed">
            I seguenti prodotti erano censiti a quantità zero. Indica quante unità hai acquistato prima di completare la spesa:
          </div>

          <div className="space-y-2">
            {items.map(({ product, item }) => {
              const pId = product.productId || "";
              const currentQty = quantities[pId] ?? 1;
              const unit = product.productUnitOfMeasure || "pz";
              const emoji = getFoodIcon(product.productName, product.productCategory, product.productIcon);

              return (
                <div
                  key={pId || item.listItemId}
                  className="flex items-center justify-between p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 flex items-center justify-center text-xl shrink-0 select-none shadow-2xs border border-zinc-100 dark:border-zinc-700/60">
                      {emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {product.productName}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {product.productCategory || "Dispensa"}
                      </div>
                    </div>
                  </div>

                  {/* Selettore rapido Quantità */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(pId, -1)}
                      disabled={isSubmitting || currentQty <= 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={currentQty}
                      onChange={(e) => handleDirectQtyInput(pId, e.target.value)}
                      disabled={isSubmitting}
                      className="w-10 text-center font-bold text-sm bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />

                    <span className="text-[11px] font-medium text-zinc-400 pr-1">
                      {unit}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleQtyChange(pId, 1)}
                      disabled={isSubmitting}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer azioni */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Carica in Dispensa & Completa Spesa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
