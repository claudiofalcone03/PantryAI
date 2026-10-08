"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  X,
  ChefHat,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { GeminiLiveClient } from "@/lib/audio/geminiLiveClient";
import { getGeminiLiveConfig, buildLiveChefPantryContext, type PantryContextProduct } from "@/lib/genkit/genkit";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry, getExpiringProductsByPantry } from "@/lib/firestore/products";

interface TranscriptMessage {
  id: string;
  speaker: "user" | "chef";
  text: string;
}

interface LiveVoiceChefBarProps {
  isOpen: boolean;
  onClose: () => void;
  systemContext?: string;
  title?: string;
}

export function LiveVoiceChefBar({
  isOpen,
  onClose,
  systemContext = "",
  title = "Chef Vocale Live",
}: LiveVoiceChefBarProps) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "speaking" | "listening">("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Beep di connessione audio
  const playChime = useCallback((type: "start" | "end") => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = type === "start" ? 659.25 : 329.63; // E5 vs E4
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio feedback facoltativo
    }
  }, []);

  // Gestione ciclo di vita WebSocket Live
  useEffect(() => {
    if (!isOpen) {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let localClient: GeminiLiveClient | null = null;

    async function initLiveSession() {
      setStatus("connecting");
      setErrorMessage("");

      try {
        const user = auth.currentUser;
        const idToken = user ? await user.getIdToken() : undefined;
        const config = await getGeminiLiveConfig(idToken);
        if (!isMounted) return;

        if (config.error) {
          setErrorMessage(config.error);
          setStatus("disconnected");
          return;
        }

        if (!config.apiKey) {
          setErrorMessage("Chiave Gemini API non configurata nel server.");
          setStatus("disconnected");
          return;
        }

        const client = new GeminiLiveClient(config.apiKey, config.model, {
          onStatusChange: (newStatus) => {
            if (!isMounted) return;
            setStatus(newStatus);
            if (newStatus === "connected") {
              playChime("start");
            }
          },
          onTranscript: (chunkText, speaker) => {
            if (!isMounted) return;
            setIsExpanded(true);
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === speaker) {
                const needsSpace =
                  !last.text.endsWith(" ") &&
                  !chunkText.startsWith(" ") &&
                  !chunkText.startsWith(",") &&
                  !chunkText.startsWith(".");
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + (needsSpace ? " " : "") + chunkText },
                ];
              }
              return [
                ...prev,
                {
                  id: `${speaker}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  speaker,
                  text: chunkText,
                },
              ];
            });
          },
          onError: (err) => {
            if (!isMounted) return;
            setErrorMessage(err);
          },
          onAudioLevel: (lvl) => {
            if (!isMounted) return;
            setAudioLevel(lvl);
          },
        });

        localClient = client;
        clientRef.current = client;

        // Recupera automaticamente il contesto reale della dispensa da Firestore
        let fullPantryContext = systemContext;
        if (user) {
          try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const pantryId = userDoc.data()?.userProfileCurrentPantryId;
            if (pantryId) {
              const [products, expiring] = await Promise.all([
                getProductsByPantry(pantryId),
                getExpiringProductsByPantry(pantryId, 7),
              ]);

              const expiringIds = new Set(expiring.map((p) => p.productId));
              const available = products.filter((p) => p.productQuantity > 0);

              const mappedProducts: PantryContextProduct[] = available.map((p) => {
                let expiryStr: string | undefined = undefined;
                if (p.expiryDateProduct) {
                  const anyDate = p.expiryDateProduct as unknown as { toDate?: () => Date };
                  expiryStr = anyDate.toDate ? anyDate.toDate().toLocaleDateString("it-IT") : String(p.expiryDateProduct);
                }
                return {
                  name: p.productName,
                  quantity: `${p.productQuantity} ${p.productUnitOfMeasure || ""}`.trim(),
                  category: p.productCategory,
                  expiryDate: expiryStr,
                  isExpiringSoon: expiringIds.has(p.productId),
                };
              });

              fullPantryContext = await buildLiveChefPantryContext(mappedProducts, systemContext);
            }
          } catch (ctxErr) {
            console.warn("Avviso recupero prodotti dispensa per Chef Vocale:", ctxErr);
          }
        }

        await client.connect(fullPantryContext);
      } catch (err) {
        if (!isMounted) return;
        console.error("Errore inizializzazione Live Chef:", err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Impossibile collegarsi allo Chef Vocale Live."
        );
        setStatus("disconnected");
      }
    }

    initLiveSession();

    return () => {
      isMounted = false;
      if (localClient) {
        localClient.disconnect();
      }
      clientRef.current = null;
    };
  }, [isOpen, systemContext, retryTrigger, playChime]);

  // Scroll automatico transcript
  useEffect(() => {
    if (isExpanded && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [transcripts, isExpanded]);

  const handleToggleMute = () => {
    if (!clientRef.current) return;
    const nextMuted = !isMuted;
    clientRef.current.setMute(nextMuted);
    setIsMuted(nextMuted);
  };

  const handleClose = () => {
    playChime("end");
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus("disconnected");
    onClose();
  };

  const handleRetry = () => {
    setRetryTrigger((c) => c + 1);
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Chef Vocale Live"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-20 left-1/2 -translate-x-1/2 z-[55] w-[94%] max-w-lg transition-all duration-300 ease-out"
    >
      {/* Drawer Trascrizione Espandibile */}
      {isExpanded && (
        <div className="mb-2 bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl text-white max-h-72 overflow-y-auto flex flex-col gap-2.5 transition-all">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">
                Dialogo in tempo reale
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Comprimi trascrizione"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={chatScrollRef}
            className="flex flex-col gap-2 overflow-y-auto pr-1 text-sm max-h-52"
          >
            {transcripts.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Parla liberamente. Lo Chef ti risponderà all&apos;istante a voce.
              </p>
            ) : (
              transcripts.map((t) => (
                <div
                  key={t.id}
                  className={`flex flex-col ${
                    t.speaker === "chef" ? "items-start" : "items-end"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      t.speaker === "chef"
                        ? "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-sm"
                        : "bg-emerald-600 text-white rounded-tr-sm"
                    }`}
                  >
                    <span className="block text-[10px] font-bold opacity-60 mb-0.5 uppercase tracking-wider">
                      {t.speaker === "chef" ? "Chef AI" : "Tu"}
                    </span>
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Pill Bar Compatta Principale */}
      <div className="bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-white/15 rounded-full px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-3 text-white">
        {/* Sinistra: Avatar e Stato */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                if (status === "speaking") {
                  clientRef.current?.stopCurrentAudioPlayback();
                }
              }}
              disabled={status !== "speaking"}
              title={status === "speaking" ? "Tocca per interrompere la risposta dello Chef" : title}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                status === "speaking"
                  ? "bg-indigo-600 ring-4 ring-indigo-400/30 animate-pulse cursor-pointer hover:bg-indigo-500 active:scale-95"
                  : status === "listening"
                  ? "bg-emerald-600 ring-4 ring-emerald-400/30"
                  : status === "connecting"
                  ? "bg-amber-600"
                  : "bg-slate-700"
              }`}
            >
              {status === "connecting" ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : status === "speaking" ? (
                <Volume2 className="w-5 h-5 text-white" />
              ) : (
                <ChefHat className="w-5 h-5 text-white" />
              )}
            </button>

            {/* Indicator Led */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                status === "speaking"
                  ? "bg-indigo-400 animate-ping"
                  : status === "listening"
                  ? "bg-emerald-400"
                  : status === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold truncate text-slate-100">
                {title}
              </span>
              {isMuted && (
                <span className="text-[10px] bg-red-500/20 text-red-300 font-semibold px-1.5 py-0.2 rounded-full border border-red-500/30">
                  Muto
                </span>
              )}
            </div>

            {/* Equalizzatore & Feedback */}
            <div className="flex items-center gap-2">
              {errorMessage ? (
                <span className="text-[11px] text-red-400 truncate flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errorMessage}
                </span>
              ) : status === "speaking" ? (
                <span className="text-[11px] text-indigo-300 font-medium animate-pulse flex items-center gap-1">
                  <span>Lo Chef sta parlando</span>
                  <span className="flex gap-0.5 items-end h-2.5">
                    <span className="w-0.5 h-full bg-indigo-400 animate-bounce" />
                    <span className="w-0.5 h-2/3 bg-indigo-400 animate-bounce delay-75" />
                    <span className="w-0.5 h-full bg-indigo-400 animate-bounce delay-150" />
                  </span>
                </span>
              ) : status === "listening" ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-emerald-400 font-medium">
                    In ascolto
                  </span>
                  {/* Waveform reattiva al volume microfono */}
                  <div className="flex items-center gap-0.5 h-3">
                    {[0.3, 0.6, 1.0, 0.7, 0.4].map((multiplier, i) => {
                      const dynamicH = Math.max(
                        3,
                        Math.min(12, Math.round(audioLevel * 14 * multiplier))
                      );
                      return (
                        <div
                          key={i}
                          className="w-0.5 bg-emerald-400 rounded-full transition-all duration-75"
                          style={{ height: `${dynamicH}px` }}
                        />
                      );
                    })}
                  </div>
                  {!isExpanded && transcripts.length > 0 && (
                    <span className="text-[10px] text-slate-300/80 truncate max-w-[130px] sm:max-w-[200px] border-l border-white/10 pl-2">
                      {transcripts[transcripts.length - 1].speaker === "chef" ? "Chef: " : "Tu: "}
                      {transcripts[transcripts.length - 1].text}
                    </span>
                  )}
                </div>
              ) : status === "connecting" ? (
                <span className="text-[11px] text-amber-300">
                  Connessione in corso...
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Non attivo</span>
              )}
            </div>
          </div>
        </div>

        {/* Destra: Bottoni di controllo */}
        <div className="flex items-center gap-1">
          {errorMessage && (
            <button
              type="button"
              onClick={handleRetry}
              className="p-2 rounded-full bg-red-600/20 text-red-300 hover:bg-red-600/30 transition-colors"
              title="Riprova connessione"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Mute / Unmute */}
          <button
            type="button"
            onClick={handleToggleMute}
            disabled={status === "connecting" || !!errorMessage}
            className={`p-2 rounded-full transition-colors ${
              isMuted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
            title={isMuted ? "Riattiva microfono" : "Disattiva microfono"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Trascrizione toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-full transition-colors ${
              isExpanded
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/10 text-slate-200 hover:bg-white/20"
            }`}
            title={isExpanded ? "Comprimi trascrizione" : "Espandi trascrizione"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          {/* Disconnetti / Chiudi */}
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full bg-white/10 text-slate-300 hover:bg-red-600/80 hover:text-white transition-colors"
            title="Chiudi sessione Chef Vocale"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
