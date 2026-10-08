"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Clock,
  Loader2,
  ListPlus,
  Mic,
  MicOff,
  ChefHat,
  Volume2,
  AlertCircle,
  Keyboard,
  Radio,
  Bookmark,
  BookmarkCheck,
  Sparkles,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { getExpiringProductsByPantry, getProductsByPantry } from "@/lib/firestore/products";
import {
  getUserRecipes,
  getPantrySharedRecipes,
  saveRecipe,
} from "@/lib/firestore/recipes";
import {
  generateRecipeExpiration,
  generateRecipeChatbot,
  generateRecipeFromIngredients,
  getGeminiModelName,
  getGeminiLiveConfig,
  buildLiveChefPantryContext,
  type PantryContextProduct,
} from "@/lib/genkit/genkit";
import type { Product } from "@/types/firestore/productType";
import type { Recipe } from "@/types/firestore/recipeType";
import {
  SelectItemForChatbot,
  Skeleton,
  VoiceDictationModal,
  RecipeCarousel,
  RecipeInlineDetail,
} from "@/components";
import { GeminiLiveClient } from "@/lib/audio/geminiLiveClient";
import { parseRecipeFromChatText } from "@/lib/recipes/recipeParser";

type Message = {
  role: "user" | "ai";
  content: string;
  isLiveVoice?: boolean;
  isInterim?: boolean;
  isAntiWaste?: boolean;
};

export default function RicettarioPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pantryItems, setPantryItems] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [modelName, setModelName] = useState("gemini-3.1-flash-lite");
  const [isVoiceDictationOpen, setIsVoiceDictationOpen] = useState(false);
  const [currentPantryId, setCurrentPantryId] = useState<string>("");

  // Stati Ricettario (Carosello e Ricette)
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [antiWasteRecipes, setAntiWasteRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loadingAntiWaste, setLoadingAntiWaste] = useState(false);
  const [savedMessageIndexes, setSavedMessageIndexes] = useState<Set<number>>(new Set());
  const [savingRecipeIdx, setSavingRecipeIdx] = useState<number | null>(null);

  // Stato Chef Vocale Live
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"disconnected" | "connecting" | "connected" | "speaking" | "listening">("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [liveError, setLiveError] = useState("");

  const clientRef = useRef<GeminiLiveClient | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Beep audio leggero di connessione
  const playChime = useCallback((type: "start" | "end") => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = type === "start" ? 659.25 : 329.63;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Feedback opzionale
    }
  }, []);

  // Caricamento ricette salvate
  const loadSavedRecipes = useCallback(async (userId: string, pantryId?: string) => {
    try {
      const [userRecs, pantryRecs] = await Promise.all([
        getUserRecipes(userId),
        pantryId ? getPantrySharedRecipes(pantryId) : Promise.resolve([]),
      ]);

      // Unione ricette evitando duplicati
      const map = new Map<string, Recipe>();
      userRecs.forEach((r) => r.recipeId && map.set(r.recipeId, r));
      pantryRecs.forEach((r) => r.recipeId && map.set(r.recipeId, r));

      setSavedRecipes(Array.from(map.values()));
    } catch (err) {
      console.warn("Errore caricamento ricette salvate:", err);
    }
  }, []);

  // Generazione o aggiornamento idee anti-spreco
  const generateAntiWasteIdeas = useCallback(async (pantryId: string) => {
    setLoadingAntiWaste(true);
    try {
      const expiring = await getExpiringProductsByPantry(pantryId, 7);
      if (expiring.length === 0) {
        setAntiWasteRecipes([]);
        return;
      }

      const mappedProducts = expiring.map((p) => ({
        nome: p.productName,
        quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ""}`.trim(),
      }));

      const ricettaText = await generateRecipeExpiration(mappedProducts);
      const parsed = parseRecipeFromChatText(ricettaText, true);

      setAntiWasteRecipes([
        {
          ...parsed,
          recipeId: "anti-waste-suggestion-1",
          recipeAuthorUid: "chef-ai",
        },
      ]);
    } catch (err) {
      console.warn("Avviso generazione idee anti-spreco:", err);
    } finally {
      setLoadingAntiWaste(false);
    }
  }, []);

  // Inizializzazione dati pagina
  useEffect(() => {
    getGeminiModelName()
      .then(setModelName)
      .catch((err) => console.error("Error fetching model name:", err));

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      getDoc(doc(db, "users", uid))
        .then((userDoc) => {
          const pantryId = userDoc.data()?.userProfileCurrentPantryId;
          if (pantryId) {
            setCurrentPantryId(pantryId);
            loadSavedRecipes(uid, pantryId);
            generateAntiWasteIdeas(pantryId);
            getProductsByPantry(pantryId)
              .then((products) => {
                setPantryItems(products.filter((p) => p.productQuantity > 0));
              })
              .catch(console.error);
          }
        })
        .catch(console.error);
    }
  }, [loadSavedRecipes, generateAntiWasteIdeas]);

  // Ascolta trascrizione dal Floating Action Button globale
  useEffect(() => {
    const handleVoiceEvent = (e: Event) => {
      const custom = e as CustomEvent<{ text: string }>;
      if (custom.detail?.text) {
        setInput(custom.detail.text);
      }
    };

    window.addEventListener("recipe-chat-voice-input", handleVoiceEvent);
    return () => {
      window.removeEventListener("recipe-chat-voice-input", handleVoiceEvent);
    };
  }, []);

  // Disconnessione automatica Live Chef allo smontaggio
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  // Auto-scroll chat verso il basso
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, liveStatus]);

  // Gestione sessione Chef Vocale Live
  const startLiveChefSession = async () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    setIsLiveActive(true);
    setLiveStatus("connecting");
    setLiveError("");

    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : undefined;
      const config = await getGeminiLiveConfig(idToken);

      if (config.error || !config.apiKey) {
        setLiveError(config.error || "Chiave Gemini non disponibile.");
        setLiveStatus("disconnected");
        return;
      }

      let fullContext = "";
      if (user && currentPantryId) {
        try {
          const [products, expiring] = await Promise.all([
            getProductsByPantry(currentPantryId),
            getExpiringProductsByPantry(currentPantryId, 7),
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

          fullContext = await buildLiveChefPantryContext(mappedProducts);
        } catch (ctxErr) {
          console.warn("Avviso recupero prodotti dispensa per Chef Live:", ctxErr);
        }
      }

      const client = new GeminiLiveClient(config.apiKey, config.model, {
        onStatusChange: (newStatus) => {
          setLiveStatus(newStatus);
          if (newStatus === "connected") {
            playChime("start");
          }
        },
        onTranscript: (chunkText, speaker, isInterim) => {
          setMessages((prev) => {
            const targetRole = speaker === "chef" ? "ai" : "user";
            const last = prev[prev.length - 1];

            if (targetRole === "user") {
              if (last && last.role === "user" && last.isLiveVoice && last.isInterim) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: chunkText, isInterim: !!isInterim },
                ];
              }
              return [
                ...prev,
                {
                  role: "user",
                  content: chunkText,
                  isLiveVoice: true,
                  isInterim: !!isInterim,
                },
              ];
            }

            let basePrev = prev;
            if (last && last.role === "user" && last.isInterim) {
              basePrev = [
                ...prev.slice(0, -1),
                { ...last, isInterim: false },
              ];
            }

            const updatedLast = basePrev[basePrev.length - 1];
            if (updatedLast && updatedLast.role === "ai" && updatedLast.isLiveVoice) {
              const needsSpace =
                !updatedLast.content.endsWith(" ") &&
                !chunkText.startsWith(" ") &&
                !chunkText.startsWith(",") &&
                !chunkText.startsWith(".");
              return [
                ...basePrev.slice(0, -1),
                {
                  ...updatedLast,
                  content: updatedLast.content + (needsSpace ? " " : "") + chunkText,
                },
              ];
            }

            return [
              ...basePrev,
              {
                role: "ai",
                content: chunkText,
                isLiveVoice: true,
              },
            ];
          });
        },
        onError: (err) => {
          setLiveError(err);
        },
        onAudioLevel: (lvl) => {
          setAudioLevel(lvl);
        },
      });

      clientRef.current = client;
      await client.connect(fullContext);
    } catch (err) {
      console.error("Errore avvio Live Chef:", err);
      setLiveError(err instanceof Error ? err.message : "Errore connessione.");
      setLiveStatus("disconnected");
    }
  };

  const stopLiveChefSession = () => {
    playChime("end");
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsLiveActive(false);
    setLiveStatus("disconnected");
    setIsMuted(false);
    setAudioLevel(0);
  };

  const handleToggleMute = () => {
    if (!clientRef.current) return;
    const nextMuted = !isMuted;
    clientRef.current.setMute(nextMuted);
    setIsMuted(nextMuted);
  };

  const handleBargeIn = () => {
    if (clientRef.current && liveStatus === "speaking") {
      clientRef.current.triggerBargeIn();
    }
  };

  // Azione rapida: usa prodotti in scadenza
  const handleExpiringProducts = async () => {
    if (!auth.currentUser) {
      alert("Devi effettuare l'accesso per usare questa funzione.");
      return;
    }

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: "Crea una ricetta con i prodotti in scadenza" }]);

    try {
      if (!currentPantryId) throw new Error("Nessuna dispensa selezionata.");
      const expiringProducts = await getExpiringProductsByPantry(currentPantryId, 7);

      if (expiringProducts.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", content: "Ottima notizia! Non hai alimenti in scadenza nei prossimi 7 giorni." },
        ]);
        setIsLoading(false);
        return;
      }

      const mappedProducts = expiringProducts.map((p) => ({
        nome: p.productName,
        quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ""}`.trim(),
      }));

      const ricetta = await generateRecipeExpiration(mappedProducts);
      setMessages((prev) => [...prev, { role: "ai", content: ricetta, isAntiWaste: true }]);
    } catch (error) {
      console.error("Errore durante la generazione della ricetta:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Si è verificato un errore durante la generazione della ricetta." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Invio messaggio chat testo
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      let mappedProducts = undefined;
      if (currentPantryId) {
        const products = await getProductsByPantry(currentPantryId);
        mappedProducts = products
          .filter((p) => p.productQuantity > 0)
          .map((p) => ({
            nome: p.productName,
            quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ""}`.trim(),
          }));
      }

      const ricetta = await generateRecipeChatbot(userMessage, messages, mappedProducts);
      setMessages((prev) => [...prev, { role: "ai", content: ricetta }]);
    } catch (error) {
      console.error("Errore durante la chat:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Si è verificato un errore durante la generazione della risposta." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = () => {
    if (!auth.currentUser) {
      alert("Devi effettuare l'accesso per usare questa funzione.");
      return;
    }
    setIsModalOpen(true);
  };

  const toggleItemSelection = (productId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleGenerateFromSelection = async () => {
    if (selectedItems.size === 0) return;
    setIsModalOpen(false);
    setIsLoading(true);

    const selectedProductsData = pantryItems.filter((p) => p.productId && selectedItems.has(p.productId));
    const mappedProducts = selectedProductsData.map((p) => ({
      nome: p.productName,
      quantita: `${p.productQuantity} ${p.productUnitOfMeasure || ""}`.trim(),
    }));

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `Crea una ricetta con questi ingredienti selezionati: ${mappedProducts.map((p) => p.nome).join(", ")}`,
      },
    ]);

    try {
      const ricetta = await generateRecipeFromIngredients(mappedProducts);
      setMessages((prev) => [...prev, { role: "ai", content: ricetta }]);
    } catch (error) {
      console.error("Errore durante la generazione della ricetta:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Si è verificato un errore durante la generazione della ricetta." },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedItems(new Set());
    }
  };

  // Salvataggio ricetta prodotta dal chatbot
  const handleSaveRecipeFromChat = async (msgContent: string, msgIndex: number, isAntiWaste = false) => {
    if (!auth.currentUser) {
      alert("Accedi per salvare questa ricetta nel tuo ricettario.");
      return;
    }

    setSavingRecipeIdx(msgIndex);
    try {
      const uid = auth.currentUser.uid;
      const parsed = parseRecipeFromChatText(msgContent, isAntiWaste);
      const recipeId = await saveRecipe(uid, parsed, currentPantryId || null);

      const newRecipe: Recipe = {
        ...parsed,
        recipeId,
        recipeAuthorUid: uid,
      };

      setSavedRecipes((prev) => [newRecipe, ...prev.filter((r) => r.recipeId !== recipeId)]);
      setSavedMessageIndexes((prev) => new Set([...prev, msgIndex]));

      // Seleziona la ricetta appena salvata per aprirla inline
      setSelectedRecipe(newRecipe);
    } catch (err) {
      console.error("Errore salvataggio ricetta:", err);
      alert("Errore durante il salvataggio della ricetta.");
    } finally {
      setSavingRecipeIdx(null);
    }
  };

  // Toggle selezione ricetta dal carosello
  const handleSelectCarouselRecipe = (recipe: Recipe) => {
    if (selectedRecipe?.recipeId === recipe.recipeId) {
      setSelectedRecipe(null);
    } else {
      setSelectedRecipe(recipe);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Ambient Glow quando Live Chef è attivo */}
      {isLiveActive && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 transition-all duration-700 z-0 ${
            liveStatus === "speaking"
              ? "ring-4 ring-indigo-500/20 shadow-[inset_0_0_80px_rgba(99,102,241,0.14)] animate-pulse"
              : liveStatus === "listening"
              ? "ring-4 ring-emerald-500/20 shadow-[inset_0_0_70px_rgba(16,185,129,0.12)]"
              : "ring-2 ring-amber-500/15"
          }`}
        />
      )}

      {/* Top Bar Intestazione */}
      <header className="p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-900/50">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Ricettario & Chef AI
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {savedRecipes.length} {savedRecipes.length === 1 ? "ricetta salvata" : "ricette salvate"}
              </p>
            </div>
          </div>

          {isLiveActive && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse">
              <Radio className="w-3.5 h-3.5 text-indigo-500" />
              <span>Live Attivo</span>
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col z-1">
        {/* PARTE ALTA: Carosello di Ricette */}
        <section aria-label="Carosello Ricettario">
          <RecipeCarousel
            savedRecipes={savedRecipes}
            antiWasteRecipes={antiWasteRecipes}
            selectedRecipeId={selectedRecipe?.recipeId || null}
            onSelectRecipe={handleSelectCarouselRecipe}
            loadingAntiWaste={loadingAntiWaste}
            onRefreshAntiWaste={() => currentPantryId && generateAntiWasteIdeas(currentPantryId)}
            pantryProducts={pantryItems}
          />

          {/* Dettaglio Espanso Inline della Ricetta Selezionata */}
          {selectedRecipe && (
            <RecipeInlineDetail
              recipe={selectedRecipe}
              pantryId={currentPantryId}
              pantryProducts={pantryItems}
              onClose={() => setSelectedRecipe(null)}
              onRecipeUpdated={() => auth.currentUser && loadSavedRecipes(auth.currentUser.uid, currentPantryId)}
              onRecipeDeleted={(id) => {
                setSavedRecipes((prev) => prev.filter((r) => r.recipeId !== id));
                setSelectedRecipe(null);
              }}
            />
          )}
        </section>

        {/* PARTE BASSA: Chatbot Conversazionale / Chef AI */}
        <section aria-label="Chatbot Chef AI" className="flex-1 flex flex-col mt-2">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Assistente Chef AI
              </h2>
            </div>
            <span className="text-[11px] text-zinc-400">{modelName}</span>
          </div>

          {/* Contenitore Messaggi Scrollabile */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-3 min-h-[280px] max-h-[500px] p-2 -mx-2 rounded-2xl bg-zinc-100/40 dark:bg-zinc-900/30 border border-zinc-200/50 dark:border-zinc-800/50"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400 text-xs text-center px-4">
                <ChefHat className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="font-semibold text-zinc-600 dark:text-zinc-300">
                  Chiedi un consiglio o una ricetta personalizzata!
                </p>
                <p className="text-[11px] mt-1 max-w-sm">
                  Puoi usare i bottoni rapidi in basso o digitare ciò che hai voglia di cucinare.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isSaved = savedMessageIndexes.has(idx);
              const isSavingThis = savingRecipeIdx === idx;

              return (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                >
                  <div
                    className={`px-4 py-3 max-w-[90%] sm:max-w-[85%] rounded-2xl shadow-xs whitespace-pre-wrap relative ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none"
                    }`}
                  >
                    {/* Badge messaggi vocali */}
                    {msg.isLiveVoice && (
                      <div className="flex items-center gap-1 mb-1 opacity-75 text-[10px] font-semibold uppercase tracking-wider">
                        <Radio className="w-3 h-3 animate-pulse text-current" />
                        <span>
                          {msg.role === "user"
                            ? msg.isInterim
                              ? "Tu (Parlando...)"
                              : "Tu (Vocale)"
                            : "Chef Live"}
                        </span>
                      </div>
                    )}

                    {msg.content}

                    {msg.isInterim && msg.role === "user" && (
                      <span className="inline-block w-1.5 h-3 ml-1 bg-white/80 animate-pulse rounded-full align-middle" />
                    )}

                    {isLiveActive && liveStatus === "speaking" && msg.role === "ai" && idx === messages.length - 1 && (
                      <span className="inline-flex items-end gap-0.5 ml-2 h-3 text-indigo-500">
                        <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce" />
                        <span className="w-1 h-2 bg-indigo-500 rounded-full animate-bounce delay-75" />
                        <span className="w-1 h-3 bg-indigo-500 rounded-full animate-bounce delay-150" />
                      </span>
                    )}
                  </div>

                  {/* Pulsante rapido "Salva nel Ricettario" per risposte AI */}
                  {msg.role === "ai" && !msg.isInterim && (
                    <div className="mt-1.5 ml-1">
                      {isSaved ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          Salvata nel Ricettario
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSaveRecipeFromChat(msg.content, idx, msg.isAntiWaste)}
                          disabled={isSavingThis}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 hover:text-emerald-600 transition-colors shadow-2xs"
                        >
                          {isSavingThis ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                              <span>Salvataggio...</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Salva nel Ricettario</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none px-4 py-4 w-full max-w-[85%] shadow-xs">
                  <div className="flex items-center gap-2 mb-3 text-emerald-600 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Lo Chef sta pensando...</span>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Barra Input & Azioni Rapide */}
          <div className="mt-3 pt-2">
            {!isLiveActive && (
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleExpiringProducts}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                  <span>Cucina alimenti in scadenza</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50"
                >
                  <ListPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                  <span>Scegli ingredienti</span>
                </button>
              </div>
            )}

            {isLiveActive ? (
              /* Capsule Chef Live */
              <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-900 dark:bg-black text-white rounded-2xl shadow-xl border border-white/15 transition-all duration-300 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={handleBargeIn}
                    disabled={liveStatus !== "speaking"}
                    title={liveStatus === "speaking" ? "Tocca per interrompere la voce dello Chef" : "Chef Vocale Live Attivo"}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      liveStatus === "speaking"
                        ? "bg-indigo-600 ring-4 ring-indigo-400/30 animate-pulse cursor-pointer hover:bg-indigo-500 active:scale-95"
                        : liveStatus === "listening"
                        ? "bg-emerald-600 ring-4 ring-emerald-400/30"
                        : "bg-amber-600"
                    }`}
                  >
                    {liveStatus === "connecting" ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : liveStatus === "speaking" ? (
                      <Volume2 className="w-5 h-5 text-white" />
                    ) : (
                      <ChefHat className="w-5 h-5 text-white" />
                    )}

                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                        liveStatus === "speaking"
                          ? "bg-indigo-400 animate-ping"
                          : liveStatus === "listening"
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                  </button>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-100 truncate">Chef Vocale Live</span>
                      {isMuted && (
                        <span className="text-[10px] bg-red-500/20 text-red-300 font-semibold px-1.5 py-0.2 rounded-full border border-red-500/30">
                          Muto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {liveError ? (
                        <span className="text-[11px] text-red-400 truncate flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {liveError}
                        </span>
                      ) : liveStatus === "speaking" ? (
                        <span className="text-[11px] text-indigo-300 font-medium animate-pulse flex items-center gap-1.5">
                          <span>Lo Chef sta parlando</span>
                        </span>
                      ) : liveStatus === "listening" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-emerald-400 font-medium">In ascolto</span>
                          <div className="flex items-center gap-0.5 h-3">
                            {[0.3, 0.6, 1.0, 0.7, 0.4].map((mult, i) => {
                              const h = Math.max(3, Math.min(12, Math.round(audioLevel * 14 * mult)));
                              return (
                                <div
                                  key={i}
                                  className="w-0.5 bg-emerald-400 rounded-full transition-all duration-75"
                                  style={{ height: `${h}px` }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-300">Connessione in corso...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    disabled={liveStatus === "connecting"}
                    className={`p-2.5 rounded-xl transition-all ${
                      isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                    title={isMuted ? "Riattiva microfono" : "Disattiva microfono"}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={stopLiveChefSession}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-slate-200 hover:bg-red-600/80 hover:text-white transition-all text-xs font-semibold"
                    title="Termina modalità Live"
                  >
                    <Keyboard className="w-4 h-4" />
                    <span className="hidden sm:inline">Chiudi</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Modalità Standard: Input Testo + Dettatura + Live Chef */
              <form className="relative flex items-center gap-2" onSubmit={handleChatSubmit}>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Chiedi una ricetta, varianti o consigli..."
                    disabled={isLoading}
                    className="w-full pl-4 pr-12 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs transition-colors disabled:opacity-50 text-sm"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs"
                    disabled={!input.trim() || isLoading}
                    title="Invia richiesta"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsVoiceDictationOpen(true)}
                  className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-xs shrink-0"
                  title="Dettatura vocale ricetta con trascrizione"
                >
                  <Mic className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </button>

                <button
                  type="button"
                  onClick={startLiveChefSession}
                  className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xs shrink-0 transition-all active:scale-95 text-xs font-semibold cursor-pointer"
                  title="Avvia Chef Vocale Live a mani libere"
                >
                  <ChefHat className="w-5 h-5 text-white" />
                  <span className="hidden sm:inline">Live</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Modal Selezione Elementi */}
      <SelectItemForChatbot
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pantryItems={pantryItems}
        selectedItems={selectedItems}
        toggleItemSelection={toggleItemSelection}
        onGenerate={handleGenerateFromSelection}
      />

      {/* Modal Dettatura Vocale per Chat */}
      <VoiceDictationModal
        isOpen={isVoiceDictationOpen}
        onClose={() => setIsVoiceDictationOpen(false)}
        title="Dettatura Richiesta Ricetta"
        contextMode="chat_message"
        onTranscriptReady={(transcript) => {
          setInput(transcript);
          setIsVoiceDictationOpen(false);
        }}
      />
    </div>
  );
}
