"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductHistoryByPantry, deleteProductHistoryLog } from "@/lib/firestore/productHistory";
import type { ProductHistoryLog } from "@/types/firestore/productHistoryType";
import { Leaf, AlertTriangle, TrendingUp, TrendingDown, X } from "lucide-react";
import { CardSkeleton, Skeleton, MobileProfileButton } from "@/components";

export default function SprecoPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ProductHistoryLog[]>([]);
  const [currentPantryId, setCurrentPantryId] = useState<string>("");

  const fetchHistory = React.useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data();
      const pantryId = userData?.userProfileCurrentPantryId;

      if (!pantryId) {
        setLoading(false);
        return;
      }

      setCurrentPantryId(pantryId);
      const fetchedHistory = await getProductHistoryByPantry(pantryId);
      setHistory(fetchedHistory);
    } catch (error) {
      console.error("Errore caricamento storico:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (mounted) {
        await fetchHistory();
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchHistory]);

  const handleDeleteLog = async (logId: string) => {
    if (!currentPantryId) return;
    try {
      await deleteProductHistoryLog(currentPantryId, logId);
      setHistory(prev => prev.filter(log => log.logId !== logId));
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
    }
  };

  // Calcoli delle statistiche
  const avoidedCO2 = history
    .filter(log => log.resolution === 'rescued')
    .reduce((acc, log) => acc + (log.carbonFootprint || 0) * log.quantityHistory, 0) / 1000;

  const wastedCO2 = history
    .filter(log => log.resolution === 'wasted')
    .reduce((acc, log) => acc + (log.carbonFootprint || 0) * log.quantityHistory, 0) / 1000;

  const totalActions = history.length;
  const consumedCount = history.filter(log => log.resolution === 'consumed' || log.resolution === 'rescued').length;
  const consumedPercentage = totalActions === 0 ? 0 : Math.round((consumedCount / totalActions) * 100);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <header className="px-4 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 w-full max-w-6xl mx-auto flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-7 w-40 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Mobile TopBar */}
      <div className="md:hidden shrink-0">
        <header className="sticky top-0 z-10 px-4 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <Leaf className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold">Spreco & CO₂</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
              {totalActions} record
            </span>
            <MobileProfileButton />
          </div>
        </header>
      </div>

      {/* Desktop Header coerente con /inventario - PERMANENTEMENTE ANCORATO: shrink-0 */}
      <header className="hidden md:flex items-center justify-between py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Impatto Ambientale & CO₂
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                {totalActions} eventi registrati
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Analitica dei cibi salvati dallo spreco, impronta carbonica evitata ed efficienza dei consumi.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 w-full max-w-6xl mx-auto flex flex-col gap-6">
        {/* Griglia 3 KPI Principali su Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: CO₂ Evitata */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                  <Leaf className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  Impatto Positivo
                </span>
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                CO₂ Evitata
              </h2>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {avoidedCO2.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </p>
                <span className="text-base font-semibold text-zinc-500">Kg CO₂</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              Emissioni risparmiate consumando i cibi in tempo
            </p>
          </div>

          {/* KPI 2: CO₂ Sprecata */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 rounded-2xl text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                  Da Ridurre
                </span>
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                CO₂ Sprecata
              </h2>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl sm:text-4xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                  {wastedCO2.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                </p>
                <span className="text-base font-semibold text-zinc-500">Kg CO₂</span>
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              Impronta di prodotti scaduti o scartati
            </p>
          </div>

          {/* KPI 3: Efficienza Dispensa */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-3xl p-5 sm:p-6 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-teal-100 dark:bg-teal-950/60 rounded-2xl text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50">
                  {consumedPercentage >= 80 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    consumedPercentage >= 80
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60"
                  }`}
                >
                  {consumedPercentage >= 80 ? "Ottimo" : "Migliorabile"}
                </span>
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                Efficienza Dispensa
              </h2>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {consumedPercentage}%
                </p>
                <span className="text-xs text-zinc-500">
                  ({consumedCount}/{totalActions} consumati)
                </span>
              </div>
              {/* Barra di avanzamento grafica */}
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, consumedPercentage))}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              Percentuale di alimenti consumati rispetto al totale
            </p>
          </div>
        </div>

        {/* Sezione Storico Recente */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Storico Recente
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Registro cronologico delle azioni effettuate sugli alimenti
              </p>
            </div>
            {history.length > 0 && (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Ultimi {Math.min(history.length, 12)} eventi
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-2xl">
                🌱
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                Nessun evento registrato
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm mx-auto">
                Inizia a consumare, salvare o rimuovere prodotti dalla dispensa per visualizzare qui le metriche del tuo impatto.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
              {history
                .sort((a, b) => (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0))
                .slice(0, 12)
                .map((log) => {
                  const carbonKg =
                    log.carbonFootprint && log.quantityHistory
                      ? (log.carbonFootprint * log.quantityHistory) / 1000
                      : null;

                  return (
                    <div
                      key={log.logId}
                      className="flex items-center justify-between p-3.5 sm:p-4 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
                          {log.productName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            Qtà: {log.quantityHistory}
                          </span>
                          {carbonKg !== null && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">•</span>
                              <span
                                className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium"
                                title="Impronta carbonica"
                              >
                                <Leaf className="w-3 h-3 text-emerald-500 shrink-0" />
                                {carbonKg >= 1
                                  ? `${carbonKg.toLocaleString("it-IT", {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 2,
                                    })} Kg CO₂`
                                  : `${(log.carbonFootprint! * log.quantityHistory).toLocaleString(
                                      "it-IT"
                                    )} g CO₂`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            log.resolution === "wasted"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60"
                              : log.resolution === "rescued"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {log.resolution === "wasted"
                            ? "Sprecato"
                            : log.resolution === "rescued"
                            ? "Salvato!"
                            : "Consumato"}
                        </span>
                        <button
                          onClick={() => log.logId && handleDeleteLog(log.logId)}
                          className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                          title="Rimuovi dallo storico"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
