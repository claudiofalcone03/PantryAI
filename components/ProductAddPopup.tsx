"use client";

import React, { useState } from "react";
import { X, Plus, Save } from "lucide-react";
import { addProduct } from "@/lib/firestore/products";
import { addProductToShoppingList } from "@/lib/firestore/shoppingList";
import { Timestamp } from "firebase/firestore";
import type { Product } from "@/types/firestore/product";

interface ProductAddPopupProps {
  isOpen: boolean;
  onClose: () => void;
  pantryId: string;
  onProductAdded: () => void;
  pantryCategories?: string[];
  addToShoppingListByDefault?: boolean;
}

export function ProductAddPopup({
  isOpen,
  onClose,
  pantryId,
  onProductAdded,
  pantryCategories = [],
  addToShoppingListByDefault = false,
}: ProductAddPopupProps) {
  if (!isOpen || !pantryId) return null;

  return (
    <ProductAddPopupContent
      pantryId={pantryId}
      onClose={onClose}
      onProductAdded={onProductAdded}
      pantryCategories={pantryCategories}
      addToShoppingListByDefault={addToShoppingListByDefault}
    />
  );
}

function ProductAddPopupContent({
  pantryId,
  onClose,
  onProductAdded,
  pantryCategories,
  addToShoppingListByDefault,
}: {
  pantryId: string;
  onClose: () => void;
  onProductAdded: () => void;
  pantryCategories: string[];
  addToShoppingListByDefault: boolean;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState("");
  const [category, setCategory] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);

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

      const newProduct: Omit<Product, "productId" | "productCreatedAt" | "productUpdatedAt"> = {
        productName: name.trim(),
        productQuantity: quantity,
        productCategory: category || undefined,
        shelfLifeDays: shelfLifeDays === "" ? null : Number(shelfLifeDays),
        expiryDateProduct: expiryTimestamp,
        productPantryId: pantryId,
        addToShoppingList: false,
        productOpenedAt: null,
        productOpenedExpiryAt: null,
      };

      const newProductId = await addProduct(newProduct);

      if (addToShoppingListByDefault) {
        const productForList = { ...newProduct, productId: newProductId } as Product;
        await addProductToShoppingList(productForList);
      }

      onProductAdded();
      onClose();
    } catch (error) {
      console.error("Errore durante l'aggiunta del prodotto:", error);
      alert("Errore durante l'aggiunta del prodotto");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Nuovo Prodotto
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Nome Prodotto *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Latte, Uova..."
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none"
              >
                <option value="" disabled>Seleziona...</option>
                {pantryCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-[1]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Quantità</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex-[1.5]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Durata da aperto (giorni)</label>
              <input
                type="number"
                min="0"
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="es. 3"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scadenza</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 shadow-sm"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? "Salvataggio..." : "Aggiungi Prodotto"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
