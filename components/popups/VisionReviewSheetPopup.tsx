"use client";

import React, { useState } from "react";
import { X, Sparkles, Check, Calendar, Clock, ArrowRight, Layers } from "lucide-react";
import type { DetectedProductItem } from "@/lib/genkit/genkit";

interface VisionReviewSheetPopupProps {
  isOpen: boolean;
  onClose: () => void;
  detectedProducts: DetectedProductItem[];
  photoThumbnail?: string | null;
  onConfirmSelection: (selectedProducts: DetectedProductItem[]) => void;
}

export function VisionReviewSheetPopup({
  isOpen,
  onClose,
  detectedProducts,
  photoThumbnail,
  onConfirmSelection,
}: VisionReviewSheetPopupProps) {
  // Tracciamento indici selezionati con pattern di aggiornamento al cambio props
  const [prevProducts, setPrevProducts] = useState(detectedProducts);
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() =>
    detectedProducts.map((_, i) => i)
  );

  if (detectedProducts !== prevProducts) {
    setPrevProducts(detectedProducts);
    setSelectedIndices(detectedProducts.map((_, i) => i));
  }

  if (!isOpen || detectedProducts.length === 0) return null;

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleProceed = () => {
    const selected = detectedProducts.filter((_, i) => selectedIndices.includes(i));
    if (selected.length === 0) return;
    onConfirmSelection(selected);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full sm:max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-green-600 text-white rounded-2xl shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Alimenti Rilevati ({detectedProducts.length})
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Seleziona i cibi da aggiungere alla tua dispensa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {/* Miniatura Foto (se presente) */}
          {photoThumbnail && (
            <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-800 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoThumbnail}
                alt="Scatto analizzato"
                className="w-full h-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
                <span className="text-[11px] font-medium text-white/90 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
                  Scatto Smart Vision analizzato con Gemini
                </span>
              </div>
            </div>
          )}

          {/* Lista Checklist Prodotti */}
          <div className="space-y-2">
            {detectedProducts.map((item, idx) => {
              const isChecked = selectedIndices.includes(idx);
              return (
                <div
                  key={`${item.name}-${idx}`}
                  onClick={() => toggleSelect(idx)}
                  className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isChecked
                      ? "bg-green-50/70 border-green-300 dark:bg-green-950/30 dark:border-green-800 shadow-sm"
                      : "bg-zinc-50/50 border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800/80 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox rotonda */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                        isChecked
                          ? "bg-green-600 border-green-600 text-white shadow-sm"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {item.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {item.category}
                        </span>

                        {item.quantity > 1 && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            Quantità: {item.quantity}
                          </span>
                        )}

                        {item.expiryDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                            <Calendar className="w-3 h-3" />
                            <span>Scad. {item.expiryDate}</span>
                          </span>
                        )}

                        {!item.expiryDate && item.shelfLifeDays && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" />
                            <span>Stima: ~{item.shelfLifeDays} gg</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      {item.confidence === "high" ? "Alta confidenza" : "Rilevato"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Riprova scatto
          </button>

          <button
            type="button"
            disabled={selectedIndices.length === 0}
            onClick={handleProceed}
            className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-green-900/20 transition-all"
          >
            <Layers className="w-4 h-4" />
            <span>Procedi con {selectedIndices.length} {selectedIndices.length === 1 ? "prodotto" : "prodotti"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
