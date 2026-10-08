"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { subscribeToSyncStatus, syncOfflineMutations } from "@/lib/offline/syncManager";
import { getPendingMutations } from "@/lib/offline/indexedDb";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showSyncedSuccess, setShowSyncedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    // Controlla subito se ci sono mutazioni in sospeso
    getPendingMutations().then((m) => setPendingCount(m.length));

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineMutations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      getPendingMutations().then((m) => setPendingCount(m.length));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = subscribeToSyncStatus((status) => {
      setIsSyncing(status.isSyncing);
      setPendingCount(status.pendingCount);

      if (!status.isSyncing && status.lastSyncedAt && status.pendingCount === 0) {
        setShowSyncedSuccess(true);
        const timer = setTimeout(() => setShowSyncedSuccess(false), 3500);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  // Se siamo online e non c'è nulla da segnalare, non renderizzare nulla
  if (isOnline && !isSyncing && !showSyncedSuccess && pendingCount === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300 z-50 select-none ${
        !isOnline
          ? "bg-amber-500/90 text-amber-950 dark:bg-amber-600/90 dark:text-amber-100 shadow-sm backdrop-blur-xs"
          : isSyncing
          ? "bg-blue-500/90 text-blue-950 dark:bg-blue-600/90 dark:text-blue-100 backdrop-blur-xs"
          : "bg-emerald-600/90 text-white backdrop-blur-xs"
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span>
            <strong>Modalità offline attiva:</strong> le modifiche vengono salvate sul dispositivo
            {pendingCount > 0 ? ` (${pendingCount} in attesa)` : ""}.
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>
            Riconnesso: sincronizzazione modifiche in corso... ({pendingCount} rimaste)
          </span>
        </>
      ) : showSyncedSuccess ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Sincronizzazione completata con successo! Dati aggiornati.</span>
        </>
      ) : null}
    </div>
  );
}
