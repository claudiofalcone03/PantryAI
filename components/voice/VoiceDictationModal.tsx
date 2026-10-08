"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Mic, MicOff, Loader2, Sparkles, Check, RefreshCw, Plus, Minus } from "lucide-react";
import {
  transcribeAndParseVoiceInput,
  type ParsedVoiceItem,
  type ExistingPantryProduct,
  type VoiceActionType,
} from "@/lib/genkit/genkit";

interface VoiceDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  contextMode: "shopping_list" | "inventory" | "chat_message";
  pantryCategories?: string[];
  existingProducts?: ExistingPantryProduct[];
  onItemsParsed?: (items: ParsedVoiceItem[], rawTranscript: string) => void;
  onTranscriptReady?: (transcript: string) => void;
}

export function VoiceDictationModal({
  isOpen,
  onClose,
  title,
  contextMode,
  pantryCategories,
  existingProducts,
  onItemsParsed,
  onTranscriptReady,
}: VoiceDictationModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedVoiceItem[]>([]);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sintesi audio Beep
  const playBeep = useCallback((freq = 880, durationMs = 100) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn("Audio feedback error:", e);
    }
  }, []);

  const triggerHaptic = useCallback((duration = 100) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, []);

  // Arresta registrazione e ripulisce stream
  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  // Avvio manuale registrazione microfono (es. pulsante "Riprova")
  const startRecording = useCallback(async () => {
    cleanupStream();
    setErrorMessage("");
    setParsedItems([]);
    setTranscript("");
    setRecordSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          mimeType = "";
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        playBeep(950, 100);
        triggerHaptic(100);

        timerRef.current = setInterval(() => {
          setRecordSeconds((s) => s + 1);
        }, 1000);
      };

      recorder.start(250);
    } catch (err) {
      console.error("Errore accesso microfono:", err);
      setErrorMessage("Impossibile accedere al microfono. Verifica i permessi del browser.");
      setIsRecording(false);
    }
  }, [cleanupStream, playBeep, triggerHaptic]);

  // Arresto registrazione ed invio a Gemini
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

    playBeep(650, 120);
    triggerHaptic(120);
    setIsRecording(false);
    setIsProcessing(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        // Converti Blob in base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string) || "";

          // Invio a Gemini Transcribe / NLP con prodotti esistenti
          const result = await transcribeAndParseVoiceInput(
            base64Data,
            recorder.mimeType || "audio/webm",
            contextMode,
            pantryCategories,
            existingProducts
          );

          setIsProcessing(false);
          cleanupStream();

          if (result.success) {
            setTranscript(result.rawTranscript);
            if (contextMode === "chat_message") {
              if (onTranscriptReady && result.rawTranscript) {
                onTranscriptReady(result.rawTranscript);
                onClose();
              }
            } else if (result.items && result.items.length > 0) {
              setParsedItems(result.items);
            } else {
              setErrorMessage("Nessun alimento identificato chiaramente nella registrazione.");
            }
          } else {
            setErrorMessage("Errore durante la trascrizione vocale con Gemini. Riprova.");
          }
        };
      } catch (err) {
        console.error("Errore processamento audio:", err);
        setIsProcessing(false);
        setErrorMessage("Errore durante l'elaborazione dell'audio.");
        cleanupStream();
      }
    };

    recorder.stop();
  }, [cleanupStream, contextMode, onClose, onTranscriptReady, pantryCategories, existingProducts, playBeep, triggerHaptic]);

  // Auto-avvio all'apertura del modale
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        let mimeType = "audio/webm;codecs=opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          } else {
            mimeType = "";
          }
        }

        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstart = () => {
          if (!isMounted) return;
          setIsRecording(true);
          playBeep(950, 100);
          triggerHaptic(100);

          timerRef.current = setInterval(() => {
            setRecordSeconds((s) => s + 1);
          }, 1000);
        };

        recorder.start(250);
      } catch (err) {
        if (!isMounted) return;
        console.error("Errore accesso microfono:", err);
        setErrorMessage("Impossibile accedere al microfono. Verifica i permessi del browser.");
      }
    }

    initAudio();

    return () => {
      isMounted = false;
      cleanupStream();
    };
  }, [isOpen, cleanupStream, playBeep, triggerHaptic]);

  const handleClose = () => {
    cleanupStream();
    setIsRecording(false);
    setIsProcessing(false);
    setErrorMessage("");
    setParsedItems([]);
    setTranscript("");
    setRecordSeconds(0);
    onClose();
  };

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleConfirmItems = () => {
    if (onItemsParsed && parsedItems.length > 0) {
      onItemsParsed(parsedItems, transcript);
      handleClose();
    }
  };

  // Toggle tra le azioni disponibili per l'alimento
  const toggleItemAction = (index: number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const actionCycle: VoiceActionType[] = [
          "update_quantity",
          "open_item",
          "freeze_item",
          "unfreeze_item",
          "consume_item",
          "add_to_shopping_list",
          "create_new",
        ];
        const currentIdx = actionCycle.indexOf(item.action);
        const nextAction = actionCycle[(currentIdx + 1) % actionCycle.length];
        return {
          ...item,
          action: nextAction,
          newTotalQuantity:
            nextAction === "update_quantity"
              ? (item.existingQuantity ?? 0) + item.quantity
              : item.quantity,
        };
      })
    );
  };

  // Regolazione rapida quantità (+1 / -1)
  const adjustItemQuantity = (index: number, delta: number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const newQty = Math.max(1, Math.min(999, item.quantity + delta));
        return {
          ...item,
          quantity: newQty,
          newTotalQuantity:
            item.action === "update_quantity"
              ? (item.existingQuantity ?? 0) + newQty
              : newQty,
        };
      })
    );
  };

  const updateCount = parsedItems.filter((i) => i.action === "update_quantity").length;
  const newCount = parsedItems.filter((i) => i.action !== "update_quantity").length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {title || (contextMode === "shopping_list" ? "Dettatura Spesa" : contextMode === "inventory" ? "Dettatura Dispensa" : "Messaggio Vocale")}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Alimentato da Gemini Transcribe & NLP
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Modal */}
        <div className="p-6 flex flex-col items-center justify-center text-center">
          {errorMessage && (
            <div className="w-full mb-4 p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Stato Registrazione o Elaborazione */}
          {!parsedItems.length && (
            <div className="my-4 flex flex-col items-center">
              {/* Onde animate microfono */}
              <div className="relative flex items-center justify-center w-28 h-28 my-2">
                {isRecording && (
                  <>
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
                    <div className="absolute w-24 h-24 rounded-full bg-emerald-500/30 animate-pulse" />
                  </>
                )}

                {isProcessing ? (
                  <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600 shadow-red-500/30 scale-105"
                        : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </button>
                )}
              </div>

              {/* Timer e Istruzione */}
              {isRecording && (
                <div className="mt-3">
                  <span className="text-xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {formatTimer(recordSeconds)}
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Parla ora... tocca per fermare quando hai finito
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Elaborazione audio con Gemini...
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Trascrizione, confronto dispensa ed estrazione in corso
                  </p>
                </div>
              )}

              {!isRecording && !isProcessing && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Tocca il microfono per riprovare a parlare
                </button>
              )}
            </div>
          )}

          {/* Anteprima Risultati Estratti */}
          {parsedItems.length > 0 && (
            <div className="w-full text-left space-y-3">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Trascrizione Vocale
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 italic">
                  &ldquo;{transcript}&rdquo;
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center justify-between">
                  <span>Alimenti Rilevati ({parsedItems.length})</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {parsedItems.length === 1 ? "1 comando" : `${parsedItems.length} comandi`}
                  </span>
                </p>

                <div className="max-h-60 overflow-y-auto space-y-2.5 p-1">
                  {parsedItems.map((item, idx) => {
                    const actionBadge = (() => {
                      switch (item.action) {
                        case "open_item":
                          return {
                            label: "📦 Segna come aperto",
                            color: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300/60 dark:border-blue-700/60",
                            container: "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60",
                          };
                        case "freeze_item":
                          return {
                            label: `❄️ Congela in freezer (${item.monthsDuration || 3}m)`,
                            color: "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-300/60 dark:border-cyan-700/60",
                            container: "bg-cyan-50/40 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/60",
                          };
                        case "unfreeze_item":
                          return {
                            label: "☀️ Scongela per consumo",
                            color: "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border-orange-300/60 dark:border-orange-700/60",
                            container: "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/60",
                          };
                        case "consume_item":
                          return {
                            label: `🍽️ Consuma (-${item.quantity})`,
                            color: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300/60 dark:border-purple-700/60",
                            container: "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60",
                          };
                        case "add_to_shopping_list":
                          return {
                            label: "🛒 Aggiungi alla spesa",
                            color: "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300/60 dark:border-sky-700/60",
                            container: "bg-sky-50/40 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60",
                          };
                        case "update_quantity":
                          return {
                            label: `🔄 Già in dispensa (${item.existingQuantity} → ${item.newTotalQuantity})`,
                            color: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-700/60",
                            container: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60",
                          };
                        default:
                          return {
                            label: "✨ Nuovo alimento (dispensa)",
                            color: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300/60 dark:border-amber-700/60",
                            container: "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700",
                          };
                      }
                    })();

                    return (
                      <div
                        key={`${item.name}-${idx}`}
                        className={`p-3 rounded-2xl border transition-all ${actionBadge.container}`}
                      >
                        {/* Badge di Riconoscimento */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionBadge.color}`}
                          >
                            {actionBadge.label}
                          </span>

                          {item.matchedProductId && (
                            <button
                              type="button"
                              onClick={() => toggleItemAction(idx)}
                              className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
                            >
                              Cambia azione
                            </button>
                          )}
                        </div>

                        {/* Nome e Controlli Quantità */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {item.matchedProductName || item.name}
                            </p>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {item.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-1.5 py-0.5">
                            <button
                              type="button"
                              onClick={() => adjustItemQuantity(idx, -1)}
                              disabled={item.quantity <= 1}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30"
                              title="Diminuisci quantità"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold min-w-5 text-center text-zinc-900 dark:text-zinc-100">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustItemQuantity(idx, 1)}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              title="Aumenta quantità"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Azioni di Conferma */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Riprova
                </button>
                <button
                  type="button"
                  onClick={handleConfirmItems}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-green-900/20 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Conferma comandi ({parsedItems.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
