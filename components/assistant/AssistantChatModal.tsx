"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Trash2,
  CheckCircle2,
  PackagePlus,
  Edit3,
  Snowflake,
  Flame,
  ShoppingCart,
  Loader2,
  Check,
  ChefHat,
  PackageOpen,
  Heart,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  subscribeAssistantMessages,
  sendUserAssistantMessage,
  saveAssistantReply,
  updateProposedActionStatus,
  clearAssistantChat,
} from "@/lib/firestore/assistantChat";
import {
  addProduct,
  updateProduct,
  openProduct,
  freezeProduct,
  unfreezeProduct,
  consumeProduct,
  getProductsByPantry,
} from "@/lib/firestore/products";
import { addRawItemToShoppingList } from "@/lib/firestore/shoppingList";
import {
  chatWithPantryCopilot,
  chatWithMemorySpecialist,
  transcribeAndParseVoiceInput,
} from "@/lib/genkit/genkit";
import type { PantryCopilotContext } from "@/lib/genkit/types";
import { findPantryMatch } from "@/lib/utils/ingredientMatcher";
import {
  getDietaryPreferences,
  getMemoryFacts,
  addMemoryFact,
  formatUserDietAndMemoryContext,
  learnMemoryFromUserMessage,
} from "@/lib/firestore/userMemory";
import type { AssistantMessage, ProposedAction, AssistantErrorDetails } from "@/types/assistant/assistantType";
import type { Product } from "@/types/firestore/productType";
import { Timestamp, doc, getDoc } from "firebase/firestore";

/**
 * Pre-analizzatore client-side ultra rapido (<1ms).
 * Rileva se il messaggio esprime un gusto, un'intolleranza o una preferenza personale
 * per instradarlo al Subagente Memoria senza caricare inutilmente l'intero inventario.
 */
function isMemoryPreferenceIntent(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const patterns = [
    /\b(mi piace|adoro|amo|preferisco|vado matto|gradisco)\b/i,
    /\b(non mi piace|odio|detesto|disprezzo|non gradisco|non sopporto)\b/i,
    /\b(non mangio|non consumo|evito|non posso mangiare)\b/i,
    /\b(sono allergico|sono intollerante|allergia|intolleranza)\b/i,
    /\b(sono vegetariano|sono vegano|sono celiaco|sono a dieta)\b/i,
    /\b(ricorda(?:ti)? che|tieni a mente che|memorizza che|appuntati che)\b/i,
  ];
  return patterns.some((p) => p.test(normalized));
}

/**
 * Traduce e formatta in modo trasparente gli errori del server/LLM (es. 503, 429, permessi)
 * per renderli chiaramente comprensibili all'utente e utili al debug tecnico.
 */
function parseAiOrServerError(err: any, retryText?: string): AssistantErrorDetails {
  const rawMessage = err?.message || String(err) || "Errore sconosciuto";
  const rawCode = err?.code || err?.status || (rawMessage.match(/\b(503|429|403|401|400|500)\b/)?.[1]);

  let code: string | number = rawCode || "SERVER_ERROR";
  let userExplanation = "Si è verificato un errore durante l'elaborazione del messaggio.";

  if (
    code === 503 ||
    code === "503" ||
    code === "UNAVAILABLE" ||
    rawMessage.includes("503") ||
    rawMessage.includes("high demand") ||
    rawMessage.includes("overloaded")
  ) {
    code = "503 - Service Unavailable";
    userExplanation =
      "Server AI momentaneamente sovraccarico (503). Il modello Gemini sta gestendo un picco di richieste. Clicca 'Riprova' per rieseguire l'invio.";
  } else if (
    code === 429 ||
    code === "429" ||
    code === "RESOURCE_EXHAUSTED" ||
    rawMessage.includes("quota") ||
    rawMessage.includes("rate limit")
  ) {
    code = "429 - Quota Exceeded";
    userExplanation =
      "Limite di richieste raggiunto (429 Too Many Requests). Attendi qualche istante prima di inviare un nuovo messaggio.";
  } else if (
    code === 403 ||
    code === "PERMISSION_DENIED" ||
    rawMessage.includes("permission-denied") ||
    rawMessage.includes("Missing or insufficient permissions")
  ) {
    code = "403 - Permission Denied";
    userExplanation =
      "Autorizzazione insufficiente (403 Permission Denied) su Firestore o sui servizi Google. Verifica l'account o le regole di sicurezza.";
  } else if (rawMessage.includes("timeout") || rawMessage.includes("deadline")) {
    code = "504 - Timeout";
    userExplanation =
      "Tempo di risposta scaduto (Gateway Timeout). Il server non ha risposto entro il tempo massimo previsto.";
  } else if (rawMessage.includes("fetch failed") || rawMessage.includes("Failed to fetch") || rawMessage.includes("network")) {
    code = "NETWORK_ERROR";
    userExplanation =
      "Problema di connessione di rete. Impossibile contattare i server cloud di Firebase o Google Gemini.";
  }

  return {
    code,
    message: userExplanation,
    technicalDetails: rawMessage,
    retryText,
  };
}

interface AssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "modal" | "docked";
  pantryId?: string;
  pantryName?: string;
  pantryCategories?: string[];
  products?: Product[];
}

export function AssistantChatModal({
  isOpen,
  onClose,
  mode = "modal",
  pantryId = "",
  pantryName = "Dispensa",
  pantryCategories = [],
  products = [],
}: AssistantChatModalProps) {
  const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid || null);
  const [effectivePantryId, setEffectivePantryId] = useState<string>(pantryId || "");
  const [effectivePantryName, setEffectivePantryName] = useState<string>(pantryName || "Dispensa");
  const [effectiveCategories, setEffectiveCategories] = useState<string[]>(pantryCategories || []);
  const [effectiveProducts, setEffectiveProducts] = useState<Product[]>(products || []);

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [applyingActionId, setApplyingActionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const prefixTextRef = useRef<string>("");
  const inputValueRef = useRef<string>("");
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const autoSendRef = useRef<boolean>(false);
  const handleSendMessageRef = useRef<((textToSend?: string) => Promise<void>) | null>(null);

  // Mantieni il ref del testo allineato
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // Sincronizza stato di autenticazione reattivo
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });
    return () => unsub();
  }, []);

  // Sincronizza quando cambiano le prop esterne
  useEffect(() => {
    if (pantryId) setEffectivePantryId(pantryId);
    if (pantryName) setEffectivePantryName(pantryName);
    if (pantryCategories && pantryCategories.length > 0) setEffectiveCategories(pantryCategories);
    if (products && products.length > 0) setEffectiveProducts(products);
  }, [pantryId, pantryName, pantryCategories, products]);

  // Se la modal è aperta ma non c'è una dispensa id valida, prova a caricarla direttamente
  useEffect(() => {
    if (!isOpen) return;
    const uid = userId || auth.currentUser?.uid;
    if (!uid) return;

    if (!effectivePantryId) {
      getDoc(doc(db, "users", uid))
        .then(async (uDoc) => {
          if (!uDoc.exists()) return;
          const uData = uDoc.data();
          const pId = uData?.userProfileCurrentPantryId || uData?.userProfilePantryIds?.[0];
          if (pId) {
            setEffectivePantryId(pId);
            const [pSnap, pProds] = await Promise.all([
              getDoc(doc(db, "pantries", pId)),
              getProductsByPantry(pId),
            ]);
            if (pSnap.exists()) {
              const pData = pSnap.data();
              if (pData?.pantryName) setEffectivePantryName(pData.pantryName);
              if (pData?.pantryCategories && pData.pantryCategories.length > 0) {
                setEffectiveCategories(pData.pantryCategories);
              }
            }
            if (pProds && pProds.length > 0) {
              setEffectiveProducts(pProds);
            }
          }
        })
        .catch((err) => console.warn("[AssistantChat] Errore risoluzione dispensa:", err));
    }
  }, [isOpen, userId, effectivePantryId]);

  // Sottoscrizione ai messaggi Firestore
  useEffect(() => {
    const uid = userId || auth.currentUser?.uid;
    const pid = effectivePantryId || pantryId;
    if (!isOpen || !uid || !pid) return;

    const unsubscribe = subscribeAssistantMessages(uid, pid, (msgs) => {
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [isOpen, userId, effectivePantryId, pantryId]);

  // Scroll automatico all'ultimo messaggio
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const clearRecordingTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  // Pulizia del timer a smontaggio componente
  useEffect(() => {
    return () => {
      clearRecordingTimer();
    };
  }, []);

  // Chiusura con tasto Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Pulizia dello stream del microfono
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Gestione Inizializzazione Registrazione Vocale con MediaRecorder & Gemini
  const startSpeechRecognition = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      alert("Il microfono non è supportato su questo dispositivo/browser.");
      return;
    }

    try {
      // Reset flag di controllo e cattura testo iniziale
      isCancelledRef.current = false;
      autoSendRef.current = false;
      setRecordingDuration(0);
      clearRecordingTimer();
      prefixTextRef.current = inputValueRef.current.trim();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (typeof MediaRecorder !== "undefined") {
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          } else {
            mimeType = "";
          }
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsListening(true);
        durationTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      };

      recorder.onstop = async () => {
        clearRecordingTimer();
        cleanupStream();
        setIsListening(false);

        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const recordedMime = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMime });
        audioChunksRef.current = [];

        if (audioBlob.size < 200) {
          console.warn("[AssistantChat] Audio troppo breve per la trascrizione.");
          return;
        }

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string) || "";
            if (base64Data) {
              const res = await transcribeAndParseVoiceInput(
                base64Data,
                recordedMime,
                "chat_message",
                effectiveCategories,
                effectiveProducts.map((p) => ({
                  id: p.productId || "",
                  name: p.productName,
                  quantity: p.productQuantity,
                  category: p.productCategory,
                  isOpened: !!p.productOpenedAt,
                  isFrozen: !!p.isFrozen,
                }))
              );
              if (res.rawTranscript) {
                const prefix = prefixTextRef.current;
                const transcript = res.rawTranscript.trim();
                const fullText = prefix ? `${prefix} ${transcript}` : transcript;
                setInputValue(fullText);
                inputValueRef.current = fullText;

                if (autoSendRef.current && fullText.trim()) {
                  handleSendMessageRef.current?.(fullText);
                }
              } else {
                console.warn("[AssistantChat] Nessuna trascrizione ricevuta da Gemini.");
              }
            }
            setIsTranscribing(false);
          };
        } catch (err) {
          console.error("[AssistantChat] Errore trascrizione vocale:", err);
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
    } catch (err) {
      console.error("[AssistantChat] Errore accesso microfono:", err);
      clearRecordingTimer();
      cleanupStream();
      setIsListening(false);
      alert("Impossibile accedere al microfono. Verifica i permessi del browser.");
    }
  }, [cleanupStream, effectiveCategories, effectiveProducts]);

  const stopSpeechRecognition = useCallback((options?: { autoSend?: boolean }) => {
    autoSendRef.current = !!options?.autoSend;
    clearRecordingTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    autoSendRef.current = false;
    clearRecordingTimer();
    setRecordingDuration(0);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupStream();
    setInputValue(prefixTextRef.current);
    inputValueRef.current = prefixTextRef.current;
    setIsListening(false);
  }, [cleanupStream]);

  // Se si chiude la modale mentre si sta registrando, cancella
  useEffect(() => {
    if (!isOpen && isListening) {
      cancelRecording();
    }
  }, [isOpen, isListening, cancelRecording]);

  const toggleListening = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // Invio messaggio all'assistente
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isLoading) return;

    if (isListening) {
      stopSpeechRecognition();
    }

    const currentUid = userId || auth.currentUser?.uid;
    if (!currentUid) {
      alert("Effettua l'accesso per poter comunicare con l'assistente.");
      return;
    }

    let targetPantryId = effectivePantryId || pantryId;
    if (!targetPantryId) {
      try {
        const uDoc = await getDoc(doc(db, "users", currentUid));
        const uData = uDoc.data();
        targetPantryId = uData?.userProfileCurrentPantryId || uData?.userProfilePantryIds?.[0] || "";
        if (targetPantryId) {
          setEffectivePantryId(targetPantryId);
        }
      } catch (err) {
        console.warn("[AssistantChat] Errore recupero dispensa al volo:", err);
      }
    }

    if (!targetPantryId) {
      targetPantryId = "default_pantry";
      setEffectivePantryId(targetPantryId);
    }

    setInputValue("");
    setIsLoading(true);

    try {
      // 1. Salva messaggio utente su Firestore
      await sendUserAssistantMessage(currentUid, targetPantryId, text);

      // 2. Prepara il contesto per Gemini
      const prodsToUse = effectiveProducts.length > 0 ? effectiveProducts : products;
      const expiringProds = prodsToUse
        .filter((p) => {
          if (!p.expiryDateProduct) return false;
          const diff = p.expiryDateProduct.toMillis() - Date.now();
          return diff <= 3 * 24 * 60 * 60 * 1000;
        })
        .map((p) => ({
          id: p.productId || "",
          name: p.productName,
          quantity: p.productQuantity,
          expiryDateStr: p.expiryDateProduct
            ? new Date(p.expiryDateProduct.toMillis()).toLocaleDateString("it-IT")
            : undefined,
        }));

      let userDietaryContext = "";
      try {
        const [dietPrefs, facts] = await Promise.all([
          getDietaryPreferences(currentUid),
          getMemoryFacts(currentUid, true),
        ]);
        userDietaryContext = formatUserDietAndMemoryContext(dietPrefs, facts);
      } catch (dErr) {
        console.warn("[AssistantChat] Errore recupero preferenze dietetiche:", dErr);
      }

      const historyContext = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 3. Routing Rapido: se il messaggio esprime gusti/preferenze, invia subito al Subagente Memoria
      const isPreference = isMemoryPreferenceIntent(text);
      let result;

      if (isPreference) {
        // Fast path: salta la serializzazione di 80 prodotti e risponde in <1s con l'azione di memorizzazione proposta
        result = await chatWithMemorySpecialist(text, historyContext, userDietaryContext);
      } else {
        // Standard path: gestione operazioni dispensa, riconciliazione prodotti e ricette
        const context: PantryCopilotContext = {
          pantryName: effectivePantryName || pantryName,
          categories: effectiveCategories.length > 0 ? effectiveCategories : pantryCategories,
          products: prodsToUse.map((p) => ({
            id: p.productId || "",
            name: p.productName,
            quantity: p.productQuantity,
            unit: p.productUnitOfMeasure,
            category: p.productCategory,
            isOpened: !!p.productOpenedAt,
            isFrozen: !!p.isFrozen,
            expiryDateStr: p.expiryDateProduct
              ? new Date(p.expiryDateProduct.toMillis()).toLocaleDateString("it-IT")
              : undefined,
          })),
          expiringProducts: expiringProds,
          userDietaryContext,
        };

        result = await chatWithPantryCopilot(text, historyContext, context);
      }

      if (result && result.success === false) {
        throw new Error(result.reply || "Errore nella comunicazione con il modello AI.");
      }

      // 4. Salva risposta assistente su Firestore
      await saveAssistantReply(currentUid, targetPantryId, result.reply, result.proposedActions);

      // 5. Apprendimento silenzioso in background solo se non era già gestito dal subagente
      if (!isPreference) {
        learnMemoryFromUserMessage(currentUid, text).catch((err) =>
          console.warn("[AssistantChat] Avviso apprendimento memoria in background:", err)
        );
      }
    } catch (err: any) {
      console.error("[AssistantChat] Errore invio messaggio:", err);
      const parsedError = parseAiOrServerError(err, text);
      await saveAssistantReply(
        currentUid,
        targetPantryId,
        parsedError.message,
        [],
        parsedError
      ).catch((saveErr) => {
        console.error("[AssistantChat] Impossibile salvare messaggio di errore su Firestore:", saveErr);
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  // Conferma ed esecuzione di un'azione proposta
  const handleApplyAction = async (msgId: string, action: ProposedAction) => {
    const currentUid = userId || auth.currentUser?.uid;
    const targetPantryId = effectivePantryId || pantryId;
    if (!currentUid || !targetPantryId) return;

    setApplyingActionId(action.id);

    try {
      const { type, payload } = action;

      if (type === "add_product") {
        const prodsToUse = effectiveProducts.length > 0 ? effectiveProducts : (products || []);
        const match = findPantryMatch(payload.productName || "", prodsToUse);

        // Se l'alimento è già presente in dispensa, aggiorna la quantità del prodotto esistente invece di duplicarlo
        if (match.matched && match.matchedProduct && match.matchedProduct.productId) {
          const existing = match.matchedProduct;
          const existingId = match.matchedProduct.productId;
          const addedQty = payload.productQuantity || 1;
          const newTotalQty = (existing.productQuantity || 0) + addedQty;

          const updateData: Partial<Product> = {
            productQuantity: newTotalQty,
          };

          // Gestione scadenza: se il nuovo acquisto ha una scadenza più ravvicinata, aggiornala per evitare sprechi
          if (payload.productExpiryDate) {
            const newExpDate = new Date(payload.productExpiryDate);
            if (!isNaN(newExpDate.getTime())) {
              const existingExpDate = existing.expiryDateProduct?.toDate?.();
              if (!existingExpDate || newExpDate < existingExpDate) {
                updateData.expiryDateProduct = Timestamp.fromDate(newExpDate);
              }
            }
          }

          await updateProduct(existingId, updateData);
          window.dispatchEvent(new Event("inventory-updated"));
        } else {
          let expTimestamp: Timestamp | null = null;
          if (payload.productExpiryDate) {
            const d = new Date(payload.productExpiryDate);
            if (!isNaN(d.getTime())) expTimestamp = Timestamp.fromDate(d);
          }

          await addProduct({
            productPantryId: targetPantryId,
            productName: payload.productName || "Prodotto",
            productQuantity: payload.productQuantity || 1,
            productUnitOfMeasure: payload.productUnit || "pz",
            productCategory: payload.productCategory || "Altro",
            expiryDateProduct: expTimestamp,
            addToShoppingList: false,
          });
          window.dispatchEvent(new Event("inventory-updated"));
        }
      } else if (type === "update_quantity" && payload.productId) {
        const updateData: Partial<Product> = {
          productQuantity: payload.productQuantity ?? 1,
        };

        // Gestione scadenza: se è specificata una nuova data (es. nuovo lotto acquistato)
        if (payload.productExpiryDate) {
          const newExpDate = new Date(payload.productExpiryDate);
          if (!isNaN(newExpDate.getTime())) {
            const prodsToUse = effectiveProducts.length > 0 ? effectiveProducts : (products || []);
            const existingProduct = prodsToUse.find((p) => p.productId === payload.productId);
            const existingExpDate = existingProduct?.expiryDateProduct?.toDate?.();
            if (!existingExpDate || newExpDate < existingExpDate) {
              updateData.expiryDateProduct = Timestamp.fromDate(newExpDate);
            }
          }
        }

        await updateProduct(payload.productId, updateData);
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "open_product" && payload.productId) {
        await openProduct(payload.productId, payload.shelfLifeDays || 3);
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "freeze_product" && payload.productId) {
        await freezeProduct(payload.productId, 3);
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "unfreeze_product" && payload.productId) {
        await unfreezeProduct(payload.productId);
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "consume_product" && payload.productId) {
        await consumeProduct(
          payload.productId,
          payload.productQuantity || 1,
          "consumed"
        );
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "add_to_shopping_list") {
        const itemName = payload.shoppingItemName || payload.productName || "Nuovo alimento";
        await addRawItemToShoppingList(targetPantryId, itemName, {
          category: payload.productCategory,
          unit: payload.productUnit,
        });
        window.dispatchEvent(new Event("shopping-list-updated"));
        window.dispatchEvent(new Event("inventory-updated"));
      } else if (type === "add_memory_fact") {
        const factText = payload.memoryFactText || payload.productName || action.description || action.title;
        const factCat = payload.memoryFactCategory || "taste_preference";
        await addMemoryFact(currentUid, {
          text: factText,
          category: factCat,
          source: "user",
          isActive: true,
        });
        window.dispatchEvent(new Event("memory-facts-updated"));
      }

      // Segna l'azione come applicata nel documento Firestore del messaggio
      await updateProposedActionStatus(currentUid, targetPantryId, msgId, action.id, "applied");
    } catch (err) {
      console.error("[AssistantChat] Errore applicazione azione:", err);
      alert("Errore durante l'applicazione della modifica. Riprova.");
    } finally {
      setApplyingActionId(null);
    }
  };

  // Annullamento di un'azione proposta
  const handleCancelAction = async (msgId: string, actionId: string) => {
    const currentUid = userId || auth.currentUser?.uid;
    const targetPantryId = effectivePantryId || pantryId;
    if (!currentUid || !targetPantryId) return;

    try {
      await updateProposedActionStatus(currentUid, targetPantryId, msgId, actionId, "cancelled");
    } catch (err) {
      console.error("[AssistantChat] Errore annullamento azione:", err);
    }
  };

  // Cancellazione cronologia chat
  const handleClearChat = async () => {
    const currentUid = userId || auth.currentUser?.uid;
    const targetPantryId = effectivePantryId || pantryId;
    if (!currentUid || !targetPantryId) return;

    const confirm = window.confirm(
      "Vuoi cancellare l'intera cronologia di questa conversazione con l'assistente?"
    );
    if (!confirm) return;

    try {
      await clearAssistantChat(currentUid, targetPantryId);
    } catch (err) {
      console.error("[AssistantChat] Errore cancellazione cronologia:", err);
    }
  };

  if (!isOpen) return null;

  const chatContent = (
    <div
      className={`relative w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden ${
        mode === "modal"
          ? "rounded-t-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl"
          : "select-text"
      }`}
      role={mode === "modal" ? "dialog" : "region"}
      aria-modal={mode === "modal" ? "true" : undefined}
      aria-label="Assistente Dispensa AI"
    >
      {/* Barra di trascinamento touch per mobile */}
      {mode === "modal" && (
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>
      )}

      {/* Header della Chat */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/90 backdrop-blur shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Assistente Dispensa
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded-full shrink-0">
                {mode === "docked" ? "Split View" : "AI Copilot"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
              {effectivePantryName || pantryName} • {effectiveProducts.length || products.length} prodotti
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              title="Cancella cronologia chat"
              aria-label="Cancella cronologia chat"
              className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title={mode === "docked" ? "Chiudi pannello split view" : "Chiudi"}
            aria-label="Chiudi chat"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

        {/* Area Messaggi: Scorrimento autonomo indipendente */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Come posso aiutarti oggi?
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  Chiedimi cosa cucinare, cosa sta per scadere, oppure dimmi cosa hai comprato o consumato per aggiornare la dispensa.
                </p>
              </div>

              {/* Suggerimenti rapidi */}
              <div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
                {[
                  "Cosa sta per scadere?",
                  "Consigliami una ricetta anti-spreco",
                  "Ho comprato 2 pacchi di pasta Barilla",
                  "Metti latte e uova nella lista della spesa",
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    className="text-xs px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60 transition-colors text-left"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div
                    className={`w-8 h-8 rounded-xl ${
                      msg.error
                        ? "bg-amber-500 text-white"
                        : "bg-emerald-500 text-white"
                    } flex items-center justify-center shrink-0 mt-1 shadow-sm`}
                  >
                    {msg.error ? (
                      <AlertTriangle className="w-4 h-4 text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-200" />
                    )}
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] space-y-2`}>
                  {/* Bolla del messaggio o Box Errore Esplicito */}
                  {msg.error ? (
                    <div className="rounded-2xl p-3.5 sm:p-4 bg-amber-50/95 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 shadow-xs space-y-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                              Avviso Servizio AI
                            </span>
                            {msg.error.code && (
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700">
                                {msg.error.code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-100 mt-1 leading-relaxed">
                            {msg.error.message || msg.content}
                          </p>
                        </div>
                      </div>

                      {/* Dettagli tecnici espandibili per lo sviluppatore */}
                      {msg.error.technicalDetails && (
                        <details className="text-xs group border-t border-amber-200/80 dark:border-amber-800/60 pt-2 cursor-pointer">
                          <summary className="font-semibold text-amber-800 dark:text-amber-300 select-none hover:underline flex items-center justify-between">
                            <span>Dettagli tecnici e diagnostica</span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 group-open:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="mt-2 p-2.5 rounded-xl bg-amber-100/70 dark:bg-zinc-900 border border-amber-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 break-words whitespace-pre-wrap select-text max-h-40 overflow-y-auto">
                            {msg.error.technicalDetails}
                          </div>
                        </details>
                      )}

                      {/* Pulsante Riprova invio */}
                      {msg.error.retryText && (
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleSendMessage(msg.error!.retryText)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Riprova invio</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? "bg-emerald-600 text-white rounded-br-none shadow-sm"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200/60 dark:border-zinc-700/60 shadow-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Card Interattive per le Azioni Proposte (se presenti) */}
                  {msg.proposedActions && msg.proposedActions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {msg.proposedActions.map((action) => {
                        const isPending = action.status === "pending";
                        const isApplied = action.status === "applied";
                        const isCancelled = action.status === "cancelled";
                        const isApplying = applyingActionId === action.id;

                        // Icona per il tipo di azione
                        const ActionIcon =
                          action.type === "add_product"
                            ? PackagePlus
                            : action.type === "update_quantity"
                            ? Edit3
                            : action.type === "freeze_product"
                            ? Snowflake
                            : action.type === "open_product"
                            ? PackageOpen
                            : action.type === "consume_product"
                            ? Flame
                            : action.type === "add_memory_fact"
                            ? Heart
                            : ShoppingCart;

                        return (
                          <div
                            key={action.id}
                            className={`p-3.5 rounded-2xl border transition-all duration-200 ${
                              isApplied
                                ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                                : isCancelled
                                ? "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 line-through opacity-70"
                                : "bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-700/80 shadow-md shadow-amber-500/5 text-zinc-800 dark:text-zinc-200"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div
                                  className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                    isApplied
                                      ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                                  }`}
                                >
                                  <ActionIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold truncate">
                                      {action.title}
                                    </span>
                                    {isApplied && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" /> Applicato
                                      </span>
                                    )}
                                    {isCancelled && (
                                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                        Annullato
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {action.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Pulsanti di azione se in attesa di conferma */}
                            {isPending && (
                              <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                  type="button"
                                  disabled={isApplying}
                                  onClick={() => handleCancelAction(msg.id, action.id)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  Annulla
                                </button>
                                <button
                                  type="button"
                                  disabled={isApplying}
                                  onClick={() => handleApplyAction(msg.id, action)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  {isApplying ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      Salvataggio...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      Conferma modifica
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 items-start">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-200" />
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                L&apos;assistente sta elaborando la risposta...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Banner Trascrizione in Corso */}
        {isTranscribing && (
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-150 shrink-0">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">Trascrizione con IA in corso...</span>
            </div>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400">Gemini Voice</span>
          </div>
        )}

        {/* Banner Registrazione Vocale Attiva con Timer, Onde e Controlli Rapidi */}
        {isListening && (
          <div className="px-4 py-3 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in duration-150 shrink-0">
            {/* Visualizzazione Registrazione & Timer & Onde */}
            <div className="flex items-center gap-3">
              {/* Pallino pulsante */}
              <div className="relative flex items-center justify-center shrink-0">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute" />
                <span className="w-3 h-3 rounded-full bg-rose-600 relative" />
              </div>

              {/* Timer Durata */}
              <span className="font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md tracking-wider">
                {formatDuration(recordingDuration)}
              </span>

              {/* Onde sonore animate */}
              <div className="flex items-center gap-1 h-4">
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-3" />
                <span className="w-1 bg-rose-600 rounded-full animate-bounce h-4" />
                <span className="w-1 bg-rose-500 rounded-full animate-pulse h-2" />
                <span className="w-1 bg-rose-600 rounded-full animate-bounce h-3.5" />
              </div>

              <span className="font-medium truncate text-rose-700 dark:text-rose-300">
                Registrazione in corso... parla pure
              </span>
            </div>

            {/* Pulsanti di Azione: Annulla, Ferma e Trascrivi, Invia Subito */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={cancelRecording}
                className="px-2.5 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-medium transition-colors inline-flex items-center gap-1"
                title="Annulla registrazione senza salvare"
              >
                <X className="w-3.5 h-3.5" />
                Annulla
              </button>

              <button
                type="button"
                onClick={() => stopSpeechRecognition()}
                className="px-3 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                title="Ferma e inserisci trascrizione nel testo per revisione"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Ferma e trascrivi
              </button>

              <button
                type="button"
                onClick={() => {
                  stopSpeechRecognition({ autoSend: true });
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm shadow-rose-600/30 active:scale-95 inline-flex items-center gap-1.5"
                title="Trascrivi e invia subito all'assistente"
              >
                <Send className="w-3.5 h-3.5" />
                Invia subito
              </button>
            </div>
          </div>
        )}

        {/* Input Bar con Digitazione e Microfono Integrato */}
        <div className="p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isListening
                    ? "In ascolto... Parla ora"
                    : isTranscribing
                    ? "Trascrizione con IA in corso..."
                    : "Chiedi o modifica la dispensa..."
                }
                disabled={isTranscribing}
                className="w-full pl-4 pr-11 py-3 text-sm rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/80 placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner disabled:opacity-70"
              />

              {/* Microfono Integrato nel Campo di Input */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={isTranscribing}
                title={isListening ? "Ferma registrazione vocale" : "Registrazione vocale"}
                aria-label={isListening ? "Ferma registrazione vocale" : "Registrazione vocale"}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
                  isListening
                    ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105 animate-pulse"
                    : "text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-700"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Pulsante Invio */}
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading || isTranscribing}
              aria-label="Invia messaggio"
              className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      </div>
  );

  if (mode === "docked") {
    return chatContent;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full h-[88vh] animate-in slide-in-from-bottom-5 duration-300 flex flex-col">
        {chatContent}
      </div>
    </div>
  );
}
