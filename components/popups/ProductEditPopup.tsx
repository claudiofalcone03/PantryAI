/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { X, Trash2, Save, Snowflake } from "lucide-react";
import type { Product } from "@/types/firestore/productType";
import { updateProduct, deleteProduct, freezeProduct, unfreezeProduct } from "@/lib/firestore/products";
import { Timestamp } from "firebase/firestore";
import { FreezeProductPopup } from "./FreezeProductPopup";

interface ProductEditPopupProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onProductUpdated: () => void;
  pantryCategories?: string[];
}

export function ProductEditPopup({ isOpen, onClose, product, onProductUpdated, pantryCategories = [] }: ProductEditPopupProps) {
  if (!isOpen || !product) return null;

  return (
    <ProductEditPopupContent
      key={product.productId ?? product.productName}
      product={product}
      onClose={onClose}
      onProductUpdated={onProductUpdated}
      pantryCategories={pantryCategories}
    />
  );
}

function ProductEditPopupContent({
  product,
  onClose,
  onProductUpdated,
  pantryCategories,
}: {
  product: Product;
  onClose: () => void;
  onProductUpdated: () => void;
  pantryCategories: string[];
}) {
  const initialExpiryDate = (() => {
    if (!product.expiryDateProduct) return ""; //Verifica se la data di scadenza è presente

    const raw = product.expiryDateProduct as unknown;
    const date = typeof raw === "object" && raw !== null && "toDate" in raw && typeof (raw as { toDate?: () => Date }).toDate === "function"
      ? (raw as { toDate: () => Date }).toDate()
      : new Date(raw as string | number | Date);

    return date.toISOString().split("T")[0]; //Per trasformare la data in anno-mese-giorno (YYYY-MM-DD) 
  })();

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [expiryDate, setExpiryDate] = useState(initialExpiryDate);
  const [category, setCategory] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState<number | "">("");
  const [carbonFootprint, setCarbonFootprint] = useState<number | "">("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openedAt, setOpenedAt] = useState<Timestamp | null>(null);
  const [openedExpiryAt, setOpenedExpiryAt] = useState<Timestamp | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenAt, setFrozenAt] = useState<Timestamp | null>(null);
  const [frozenExpiryAt, setFrozenExpiryAt] = useState<Timestamp | null>(null);
  const [showFreezePopup, setShowFreezePopup] = useState(false);

  const [initialized] = useState(() => {
    setName(product.productName);
    setQuantity(product.productQuantity);
    setCategory(product.productCategory || "");
    setShelfLifeDays(product.shelfLifeDays ?? "");
    setCarbonFootprint(product.carbonFootprint ?? "");
    setOpenedAt(product.productOpenedAt || null);
    setOpenedExpiryAt(product.productOpenedExpiryAt || null);
    setIsFrozen(Boolean(product.isFrozen));
    setFrozenAt(product.productFrozenAt || null);
    setFrozenExpiryAt(product.productFrozenExpiryAt || null);
    return true;
  });

  if (!initialized) return null;

  const handleConfirmFreeze = async (months: number, customDate?: Date) => {
    if (!product.productId) return;
    await freezeProduct(product.productId, months, customDate);
    setIsFrozen(true);
    const now = new Date();
    const expiry = customDate || new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    setFrozenAt(Timestamp.fromDate(now));
    setFrozenExpiryAt(Timestamp.fromDate(expiry));
    onProductUpdated();
  };

  const handleConfirmUnfreeze = async (mode: "consume_soon" | "restore_original", hours: number) => {
    if (!product.productId) return;
    await unfreezeProduct(product.productId, mode, hours);
    setIsFrozen(false);
    setFrozenAt(null);
    setFrozenExpiryAt(null);
    if (mode === "consume_soon") {
      const now = new Date();
      const expiry = new Date(now.getTime() + hours * 60 * 60 * 1000);
      setOpenedAt(Timestamp.fromDate(now));
      setOpenedExpiryAt(Timestamp.fromDate(expiry));
    }
    onProductUpdated();
  };

  const handleSave = async () => {
    if (!product.productId) return;
    setIsSaving(true);
    try {
      let newExpiry: Date | null = null;
      if (expiryDate) {
        newExpiry = new Date(expiryDate);
      }

      await updateProduct(product.productId, {
        productName: name,
        productQuantity: quantity,
        productCategory: category || "",
        shelfLifeDays: shelfLifeDays === "" ? null : Number(shelfLifeDays),
        carbonFootprint: carbonFootprint === "" ? null : Number(carbonFootprint),
        expiryDateProduct: newExpiry as any,
      });
      onProductUpdated();
      onClose();
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      alert("Errore durante il salvataggio del prodotto");
    } finally {
      setIsSaving(false);
    }
  };

  // Funzione per aprire il prodotto e calcolare la scadenza da aperto
  const handleOpenProduct = async () => {
    if (!product.productId) return;
    setIsSaving(true);
    try {
      const opened = new Date();
      const shelfLife = shelfLifeDays === "" ? 0 : Number(shelfLifeDays);
      const expiry = new Date();
      expiry.setDate(opened.getDate() + shelfLife);

      const openedTimestamp = Timestamp.fromDate(opened);
      const expiryTimestamp = Timestamp.fromDate(expiry);

      await updateProduct(product.productId, {
        productOpenedAt: openedTimestamp,
        productOpenedExpiryAt: expiryTimestamp,
      });

      setOpenedAt(openedTimestamp);
      setOpenedExpiryAt(expiryTimestamp);
      onProductUpdated();
    } catch (error) {
      console.error("Errore durante l'apertura del prodotto:", error);
      alert("Errore durante l'apertura del prodotto");
    } finally {
      setIsSaving(false);
    }
  };

  // Funzione per annullare l'apertura del prodotto
  const handleResetOpened = async () => {
    if (!product.productId) return;
    setIsSaving(true);
    try {
      await updateProduct(product.productId, {
        productOpenedAt: null,
        productOpenedExpiryAt: null,
      });

      setOpenedAt(null);
      setOpenedExpiryAt(null);
      onProductUpdated();
    } catch (error) {
      console.error("Errore durante l'annullamento dell'apertura:", error);
      alert("Errore durante l'annullamento dell'apertura");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product.productId) return;
    const confirm = window.confirm("Sei sicuro di voler eliminare questo prodotto?");
    if (!confirm) return;

    setIsDeleting(true);
    try {
      await deleteProduct(product.productId);
      onProductUpdated();
      onClose();
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      alert("Errore durante l'eliminazione del prodotto");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Modifica Prodotto</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 overscroll-contain pr-1">
          <div className="flex gap-4">
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Nome Prodotto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                <option value="" disabled>Seleziona una categoria</option>
                {pantryCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-[1]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Quantità</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
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

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scadenza</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">CO₂ (grammi)</label>
              <input
                type="number"
                min="0"
                value={carbonFootprint}
                onChange={(e) => setCarbonFootprint(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="es. 500"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Stato Conservazione Freezer */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            {isFrozen ? (
              <div className="flex items-center justify-between p-3 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/30 rounded-xl">
                <div className="text-sm">
                  <div className="flex items-center gap-1.5">
                    <Snowflake className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <p className="font-semibold text-cyan-800 dark:text-cyan-300">Nel Freezer</p>
                  </div>
                  {frozenAt && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Congelato il:{" "}
                      {frozenAt.toDate().toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {frozenExpiryAt && (
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 font-medium">
                      Scadenza freezer:{" "}
                      {frozenExpiryAt.toDate().toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFreezePopup(true)}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 rounded-lg bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 transition-colors"
                >
                  Scongela
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl">
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-1.5">
                    <Snowflake className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Non congelato</p>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Estendi la conservazione congelando nel freezer
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFreezePopup(true)}
                  disabled={isSaving || quantity <= 0}
                  className="px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                >
                  Congela
                </button>
              </div>
            )}
          </div>

          {/* Stato Apertura (solo se non congelato) */}
          {!isFrozen && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
              {openedAt ? (
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-xl">
                  <div className="text-sm">
                    <p className="font-semibold text-green-800 dark:text-green-400">Prodotto Aperto</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Aperto il:{" "}
                      {openedAt.toDate().toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {openedExpiryAt && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Scadenza calcolata:{" "}
                        {openedExpiryAt.toDate().toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleResetOpened}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    Annulla apertura
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl">
                  <div className="flex-1 pr-3">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Non ancora aperto</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {shelfLifeDays
                        ? `Una volta aperto scadrà dopo ${shelfLifeDays} giorni`
                        : "Imposta una durata da aperto per tracciare l'apertura"}
                    </p>
                  </div>
                  {shelfLifeDays && (
                    <button
                      type="button"
                      onClick={handleOpenProduct}
                      disabled={isSaving || quantity <= 0}
                      className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 shrink-0"
                    >
                      Apri
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 shrink-0">
          <button
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors font-medium disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
            <span>Elimina</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 shadow-sm"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? "Salvataggio..." : "Salva Modifiche"}</span>
          </button>
        </div>
      </div>

      {/* Popup Congelamento / Scongelamento */}
      <FreezeProductPopup
        isOpen={showFreezePopup}
        onClose={() => setShowFreezePopup(false)}
        product={{
          ...product,
          isFrozen,
          productFrozenAt: frozenAt,
          productFrozenExpiryAt: frozenExpiryAt,
        }}
        onConfirmFreeze={handleConfirmFreeze}
        onConfirmUnfreeze={handleConfirmUnfreeze}
      />
    </div>
  );
}
