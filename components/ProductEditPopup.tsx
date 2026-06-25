"use client";

import React, { useState } from "react";
import { X, Trash2, Save, PackageOpen } from "lucide-react";
import type { Product } from "@/types/firestore/product";
import { updateProduct, deleteProduct } from "@/lib/firestore/products";
import { Timestamp } from "firebase/firestore";

interface ProductEditPopupProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onProductUpdated: () => void;
}

export function ProductEditPopup({ isOpen, onClose, product, onProductUpdated }: ProductEditPopupProps) {
  if (!isOpen || !product) return null;

  return (
    <ProductEditPopupContent
      key={product.productId ?? product.productName}
      product={product}
      onClose={onClose}
      onProductUpdated={onProductUpdated}
    />
  );
}

function ProductEditPopupContent({
  product,
  onClose,
  onProductUpdated,
}: {
  product: Product;
  onClose: () => void;
  onProductUpdated: () => void;
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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openedAt, setOpenedAt] = useState<Timestamp | null>(null);
  const [openedExpiryAt, setOpenedExpiryAt] = useState<Timestamp | null>(null);

  const [initialized] = useState(() => {
    setName(product.productName);
    setQuantity(product.productQuantity);
    setCategory(product.productCategory || "");
    setShelfLifeDays(product.shelfLifeDays ?? "");
    setOpenedAt(product.productOpenedAt || null);
    setOpenedExpiryAt(product.productOpenedExpiryAt || null);
    return true;
  });

  if (!initialized) return null;

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
        productCategory: category || undefined,
        shelfLifeDays: shelfLifeDays === "" ? null : Number(shelfLifeDays),
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Modifica Prodotto</h2>
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
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="es. Latticini"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Durata in frigo (giorni)</label>
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

          {/* Stato Apertura */}
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
                      : "Imposta una durata in frigo per tracciare l'apertura"}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
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
    </div>
  );
}
