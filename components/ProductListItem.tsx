/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { ShoppingCart, Minus, Plus, Clock } from "lucide-react";
import type { Product } from "@/types/firestore/product";
import { updateProduct } from "@/lib/firestore/products";
import { addProductToShoppingList, removeProductFromShoppingList } from "@/lib/firestore/shoppingList";
import type { Timestamp } from "firebase/firestore";

interface ProductListItemProps {
  product: Product;
  onClick: () => void;
}

export function ProductListItem({ product, onClick }: ProductListItemProps) {
  const [quantity, setQuantity] = useState(product.productQuantity);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isShoppingListUpdating, setIsShoppingListUpdating] = useState(false);
  const [inShoppingList, setInShoppingList] = useState(product.addToShoppingList);

  //Modifica la quantità
  const handleUpdateQuantity = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation(); //
    if (!product.productId || isUpdating) return;

    const newQuantity = Math.max(0, quantity + delta);
    if (newQuantity === quantity) return; //Per prevenire quantità minore di 0 

    setQuantity(newQuantity);
    setIsUpdating(true);

    try {
      await updateProduct(product.productId, { productQuantity: newQuantity });
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
    } catch (error) {
      console.error("Errore modifica lista della spesa:", error);
      setInShoppingList(inShoppingList);
    } finally {
      setIsShoppingListUpdating(false);
    }
  };

  //Condizione per il colore del pallino di stato e la data formattata
  let statusColor = "bg-green-500";
  let formattedDate = "";

  if (product.expiryDateProduct) {
    // Gestione safely del timestamp o date
    const expiryDate = typeof (product.expiryDateProduct as any).toDate === 'function' 
        ? (product.expiryDateProduct as Timestamp).toDate() 
        : new Date(product.expiryDateProduct as any);
        
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);

    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      statusColor = "bg-red-500";
    } else if (diffDays <= 7) {
      statusColor = "bg-orange-500";
    }

    formattedDate = expiryDate.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } else {
    // Nessuna data di scadenza
    statusColor = "bg-gray-300";
  }

  return (
    <div 
      className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer mb-3"
      onClick={onClick}
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0 pr-4">
        <div className="flex items-center gap-2">
          {/* Status Dot */}
          <div className={`w-3 h-3 rounded-full ${statusColor} shrink-0`} title="Status" />
          <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100 truncate">
            {product.productName}
          </h3>
        </div>
        
        {formattedDate && (
          <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 pl-5">
            <Clock className="w-4 h-4" />
            <span>Scade: {formattedDate}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Quantity Controls */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 border border-zinc-200 dark:border-zinc-700">
          <button 
            className="p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-50"
            onClick={(e) => handleUpdateQuantity(e, -1)}
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

        {/* Shopping List Button */}
        <button
          className={`p-2.5 rounded-full transition-colors border ${
            inShoppingList 
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
  );
}
