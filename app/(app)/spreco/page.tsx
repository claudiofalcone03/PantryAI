"use client";

import React, { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductHistoryByPantry, deleteProductHistoryLog } from "@/lib/firestore/productHistory";
import type { ProductHistoryLog } from "@/types/firestore/productHistoryType";
import { Leaf, AlertTriangle, TrendingUp, TrendingDown, X } from "lucide-react";
import { CardSkeleton } from "@/components/skeletons/CardSkeleton";

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
    fetchHistory();
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
        <header className="sticky top-0 z-10 px-4 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h1 className="text-2xl font-bold">Impatto Ambientale</h1>
        </header>
        <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton />
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">Impatto Ambientale</h1>
      </header>

      <main className="flex-1 p-4 w-full max-w-3xl mx-auto flex flex-col gap-6 mt-4">

        {/* Statistiche principali */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-xl text-green-600 dark:text-green-400">
                <Leaf className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-medium text-zinc-600 dark:text-zinc-400">CO₂ Evitata</h2>
            </div>
            <p className="text-4xl font-bold text-green-600 dark:text-green-500">
              {avoidedCO2.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xl font-normal text-zinc-500">Kg</span>
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-xl text-red-600 dark:text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-medium text-zinc-600 dark:text-zinc-400">CO₂ Sprecata</h2>
            </div>
            <p className="text-4xl font-bold text-red-600 dark:text-red-500">
              {wastedCO2.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xl font-normal text-zinc-500">Kg</span>
            </p>
          </div>
        </div>

        {/* Percentuale */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium mb-1">Efficienza Dispensa</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Percentuale di prodotti consumati</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold">{consumedPercentage}%</span>
            {consumedPercentage >= 80 ? (
              <TrendingUp className="w-6 h-6 text-green-500" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-500" />
            )}
          </div>
        </div>

        {/* Lista Recente */}
        <div>
          <h2 className="text-xl font-bold mb-4 mt-4">Storico Recente</h2>
          {history.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
              Nessun record trovato. Inizia a consumare o buttare prodotti per vedere le tue statistiche!
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {history.sort((a, b) => b.resolvedAt?.toMillis() - a.resolvedAt?.toMillis()).slice(0, 10).map((log) => (
                <div key={log.logId} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                  <div>
                    <h3 className="font-semibold text-base">{log.productName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-zinc-500">Quantità: {log.quantityHistory}</p>
                      {!!log.carbonFootprint && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">•</span>
                          <p className="text-xs text-zinc-500 flex items-center gap-1" title="Impronta carbonica">
                            <Leaf className="w-3 h-3 text-green-500" />
                            {((log.carbonFootprint * log.quantityHistory) >= 1000)
                              ? ((log.carbonFootprint * log.quantityHistory) / 1000).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Kg CO₂'
                              : (log.carbonFootprint * log.quantityHistory).toLocaleString('it-IT') + ' g CO₂'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${log.resolution === 'wasted' ? 'bg-red-50 text-red-600 border-red-200' :
                      log.resolution === 'rescued' ? 'bg-green-50 text-green-600 border-green-200' :
                        'bg-amber-50 text-amber-600 border-amber-200'
                      }`}>
                      {log.resolution === 'wasted' ? 'Sprecato' : log.resolution === 'rescued' ? 'Salvato!' : 'Consumato'}
                    </div>
                    <button
                      onClick={() => log.logId && handleDeleteLog(log.logId)}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                      title="Rimuovi dallo storico"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
