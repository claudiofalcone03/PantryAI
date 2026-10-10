"use client";

import React, { useState } from "react";
import { Check, Hand } from "lucide-react";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItemType";
import type { Product } from "@/types/firestore/productType";
import { updateShoppingListItemStatus } from "@/lib/firestore/shoppingList";
import { auth } from "@/lib/firebase";
import { enqueueOfflineMutation } from "@/lib/offline/indexedDb";

import { getEffectiveExpiryDate } from "@/lib/firestore/pantries";
import { getFoodIcon } from "@/lib/utils/foodIcons";

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  product?: Product;
  onItemUpdated: () => void;
}

export function ShoppingListItem({ item, product, onItemUpdated }: ShoppingListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isPurchased = item.listItemStatus === "purchased";
  const isReserved = item.listItemStatus === "reserved";

  // Viene visualizzato il nome, altrimenti l'email, altrimenti "Utente"
  const currentMemberName = auth.currentUser?.displayName || auth.currentUser?.email || "Utente";

  const handleTogglePurchased = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const newStatus = isPurchased ? "toBuy" : "purchased";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineMutation({
          type: "SET_SHOPPING_STATUS",
          pantryId: item.listItemPantryId || "",
          docId: item.listItemId,
          payload: { status: newStatus, userName: currentMemberName },
          createdAt: Date.now(),
        });
      } else {
        await updateShoppingListItemStatus(item.listItemId, newStatus, currentMemberName);
      }
      onItemUpdated();
    } catch (error) {
      console.error("Errore aggiornamento stato:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleReserved = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // Se era già riservato dall'utente corrente, annulla. Altrimenti riserva.
      const newStatus = isReserved ? "toBuy" : "reserved";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineMutation({
          type: "SET_SHOPPING_STATUS",
          pantryId: item.listItemPantryId || "",
          docId: item.listItemId,
          payload: { status: newStatus, userName: currentMemberName },
          createdAt: Date.now(),
        });
      } else {
        await updateShoppingListItemStatus(item.listItemId, newStatus, currentMemberName);
      }
      onItemUpdated();
    } catch (error) {
      console.error("Errore aggiornamento prenotazione:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const foodEmoji = getFoodIcon(item.listItemName, product?.productCategory, product?.productIcon);

  return (
    <div
      className={`flex items-center justify-between p-2.5 sm:p-3.5 border rounded-2xl shadow-xs transition-all mb-2 sm:mb-2.5 group ${
        isPurchased
          ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 opacity-60"
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      {/* Checkbox, icona e nome */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 pr-2">
        <button
          onClick={handleTogglePurchased}
          disabled={isUpdating}
          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
            isPurchased
              ? "bg-green-500 border-green-500 text-white"
              : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-transparent hover:border-green-500 dark:hover:border-green-500"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>

        {/* Icona alimento */}
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base sm:text-lg shrink-0 select-none shadow-xs">
          {foodEmoji}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={`font-semibold text-sm sm:text-base truncate ${
              isPurchased
                ? "text-zinc-400 dark:text-zinc-500 line-through"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {item.listItemName}
          </span>
          {product && (
            <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
              In dispensa: {product.productQuantity} {product.productUnitOfMeasure || "pz"}
            </div>
          )}
          {isReserved && !isPurchased && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Prenotato da {item.listItemReservedBy || "qualcuno"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Bottone "Lo Compro Io" */}
        {!isPurchased && (
          <button
            onClick={handleToggleReserved}
            disabled={isUpdating || (isReserved && item.listItemReservedBy !== currentMemberName)}
            className={`w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-colors border ${
              isReserved
                ? item.listItemReservedBy === currentMemberName
                  ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-400"
                  : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700"
                : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-amber-400 dark:hover:bg-amber-950/20"
            }`}
            title="Lo compro io"
          >
            <Hand className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isReserved ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
