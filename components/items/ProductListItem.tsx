"use client";

import React, { useState } from "react";
import { ShoppingCart, Minus, Plus, Clock, PackageOpen, Snowflake } from "lucide-react";
import type { Product } from "@/types/firestore/productType";
import { updateProduct } from "@/lib/firestore/products";
import { addProductToShoppingList, removeProductFromShoppingList } from "@/lib/firestore/shoppingList";
import { Timestamp } from "firebase/firestore";
import { getEffectiveExpiryDate } from "@/lib/firestore/pantries";
import { enqueueOfflineMutation } from "@/lib/offline/indexedDb";
import { getFoodIcon } from "@/lib/utils/foodIcons";

interface ProductListItemProps {
  product: Product;
  onClick: () => void;
  onProductUpdated?: () => void;
  isWasteTelemetryEnabled?: boolean;
  onRequestDecrease?: (product: Product) => void;
  onRequestFreeze?: (product: Product) => void;
}

export const ProductListItem = React.memo(function ProductListItem({
  product,
  onClick,
  onProductUpdated,
  isWasteTelemetryEnabled = true,
  onRequestDecrease,
  onRequestFreeze,
}: ProductListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isShoppingListUpdating, setIsShoppingListUpdating] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const quantity = product.productQuantity ?? 0;
  const inShoppingList = Boolean(product.addToShoppingList);

  // Modifica la quantità diretta (incremento o decremento con telemetria disattivata)
  const handleUpdateQuantity = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (!product.productId || isUpdating) return;

    const newQuantity = Math.max(0, quantity + delta);
    if (newQuantity === quantity) return;

    setIsUpdating(true);
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
      onProductUpdated?.();
    } catch (error) {
      console.error("Errore aggiornamento quantità:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Tasto aggiungi/rimuovi dalla lista della spesa
  const handleToggleShoppingList = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.productId || isShoppingListUpdating) return;

    setIsShoppingListUpdating(true);
    try {
      if (!inShoppingList) {
        await addProductToShoppingList(product);
      } else {
        await removeProductFromShoppingList(product);
      }
      onProductUpdated?.();
    } catch (error) {
      console.error("Errore modifica lista della spesa:", error);
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

      onProductUpdated?.();
    } catch (error) {
      console.error("Errore durante l'apertura del prodotto:", error);
    } finally {
      setIsOpening(false);
    }
  };

  // Condizione per il colore del pallino di stato e la data formattata
  let statusColor = "bg-green-500";
  let formattedDate = "";
  const isOpened = Boolean(product.productOpenedAt);
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
      year: "numeric",
    });
  }

  const dateLabel = isFrozen
    ? "Scade nel freezer: "
    : isOpened
    ? "Consumare entro: "
    : "Scade: ";

  const foodEmoji = getFoodIcon(product.productName, product.productCategory, product.productIcon);

  return (
    <div
      onClick={onClick}
      style={{ contentVisibility: "auto", containIntrinsicSize: "84px" }}
      className="flex items-center justify-between p-2 sm:p-2.5 sm:px-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer mb-2 sm:mb-2.5 relative overflow-hidden group min-h-[80px] sm:min-h-[84px] h-[80px] sm:h-[84px]"
    >
      {/* Blocco sinistro: Icona + Dettagli Prodotto */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 pr-1 sm:pr-1.5 h-full">
        {/* Icona Alimento / Emoji */}
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg sm:text-xl shrink-0 select-none shadow-xs group-hover:scale-105 transition-transform"
          title={product.productCategory || "Alimento"}
        >
          {foodEmoji}
        </div>

        {/* Nome, Badge e Scadenza */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight break-words"
              title={product.productName}
            >
              {product.productName}
            </h3>
            {isFrozen && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 self-start">
                <Snowflake className="w-2.5 h-2.5" />
                Freezer
              </span>
            )}
            {!isFrozen && isOpened && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-md shrink-0 self-start">
                Aperto
              </span>
            )}
          </div>

          {/* Scadenza o Shelf-life */}
          {(formattedDate || (!isFrozen && !isOpened && product.shelfLifeDays)) && (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {formattedDate ? (
                <>
                  <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="truncate">{dateLabel}{formattedDate}</span>
                </>
              ) : (
                <span className="truncate">Dopo apertura: {product.shelfLifeDays} {product.shelfLifeDays === 1 ? "giorno" : "giorni"}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blocco destro: Tasti Operativi Compatti + Pallino Status a destra */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-1">
        {/* Tasto Congela / Scongela (Freezer) */}
        {quantity > 0 && (
          <button
            className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors border ${
              isFrozen
                ? "bg-cyan-100 border-cyan-200 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-cyan-600 hover:bg-cyan-50 hover:border-cyan-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-cyan-400 dark:hover:bg-cyan-950/20"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onRequestFreeze?.(product);
            }}
            title={isFrozen ? "Alimento congelato - Clicca per scongelare" : "Conserva nel freezer"}
          >
            <Snowflake className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Bottone "Apri" */}
        {product.shelfLifeDays && !isOpened && !isFrozen && quantity > 0 && (
          <button
            className="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors border bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-green-600 hover:bg-green-50 hover:border-green-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-green-400 dark:hover:bg-green-950/20"
            onClick={handleOpenProduct}
            disabled={isOpening}
            title="Apri prodotto"
          >
            <PackageOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Stepper Quantità Compatto */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700 relative h-7.5 sm:h-8">
          <button
            className="w-5.5 h-6 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              if (isWasteTelemetryEnabled) {
                onRequestDecrease ? onRequestDecrease(product) : handleUpdateQuantity(e, -1);
              } else {
                handleUpdateQuantity(e, -1);
              }
            }}
            disabled={quantity <= 0 || isUpdating}
          >
            <Minus className="w-3 h-3" />
          </button>

          <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {quantity}
          </span>

          <button
            className="w-5.5 h-6 sm:w-6 sm:h-6 rounded flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
            onClick={(e) => handleUpdateQuantity(e, 1)}
            disabled={isUpdating}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Tasto Lista della Spesa (stile PantryFlow verde pieno quando attivo) */}
        <button
          className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all border ${
            inShoppingList
              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
              : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
          onClick={handleToggleShoppingList}
          disabled={isShoppingListUpdating}
          title={inShoppingList ? "Rimuovi dalla lista della spesa" : "Aggiungi alla lista della spesa"}
        >
          <ShoppingCart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${inShoppingList ? "fill-current" : ""}`} />
        </button>

        {/* Pallino dello stato a destra (dopo tutti i pulsanti) */}
        <div
          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${statusColor} shrink-0 ml-1 shadow-xs`}
          title={`Stato scadenza: ${
            statusColor === "bg-red-500"
              ? "Scaduto"
              : statusColor === "bg-yellow-500"
              ? "In scadenza"
              : "Fresco"
          }`}
        />
      </div>
    </div>
  );
});
