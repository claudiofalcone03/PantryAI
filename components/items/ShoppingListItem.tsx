"use client";

import React, { useState, useRef } from "react";
import { Check, Hand, Trash2, Loader2 } from "lucide-react";
import type { ShoppingListItem as ShoppingListItemType } from "@/types/firestore/shoppingListItemType";
import type { Product } from "@/types/firestore/productType";
import { updateShoppingListItemStatus, deleteShoppingListItem } from "@/lib/firestore/shoppingList";
import { auth } from "@/lib/firebase";
import { enqueueOfflineMutation } from "@/lib/offline/indexedDb";
import { getFoodIcon } from "@/lib/utils/foodIcons";

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  product?: Product;
  onItemUpdated: () => void;
}

export function ShoppingListItem({ item, product, onItemUpdated }: ShoppingListItemProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gesto Swipe su Mobile (da destra verso sinistra)
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const isPurchased = item.listItemStatus === "purchased";
  const isReserved = item.listItemStatus === "reserved";

  // Viene visualizzato il nome, altrimenti l'email, altrimenti "Utente"
  const currentMemberName = auth.currentUser?.displayName || auth.currentUser?.email || "Utente";

  const handleTogglePurchased = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpdating || isDeleting) return;

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
    if (isUpdating || isDeleting) return;

    setIsUpdating(true);
    try {
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting || isUpdating) return;

    setIsDeleting(true);
    try {
      const associatedProductId = item.listItemProductId || product?.productId || null;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineMutation({
          type: "DELETE_SHOPPING_ITEM",
          pantryId: item.listItemPantryId || "",
          docId: item.listItemId,
          payload: { productId: associatedProductId },
          createdAt: Date.now(),
        });
      } else {
        // Elimina dalla lista spesa e spegne il carrello sul prodotto in dispensa (senza cancellare il prodotto)
        await deleteShoppingListItem(item.listItemId, associatedProductId, item.listItemPantryId);
      }
      onItemUpdated();
    } catch (error) {
      console.error("Errore rimozione elemento dalla spesa:", error);
    } finally {
      setIsDeleting(false);
      setSwipeOffset(0);
    }
  };

  // Gestione Swipe su Touch Screen (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isHorizontalSwipeRef.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (!isHorizontalSwipeRef.current) return;

    if (deltaX < 0) {
      setIsSwiping(true);
      const clamped = Math.max(-85, deltaX);
      setSwipeOffset(clamped);
    } else if (swipeOffset < 0) {
      const clamped = Math.min(0, swipeOffset + deltaX);
      setSwipeOffset(clamped);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(false);

    // Se l'utente ha trascinato per più di 40px verso sinistra, ancora a -72px rivelando il tasto elimina
    if (swipeOffset < -40) {
      setSwipeOffset(-72);
    } else {
      setSwipeOffset(0);
    }
  };

  const closeSwipe = () => {
    if (swipeOffset !== 0) {
      setSwipeOffset(0);
    }
  };

  const foodEmoji = getFoodIcon(item.listItemName, product?.productCategory, product?.productIcon);

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2 sm:mb-2.5">
      {/* Azione di eliminazione su Mobile (nascosta dietro la scheda, rivelata su swipe a sinistra) */}
      <div className="absolute inset-y-0 right-0 w-20 bg-rose-600 dark:bg-rose-700 flex items-center justify-center rounded-2xl md:hidden z-0">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full h-full flex flex-col items-center justify-center text-white active:scale-95 transition-transform cursor-pointer"
          title="Elimina dalla spesa"
        >
          {isDeleting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-5 h-5 stroke-[2.2]" />
              <span className="text-[10px] font-bold mt-0.5">Elimina</span>
            </>
          )}
        </button>
      </div>

      {/* Scheda principale (scorre orizzontalmente su mobile se swipata) */}
      <div
        onClick={closeSwipe}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className={`relative z-10 flex items-center justify-between p-2.5 sm:p-3.5 border rounded-2xl shadow-xs transition-colors group ${
          isPurchased
            ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 opacity-60"
            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        {/* Checkbox, icona e nome */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 pr-2">
          <button
            onClick={handleTogglePurchased}
            disabled={isUpdating || isDeleting}
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
              disabled={isUpdating || isDeleting || (isReserved && item.listItemReservedBy !== currentMemberName)}
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

          {/* Bottone Elimina su Desktop (visibile >= md) */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isUpdating}
            className="hidden md:flex w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-lg items-center justify-center transition-colors border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:hover:text-rose-400 dark:hover:bg-rose-950/30 dark:hover:border-rose-800/60 cursor-pointer disabled:opacity-50"
            title="Elimina dalla lista della spesa"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
