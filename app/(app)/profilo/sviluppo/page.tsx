"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  Bot,
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Terminal,
  Database,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Server,
  Zap
} from "lucide-react";
import type { UserProfile } from "@/types/firestore/userProfileType";
import { rotateUserMcpToken, revokeUserMcpToken } from "@/lib/firestore/userProfile";
import { getPendingMutations, clearAllPendingMutations, getCachedProducts, getCachedShoppingItems } from "@/lib/offline/indexedDb";
import { syncOfflineMutations } from "@/lib/offline/syncManager";

export default function DevToolsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [showMcpToken, setShowMcpToken] = useState<boolean>(false);
  const [mcpLoading, setMcpLoading] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);

  // Stato Debug Offline
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [cachedProdCount, setCachedProdCount] = useState<number>(0);
  const [cachedShopCount, setCachedShopCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Stato Test Firestore
  const [firestoreStatus, setFirestoreStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.uid);

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setMcpToken(data.mcpToken || null);
          const pId = data.userProfileCurrentPantryId || "";
          setCurrentPantryId(pId);

          if (pId) {
            const [prods, items, mutations] = await Promise.all([
              getCachedProducts(pId),
              getCachedShoppingItems(pId),
              getPendingMutations(),
            ]);
            setCachedProdCount(prods.length);
            setCachedShopCount(items.length);
            setPendingCount(mutations.length);
          }
        }
      } catch (err) {
        console.error("Errore fetch dev data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevData();
  }, []);

  // Gestione Token MCP
  const handleRotateMcpToken = async () => {
    if (!userId) return;
    const confirmMsg = mcpToken
      ? "Generare un nuovo Token MCP invaliderà quello attualmente configurato in Antigravity. Vuoi continuare?"
      : "Vuoi generare il tuo Token Personale MCP per connettere PantryAI ad Antigravity?";
    if (!window.confirm(confirmMsg)) return;

    setMcpLoading(true);
    try {
      const newToken = await rotateUserMcpToken(userId);
      setMcpToken(newToken);
      setShowMcpToken(true);
    } catch (error: any) {
      console.error("Errore rotazione token MCP:", error);
      alert("Impossibile generare il token MCP: " + error.message);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleRevokeMcpToken = async () => {
    if (!userId) return;
    if (!window.confirm("Vuoi davvero revocare il tuo Token MCP? Antigravity non potrà più accedere alla tua dispensa finché non ne generi uno nuovo.")) {
      return;
    }

    setMcpLoading(true);
    try {
      await revokeUserMcpToken(userId);
      setMcpToken(null);
      setShowMcpToken(false);
    } catch (error: any) {
      console.error("Errore revoca token MCP:", error);
      alert("Impossibile revocare il token MCP: " + error.message);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleCopyMcpToken = () => {
    if (!mcpToken) return;
    navigator.clipboard.writeText(mcpToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyMcpConfig = () => {
    if (!mcpToken) return;
    const runnerPath = "/Users/claudio/Documents/GitHub/PantryAI/scripts/mcp-server.cjs";
    const snippet = {
      "pantry-ai": {
        command: "node",
        args: [runnerPath],
        env: {
          PANTRY_MCP_TOKEN: mcpToken,
        },
      },
    };
    navigator.clipboard.writeText(JSON.stringify(snippet, null, 2));
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  // Test rapido connessione Firestore
  const handleTestFirestore = async () => {
    setFirestoreStatus("testing");
    setFirestoreError(null);
    try {
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) {
        setFirestoreStatus("ok");
      } else {
        setFirestoreStatus("error");
        setFirestoreError("Documento utente non trovato su Firestore.");
      }
    } catch (e: any) {
      setFirestoreStatus("error");
      setFirestoreError(e?.message || "Errore di connessione a Cloud Firestore.");
    }
  };

  // Sincronizzazione forzata IndexedDB
  const handleForceSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncOfflineMutations();
      const remaining = await getPendingMutations();
      setPendingCount(remaining.length);
      setSyncFeedback(`Sincronizzate ${res.synced} modifiche con successo. Fallite: ${res.failed}.`);
    } catch (err: any) {
      setSyncFeedback("Errore durante la sincronizzazione: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearOfflineQueue = async () => {
    if (!window.confirm("Vuoi davvero svuotare la coda delle mutazioni offline non sincronizzate?")) return;
    await clearAllPendingMutations();
    setPendingCount(0);
    setSyncFeedback("Coda offline svuotata.");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 pb-16">
      {/* Top Bar con Tasto Indietro */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Torna al Profilo</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <Code2 className="w-3 h-3" />
              Dev & MCP Suite
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Strumenti Sviluppatore & Integrazioni
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configurazione del server MCP per Antigravity, diagnostica database e strumenti di debug offline.
          </p>
        </div>

        {/* 1. SEZIONE SERVER MCP ANTIGRAVITY */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                  Server MCP PantryAI per Antigravity
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    JSON-RPC 2.0
                  </span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Consente all&apos;assistente AI di interagire con inventario, spesa e ricette.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {mcpToken ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-purple-500" />
                      Il tuo Token Personale MCP:
                    </span>
                    <button
                      onClick={() => setShowMcpToken(!showMcpToken)}
                      className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      {showMcpToken ? (
                        <>
                          <EyeOff className="w-3 h-3" /> Nascondi
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" /> Mostra
                        </>
                      )}
                    </button>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showMcpToken ? "text" : "password"}
                      readOnly
                      value={mcpToken}
                      className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none select-all"
                    />
                    <button
                      onClick={handleCopyMcpToken}
                      disabled={mcpLoading}
                      className="px-3 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                      title="Copia Token"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedToken ? "Copiato!" : "Copia"}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                      Configura il server in Antigravity aggiungendo questo blocco in{" "}
                      <code className="font-mono bg-purple-100/60 dark:bg-purple-900/40 px-1 py-0.5 rounded text-[10px]">
                        ~/.gemini/config/mcp_config.json
                      </code>:
                    </p>
                    <button
                      onClick={handleCopyMcpConfig}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-medium transition-colors shrink-0 flex items-center gap-1 shadow-xs"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedConfig ? "Config Copiata!" : "Copia JSON"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    onClick={handleRotateMcpToken}
                    disabled={mcpLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${mcpLoading ? "animate-spin" : ""}`} />
                    <span>Rigenera Token</span>
                  </button>
                  <button
                    onClick={handleRevokeMcpToken}
                    disabled={mcpLoading}
                    className="py-2 px-3 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Revoca
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Genera una chiave di autenticazione per consentire ad Antigravity di accedere e gestire la tua dispensa.
                </p>
                <button
                  onClick={handleRotateMcpToken}
                  disabled={mcpLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  <Key className="w-4 h-4" />
                  <span>{mcpLoading ? "Generazione in corso..." : "Genera Token Personale MCP"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. SEZIONE DIAGNOSTICA OFFLINE & INDEXEDDB */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                Stato Cache Locale & Coda Offline (IndexedDB)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verifica i dati persistiti sul dispositivo per il funzionamento offline.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200/70 dark:border-zinc-700/60 text-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white block">{cachedProdCount}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Prodotti in Cache</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200/70 dark:border-zinc-700/60 text-center">
                <span className="text-xl font-bold text-gray-900 dark:text-white block">{cachedShopCount}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Spesa in Cache</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200/70 dark:border-zinc-700/60 text-center">
                <span className={`text-xl font-bold block ${pendingCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
                  {pendingCount}
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Mutazioni in Coda</span>
              </div>
            </div>

            {syncFeedback && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-xl text-xs">
                {syncFeedback}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={handleForceSync}
                disabled={isSyncing || pendingCount === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>Sincronizza Coda Offline Ora</span>
              </button>

              <button
                onClick={handleClearOfflineQueue}
                disabled={pendingCount === 0}
                className="py-2 px-3 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Svuota Coda
              </button>
            </div>
          </div>
        </div>

        {/* 3. SEZIONE DIAGNOSTICA FIRESTORE & AMBIENTE */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                Diagnostica Connessione Cloud Firestore
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Verifica lo stato di lettura e le regole di sicurezza della sessione.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-200/70 dark:border-zinc-700/60">
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">Progetto Firebase</p>
                <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">pantryai-cee9e</p>
              </div>
              <button
                onClick={handleTestFirestore}
                disabled={firestoreStatus === "testing"}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {firestoreStatus === "testing" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>Esegui Test Connessione</span>
              </button>
            </div>

            {firestoreStatus === "ok" && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Connessione a Cloud Firestore attiva e funzionante! Lettura documento utente completata.</span>
              </div>
            )}

            {firestoreStatus === "error" && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{firestoreError || "Errore durante il test di connessione."}</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
