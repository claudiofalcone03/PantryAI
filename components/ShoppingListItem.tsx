"use client";

import React, { useState } from "react";
import { Check, Hand } from "lucide-react";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItem";
import type { Product } from "@/types/firestore/product";
import { updateShoppingListItemStatus } from "@/lib/firestore/shoppingList";
import { auth } from "@/lib/firebase";

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
      await updateShoppingListItemStatus(item.listItemId, newStatus, currentMemberName);
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
      await updateShoppingListItemStatus(item.listItemId, newStatus, currentMemberName);
      onItemUpdated();
    } catch (error) {
      console.error("Errore aggiornamento prenotazione:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`flex items-center justify-between p-4 border rounded-2xl shadow-sm transition-all mb-3 ${isPurchased ? 'bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 opacity-60' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>

      {/*Checkbox e nome */}
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
        <button
          onClick={handleTogglePurchased}
          disabled={isUpdating}
          className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isPurchased
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-transparent hover:border-green-500 dark:hover:border-green-500'
            }`}
        >
          <Check className="w-4 h-4" />
        </button>

        <div className="flex flex-col min-w-0">
          <span className={`font-semibold text-lg truncate ${isPurchased ? 'text-zinc-500 dark:text-zinc-400 line-through' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {item.listItemName}
          </span>
          {product && (
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Quantità già disponibile: {product.productQuantity}
            </div>
          )}
          {isReserved && !isPurchased && (
            <span className="text-xs text-orange-500 font-medium mt-0.5">
              Prenotato da {item.listItemReservedBy || "qualcuno"}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">

        {/* Bottone "Lo Compro Io" */}
        {!isPurchased && (
          <button
            onClick={handleToggleReserved}
            disabled={isUpdating || (isReserved && item.listItemReservedBy !== currentMemberName)}
            className={`p-2 rounded-full transition-colors border ${isReserved
              ? (item.listItemReservedBy === currentMemberName
                ? 'bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-900/40 dark:border-orange-800 dark:text-orange-400'
                : 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700')
              : 'bg-zinc-50 border-zinc-200 text-zinc-400 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:text-orange-400 dark:hover:bg-orange-950/20 dark:hover:border-orange-900/30'
              }`}
            title="Lo compro io"
          >
            <Hand className={`w-5 h-5 ${isReserved ? "fill-current" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
