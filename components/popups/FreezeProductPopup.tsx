"use client";

import React, { useState } from "react";
import { Snowflake, X, Clock, Calendar, Check, AlertCircle, ArrowRight } from "lucide-react";
import type { Product } from "@/types/firestore/productType";

interface FreezeProductPopupProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onConfirmFreeze: (months: number, customDate?: Date) => Promise<void>;
  onConfirmUnfreeze: (mode: "consume_soon" | "restore_original", hours: number) => Promise<void>;
}

export function FreezeProductPopup({
  isOpen,
  onClose,
  product,
  onConfirmFreeze,
  onConfirmUnfreeze,
}: FreezeProductPopupProps) {
  const isAlreadyFrozen = Boolean(product.isFrozen);

  // Stati congelamento
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDateStr, setCustomDateStr] = useState<string>("");

  // Stati scongelamento
  const [unfreezeMode, setUnfreezeMode] = useState<"consume_soon" | "restore_original">("consume_soon");
  const [consumeHours, setConsumeHours] = useState<number>(48);

  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calcolo data stimata congelamento
  const estimatedDate = new Date();
  estimatedDate.setMonth(estimatedDate.getMonth() + selectedMonths);
  const estimatedDateFormatted = estimatedDate.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleFreezeSubmit = async () => {
    setLoading(true);
    try {
      let customDate: Date | undefined = undefined;
      if (useCustomDate && customDateStr) {
        customDate = new Date(customDateStr);
      }
      await onConfirmFreeze(selectedMonths, customDate);
      onClose();
    } catch (err: any) {
      alert("Errore congelamento: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleUnfreezeSubmit = async () => {
    setLoading(true);
    try {
      await onConfirmUnfreeze(unfreezeMode, consumeHours);
      onClose();
    } catch (err: any) {
      alert("Errore scongelamento: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isAlreadyFrozen
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                : "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800"
            }`}>
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {isAlreadyFrozen ? "Scongela Alimento" : "Conserva nel Freezer"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                {product.productName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {!isAlreadyFrozen ? (
            /* MODALITÀ: CONGELA */
            <>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Congelare un alimento ne blocca il deperimento e ne prolunga la scadenza. Scegli per quanto tempo intendi conservarlo nel freezer:
              </p>

              {/* Selettore mesi predefiniti */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Durata consigliata nel congelatore:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { m: 1, label: "1 mese" },
                    { m: 3, label: "3 mesi" },
                    { m: 6, label: "6 mesi" },
                    { m: 12, label: "1 anno" },
                  ].map(({ m, label }) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSelectedMonths(m);
                        setUseCustomDate(false);
                      }}
                      className={`py-2 px-1 text-xs font-medium rounded-xl border transition-all text-center ${
                        !useCustomDate && selectedMonths === m
                          ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                          : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:border-cyan-300"
                      }`}
                    >
                      {label}
                      {m === 3 && <span className="block text-[9px] opacity-80">(Standard)</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anteprima Nuova Scadenza */}
              <div className="p-3.5 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-2 text-cyan-900 dark:text-cyan-200 text-xs">
                  <Calendar className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>Nuova scadenza freezer stimata:</span>
                </div>
                <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                  {estimatedDateFormatted}
                </span>
              </div>
            </>
          ) : (
            /* MODALITÀ: SCONGELA */
            <>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Stai per scongelare questo alimento. Scegli come aggiornare la sua scadenza:
              </p>

              <div className="space-y-3">
                {/* Opzione 1: Consuma a breve */}
                <div
                  onClick={() => setUnfreezeMode("consume_soon")}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    unfreezeMode === "consume_soon"
                      ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-xs"
                      : "bg-gray-50 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        Consuma a breve (Consigliato per cibi freschi)
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Imposta l&apos;alimento come aperto con scadenza ravvicinata di {consumeHours} ore dal momento dello scongelamento.
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      unfreezeMode === "consume_soon"
                        ? "border-amber-600 bg-amber-600 text-white"
                        : "border-gray-300 dark:border-zinc-600"
                    }`}>
                      {unfreezeMode === "consume_soon" && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>

                  {unfreezeMode === "consume_soon" && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                      <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                        Consumare entro:
                      </span>
                      {[24, 48, 72].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConsumeHours(h);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors ${
                            consumeHours === h
                              ? "bg-amber-600 text-white"
                              : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                          }`}
                        >
                          {h === 24 ? "1 giorno (24h)" : h === 48 ? "2 giorni (48h)" : "3 giorni (72h)"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Opzione 2: Ripristina originale */}
                <div
                  onClick={() => setUnfreezeMode("restore_original")}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    unfreezeMode === "restore_original"
                      ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-xs"
                      : "bg-gray-50 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        Ripristina data di scadenza originale
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Rimuove il badge freezer e ripristina la data di scadenza riportata inizialmente sulla confezione.
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      unfreezeMode === "restore_original"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 dark:border-zinc-600"
                    }`}>
                      {unfreezeMode === "restore_original" && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            Annulla
          </button>
          {!isAlreadyFrozen ? (
            <button
              type="button"
              onClick={handleFreezeSubmit}
              disabled={loading}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Snowflake className="w-4 h-4" />
              <span>{loading ? "Salvataggio..." : "Congela nel Freezer"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUnfreezeSubmit}
              disabled={loading}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{loading ? "Scongelamento..." : "Conferma Scongelamento"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
