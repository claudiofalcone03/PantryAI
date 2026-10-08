"use client";

import React, { useState } from "react";
import { ShoppingCart, Minus, Plus, Clock, PackageOpen, Snowflake } from "lucide-react";
import type { Product } from "@/types/firestore/productType";
import { updateProduct, freezeProduct, unfreezeProduct } from "@/lib/firestore/products";
import { addProductToShoppingList, removeProductFromShoppingList } from "@/lib/firestore/shoppingList";
import { addProductHistoryLog } from "@/lib/firestore/productHistory";
import { Timestamp } from "firebase/firestore";
import { RemoveQuantityPopup } from "../popups/RemoveQuantityPopup";
import { FreezeProductPopup } from "../popups/FreezeProductPopup";
import { getEffectiveExpiryDate } from "@/lib/firestore/pantries";
import { enqueueOfflineMutation } from "@/lib/offline/indexedDb";

interface ProductListItemProps {
  product: Product;
  onClick: () => void;
  onProductUpdated?: () => void;
}

export function ProductListItem({ product, onClick, onProductUpdated }: ProductListItemProps) {
  const [prevQuantity, setPrevQuantity] = useState(product.productQuantity);
  const [quantity, setQuantity] = useState(product.productQuantity);
  if (product.productQuantity !== prevQuantity) {
    setPrevQuantity(product.productQuantity);
    setQuantity(product.productQuantity);
  }

  const [prevInShoppingList, setPrevInShoppingList] = useState(product.addToShoppingList);
  const [inShoppingList, setInShoppingList] = useState(product.addToShoppingList);
  if (product.addToShoppingList !== prevInShoppingList) {
    setPrevInShoppingList(product.addToShoppingList);
    setInShoppingList(product.addToShoppingList);
  }

  const [isUpdating, setIsUpdating] = useState(false);
  const [isShoppingListUpdating, setIsShoppingListUpdating] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [showDecreaseOptions, setShowDecreaseOptions] = useState(false);
  const [showFreezePopup, setShowFreezePopup] = useState(false);

  // Congelamento prodotto
  const handleConfirmFreeze = async (months: number, customDate?: Date) => {
    if (!product.productId) return;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const now = new Date();
        const frozenExpiry = customDate || new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
        await enqueueOfflineMutation({
          type: "FREEZE_PRODUCT",
          pantryId: product.productPantryId || "",
          docId: product.productId,
          payload: {
            frozenAt: now.toISOString(),
            frozenExpiryAt: frozenExpiry.toISOString(),
            monthsDuration: months,
            originalExpiryDateBeforeFreeze: product.originalExpiryDateBeforeFreeze?.toDate?.()?.toISOString?.() || product.expiryDateProduct?.toDate?.()?.toISOString?.() || null,
          },
          createdAt: Date.now(),
        });
      } else {
        await freezeProduct(product.productId, months, customDate);
      }
      onProductUpdated?.();
    } catch (err) {
      console.error("Errore durante il congelamento:", err);
      throw err;
    }
  };

  // Scongelamento prodotto
  const handleConfirmUnfreeze = async (mode: "consume_soon" | "restore_original", hours: number) => {
    if (!product.productId) return;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (mode === "consume_soon") {
          const now = new Date();
          const openedExpiry = new Date(now.getTime() + hours * 60 * 60 * 1000);
          await enqueueOfflineMutation({
            type: "UNFREEZE_PRODUCT",
            pantryId: product.productPantryId || "",
            docId: product.productId,
            payload: {
              mode: "consume_soon",
              unfrozenAt: now.toISOString(),
              openedExpiryAt: openedExpiry.toISOString(),
              shelfLifeDays: Math.ceil(hours / 24),
            },
            createdAt: Date.now(),
          });
        } else {
          await enqueueOfflineMutation({
            type: "UNFREEZE_PRODUCT",
            pantryId: product.productPantryId || "",
            docId: product.productId,
            payload: {
              mode: "restore_original",
              originalExpiryDate: product.originalExpiryDateBeforeFreeze?.toDate?.()?.toISOString?.() || product.expiryDateProduct?.toDate?.()?.toISOString?.() || null,
            },
            createdAt: Date.now(),
          });
        }
      } else {
        await unfreezeProduct(product.productId, mode, hours);
      }
      onProductUpdated?.();
    } catch (err) {
      console.error("Errore durante lo scongelamento:", err);
      throw err;
    }
  };

  //Modifica la quantità
  const handleUpdateQuantity = async (e: React.MouseEvent, delta: number, resolution?: 'consumed' | 'wasted') => {
    e.stopPropagation();
    if (!product.productId || isUpdating) return;

    const newQuantity = Math.max(0, quantity + delta);
    if (newQuantity === quantity) return; //Per prevenire quantità minore di 0 

    setQuantity(newQuantity);
    setIsUpdating(true);
    setShowDecreaseOptions(false);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineMutation({
          type: "UPDATE_PRODUCT_QTY",
          pantryId: product.productPantryId || "",
          docId: product.productId,
          payload: { quantity: newQuantity },
          createdAt: Date.now(),
        });
      } else {
        await updateProduct(product.productId, { productQuantity: newQuantity });
      }

      // Se rimuovo un prodotto aggiungo allo storico (solo online)
      if (delta < 0 && resolution && navigator.onLine) {
        let finalResolution: 'consumed' | 'rescued' | 'wasted' = resolution;

        // Un prodotto è "salvato" se consumato entro 3 giorni dalla scadenza
        if (resolution === 'consumed') {
          const effectiveExpiryDate = getEffectiveExpiryDate(product);

          if (effectiveExpiryDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expCopy = new Date(effectiveExpiryDate);
            expCopy.setHours(0, 0, 0, 0);
            const diffTime = expCopy.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 3 && diffDays >= 0) {
              finalResolution = 'rescued';
            }
          }
        }

        if (product.productPantryId) {
          await addProductHistoryLog(product.productPantryId, {
            productId: product.productId,
            productName: product.productName,
            productCategory: product.productCategory ?? "",
            carbonFootprint: product.carbonFootprint ?? 0,
            quantityHistory: 1,
            resolution: finalResolution,
          });
        }
      }

      onProductUpdated?.();
    } catch (error) {
      console.error("Errore aggiornamento quantità:", error);
      setQuantity(quantity);
    } finally {
      setIsUpdating(false);
    }
  };

  //Tasto aggiungi/rimuovi dalla lista della spesa
  const handleToggleShoppingList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.productId || isShoppingListUpdating) return;

    setIsShoppingListUpdating(true);
    setInShoppingList(!inShoppingList);

    try {
      if (!inShoppingList) {
        await addProductToShoppingList(product);
      } else {
        await removeProductFromShoppingList(product);
      }
      onProductUpdated?.();
    } catch (error) {
      console.error("Errore modifica lista della spesa:", error);
      setInShoppingList(inShoppingList);
    } finally {
      setIsShoppingListUpdating(false);
    }
  };

  // Funzione per segnare il prodotto come aperto 
  const handleOpenProduct = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.productId || isOpening) return;

    setIsOpening(true);
    try {
      const openedAt = new Date();
      const shelfLife = product.shelfLifeDays || 0;
      const expiryDate = new Date();
      expiryDate.setDate(openedAt.getDate() + shelfLife);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineMutation({
          type: "OPEN_PRODUCT",
          pantryId: product.productPantryId || "",
          docId: product.productId,
          payload: {
            openedAt: openedAt.toISOString(),
            openedExpiryAt: expiryDate.toISOString(),
            shelfLifeDays: shelfLife,
          },
          createdAt: Date.now(),
        });
      } else {
        const openedAtTimestamp = Timestamp.fromDate(openedAt);
        const expiryDateTimestamp = Timestamp.fromDate(expiryDate);

        await updateProduct(product.productId, {
          productOpenedAt: openedAtTimestamp,
          productOpenedExpiryAt: expiryDateTimestamp,
        });
      }

      if (onProductUpdated) {
        onProductUpdated();
      }
    } catch (error) {
      console.error("Errore durante l'apertura del prodotto:", error);
    } finally {
      setIsOpening(false);
    }
  };

  //Condizione (temporanea) per il colore del pallino di stato e la data formattata
  let statusColor = "bg-green-500";
  let formattedDate = "";
  const isOpened = !!product.productOpenedAt;
  const isFrozen = Boolean(product.isFrozen);

  // Determina la data di scadenza effettiva da usare per visualizzazione e calcolo stato
  const effectiveExpiryDate = getEffectiveExpiryDate(product);

  if (effectiveExpiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expCopy = new Date(effectiveExpiryDate);
    expCopy.setHours(0, 0, 0, 0);

    const diffTime = expCopy.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      statusColor = "bg-red-500"; // Scaduto
    } else if (diffDays <= 3) {
      statusColor = "bg-yellow-500"; // In scadenza
    }

    formattedDate = expCopy.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  const dateLabel = isFrozen
    ? "Scade nel freezer: "
    : isOpened
    ? "Consumare entro: "
    : "Scade: ";

  return (
    <>
      <div
        onClick={onClick}
        className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer mb-3"
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            {/* Pallino status */}
            <div className={`w-3 h-3 rounded-full ${statusColor} shrink-0`} title="Status" />
            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 truncate">
              {product.productName}
            </h3>
            {isFrozen && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                <Snowflake className="w-3 h-3" />
                Congelato
              </span>
            )}
            {!isFrozen && isOpened && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-md shrink-0">
                Aperto
              </span>
            )}
          </div>

          {formattedDate && (
            <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 pl-5">
              <Clock className="w-4 h-4" />
              <span>{dateLabel}{formattedDate}</span>
            </div>
          )}

          {!isFrozen && !isOpened && product.shelfLifeDays && (
            <div className="text-xs text-zinc-400 dark:text-zinc-500 pl-5">
              Durata dopo apertura: {product.shelfLifeDays} {product.shelfLifeDays === 1 ? "giorno" : "giorni"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Tasto Congela / Scongela (Freezer) */}
          {quantity > 0 && (
            <button
              className={`p-2.5 rounded-full transition-colors border ${
                isFrozen
                  ? "bg-cyan-100 border-cyan-200 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                  : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-cyan-600 hover:bg-cyan-50 hover:border-cyan-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-cyan-400 dark:hover:bg-cyan-950/20 dark:hover:border-cyan-900/30"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setShowFreezePopup(true);
              }}
              title={isFrozen ? "Alimento congelato - Clicca per scongelare" : "Conserva nel freezer"}
            >
              <Snowflake className="w-5 h-5" />
            </button>
          )}

          {/* Bottone "Apri"  */}
          {product.shelfLifeDays && !isOpened && !isFrozen && quantity > 0 && (
            <button
              className="p-2.5 rounded-full transition-colors border bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-green-600 hover:bg-green-50 hover:border-green-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-green-400 dark:hover:bg-green-950/20 dark:hover:border-green-900/30"
              onClick={handleOpenProduct}
              disabled={isOpening}
              title="Apri prodotto"
            >
              <PackageOpen className="w-5 h-5" />
            </button>
          )}

          {/* Quantità */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 border border-zinc-200 dark:border-zinc-700 relative">
            <RemoveQuantityPopup
              isOpen={showDecreaseOptions}
              onClose={(e) => {
                e.stopPropagation();
                setShowDecreaseOptions(false);
              }}
              productName={product.productName}
              onResolve={(e: React.MouseEvent, resolution) => handleUpdateQuantity(e, -1, resolution)}
            />

            <button
              className="p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                if (!showDecreaseOptions) setShowDecreaseOptions(true);
                else setShowDecreaseOptions(false);
              }}
              disabled={quantity <= 0 || isUpdating}
            >
              <Minus className="w-4 h-4" />
            </button>

            <span className="w-8 text-center font-medium text-zinc-900 dark:text-zinc-100">
              {quantity}
            </span>

            <button
              className="p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
              onClick={(e) => handleUpdateQuantity(e, 1)}
              disabled={isUpdating}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Tasto lista della spesa */}
          <button
            className={`p-2.5 rounded-full transition-colors border ${inShoppingList
              ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/40 dark:border-green-800 dark:text-green-400"
              : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            onClick={handleToggleShoppingList}
            disabled={isShoppingListUpdating}
            title={inShoppingList ? "Rimuovi dalla lista della spesa" : "Aggiungi alla lista della spesa"}
          >
            <ShoppingCart className={`w-5 h-5 ${inShoppingList ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* Popup Congelamento / Scongelamento */}
      <FreezeProductPopup
        isOpen={showFreezePopup}
        onClose={() => setShowFreezePopup(false)}
        product={product}
        onConfirmFreeze={handleConfirmFreeze}
        onConfirmUnfreeze={handleConfirmUnfreeze}
      />
    </>
  );
}
