"use server";

import {
  recipeExpirationFlow,
  recipeFromIngredientsFlow,
  recipeChatbotFlow,
  analyzeImageProductsFlow,
  voiceDictationParserFlow,
  antiWasteWeeklyPlanFlow,
  singleMealSuggestionFlow,
  pantryCopilotFlow,
  extractStructuredRecipeFlow,
  GENKIT_FLOWS_MANIFEST,
  type DetectedProductItem,
  type VoiceActionType,
  type ExistingPantryProduct,
  type ParsedVoiceItem,
  type VoiceParsingResult,
  type AIPerDayMealSlot,
  type AIMealPlanResponse,
  type PantryCopilotContext,
  type PantryCopilotResult,
  type GenkitFlowMetadata,
} from "./flows";
import type { Recipe } from "@/types/firestore/recipeType";
import { parseRecipeFromChatText } from "@/lib/recipes/recipeParser";

// Re-export dei tipi pubblici per preservare la compatibilità con tutti i componenti client/server
export type {
  DetectedProductItem,
  VoiceActionType,
  ExistingPantryProduct,
  ParsedVoiceItem,
  VoiceParsingResult,
  AIPerDayMealSlot,
  AIMealPlanResponse,
  PantryCopilotContext,
  PantryCopilotResult,
  GenkitFlowMetadata,
};

export interface IdentifiedProductResult {
  productName: string;
  productCategory: string;
  success: boolean;
}

export interface PantryContextProduct {
  name: string;
  quantity: string | number;
  category?: string;
  expiryDate?: string;
  isExpiringSoon?: boolean;
}

const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export async function getGeminiModelName() {
  return geminiModel;
}

/**
 * Restituisce il catalogo completo dei flussi Genkit registrati,
 * con metadati di architettura, modelli e superfici client collegate.
 */
export async function getGenkitFlowsCatalog(): Promise<GenkitFlowMetadata[]> {
  return GENKIT_FLOWS_MANIFEST;
}

// ============================================================================
// 1. RICETTE DA SCADENZE (Tracciato tramite recipeExpirationFlow)
// ============================================================================
export async function generateRecipeExpiration(
  prodotti: { nome: string; quantita: string }[]
): Promise<string> {
  console.log("[Genkit Flow: recipeExpirationFlow] Avvio elaborazione ricetta anti-spreco...");
  try {
    const text = await recipeExpirationFlow(prodotti);
    console.log("[Genkit Flow: recipeExpirationFlow] Completato con successo.");
    return text;
  } catch (error) {
    console.error("[Genkit Flow: recipeExpirationFlow] Errore esecuzione:", error);
    return "Generazione ricetta fallita.";
  }
}

// ============================================================================
// 2. RICETTE DA INGREDIENTI SELEZIONATI (Tracciato tramite recipeFromIngredientsFlow)
// ============================================================================
export async function generateRecipeFromIngredients(
  prodotti: { nome: string; quantita: string }[]
): Promise<string> {
  console.log("[Genkit Flow: recipeFromIngredientsFlow] Avvio elaborazione ricetta da ingredienti...");
  try {
    const text = await recipeFromIngredientsFlow(prodotti);
    console.log("[Genkit Flow: recipeFromIngredientsFlow] Completato con successo.");
    return text;
  } catch (error) {
    console.error("[Genkit Flow: recipeFromIngredientsFlow] Errore esecuzione:", error);
    return "Generazione ricetta fallita.";
  }
}

// ============================================================================
// 3. CHATBOT CULINARIO (Tracciato tramite recipeChatbotFlow)
// ============================================================================
export async function generateRecipeChatbot(
  promptChatbot: string,
  history: { role: "user" | "ai"; content: string }[] = [],
  prodotti?: { nome: string; quantita: string }[]
): Promise<string> {
  console.log("[Genkit Flow: recipeChatbotFlow] Richiesta chat ricevuta...");
  try {
    const text = await recipeChatbotFlow({
      promptChatbot,
      history,
      prodotti,
    });
    console.log("[Genkit Flow: recipeChatbotFlow] Risposta generata.");
    return text;
  } catch (error) {
    console.error("[Genkit Flow: recipeChatbotFlow] Errore esecuzione:", error);
    return "Ops, si è verificato un errore durante la generazione della risposta.";
  }
}

export async function chatWithChefAI(
  message: string,
  history: { role: "user" | "ai"; content: string }[] = [],
  pantryItems: string[] = []
): Promise<string> {
  const prodotti = pantryItems.map((item) => ({ nome: item, quantita: "1" }));
  return generateRecipeChatbot(message, history, prodotti);
}

// ============================================================================
// 4. SMART VISION MULTI-ITEM & OCR (Tracciato tramite analyzeImageProductsFlow)
// ============================================================================
export async function analyzeImageProducts(
  base64Image: string,
  pantryCategories?: string[]
): Promise<{ products: DetectedProductItem[]; success: boolean }> {
  console.log("[Genkit Flow: analyzeImageProductsFlow] Avvio analisi visiva multimodale...");
  try {
    const result = await analyzeImageProductsFlow({
      base64Image,
      pantryCategories,
    });
    console.log(`[Genkit Flow: analyzeImageProductsFlow] Rilevati ${result.products.length} prodotti.`);
    return result;
  } catch (error) {
    console.error("[Genkit Flow: analyzeImageProductsFlow] Errore analisi visiva:", error);
    return { products: [], success: false };
  }
}

export async function identifyProductFromImage(
  base64Image: string
): Promise<IdentifiedProductResult> {
  const multiResult = await analyzeImageProducts(base64Image);
  if (multiResult.success && multiResult.products.length > 0) {
    const first = multiResult.products[0];
    return {
      productName: first.name,
      productCategory: first.category,
      success: true,
    };
  }
  return {
    productName: "",
    productCategory: "Altro",
    success: false,
  };
}

// ============================================================================
// 5. DETTATURA VOCALE ED ESTRAZIONE AZIONI (Tracciato tramite voiceDictationParserFlow)
// ============================================================================
export async function transcribeAndParseVoiceInput(
  audioBase64: string,
  mimeType = "audio/webm",
  contextMode: "shopping_list" | "inventory" | "chat_message" = "shopping_list",
  pantryCategories?: string[],
  existingProducts?: ExistingPantryProduct[]
): Promise<VoiceParsingResult> {
  console.log(`[Genkit Flow: voiceDictationParserFlow] Avvio elaborazione audio (mode: ${contextMode})...`);
  try {
    const result = await voiceDictationParserFlow({
      audioBase64,
      mimeType,
      contextMode,
      pantryCategories,
      existingProducts,
    });
    console.log("[Genkit Flow: voiceDictationParserFlow] Elaborazione completata.");
    return result;
  } catch (error) {
    console.error("[Genkit Flow: voiceDictationParserFlow] Errore elaborazione audio:", error);
    return { rawTranscript: "", items: [], success: false };
  }
}

// ============================================================================
// 6. GEMINI LIVE WEBSOCKET CONFIG & CONTEXT
// ============================================================================
export async function getGeminiLiveConfig(clientAuthToken?: string) {
  if (
    process.env.NODE_ENV === "production" &&
    (!clientAuthToken || typeof clientAuthToken !== "string" || !clientAuthToken.trim())
  ) {
    console.warn("Tentativo di accesso non autenticato a getGeminiLiveConfig rifiutato.");
    return {
      apiKey: "",
      model: "",
      error: "Richiesta non autorizzata: autenticazione necessaria.",
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  const liveModel = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
  return {
    apiKey,
    model: liveModel,
  };
}

export async function buildLiveChefPantryContext(
  prodotti: PantryContextProduct[] = [],
  customRecipeContext: string = ""
): Promise<string> {
  const parts: string[] = [];
  const safeProdotti = Array.isArray(prodotti) ? prodotti : [];

  if (safeProdotti.length > 0) {
    const expiringItems = safeProdotti.filter((p) => p && p.isExpiringSoon);
    const standardItems = safeProdotti.filter((p) => p && !p.isExpiringSoon);

    let dispensaText = "--- STATO REALE DISPENSA UTENTE ---\n";
    if (expiringItems.length > 0) {
      dispensaText += "⚠️ PRODOTTI IN SCADENZA RAVVICINATA (USARE CON MASSIMA PRIORITÀ CONTRO GLI SPRECHI):\n";
      dispensaText += expiringItems
        .map(
          (p) =>
            `• ${p.name}: quantità ${p.quantity}${p.category ? ` [${p.category}]` : ""}${
              p.expiryDate ? ` (scadenza: ${p.expiryDate})` : ""
            }`
        )
        .join("\n");
      dispensaText += "\n\n";
    }

    if (standardItems.length > 0) {
      dispensaText += "ALTRI INGREDIENTI DISPONIBILI NELLA DISPENSA:\n";
      dispensaText += standardItems
        .map((p) => `• ${p.name}: quantità ${p.quantity}${p.category ? ` [${p.category}]` : ""}`)
        .join("\n");
      dispensaText += "\n\n";
    }

    dispensaText +=
      "LINEE GUIDA CHEF VOCALE:\n" +
      "1. Conosci perfettamente la lista sopra. Quando l'utente ti chiede 'cosa posso cucinare?' o idee ricette, proponi SOLO piatti realizzabili con questi ingredienti, privilegiando quelli in scadenza.\n" +
      "2. Non inventare ingredienti esotici non presenti. Puoi dare per scontati solo condimenti elementari (olio, sale, pepe, acqua).\n" +
      "3. Se l'utente ti chiede un ingrediente assente, confermagli chiaramente che non è presente nella sua dispensa.\n" +
      "4. RITMO E VOCE: Rispondi SEMPRE in italiano con ritmo CALMO, RILASSATO, NATURALE e TRANQUILLO. Scandisci bene ogni singola parola senza alcuna fretta, facendo pause naturali tra le frasi (2-3 frasi brevi, calde e rassicuranti per intervento). Non parlare mai velocemente.";

    parts.push(dispensaText);
  } else {
    parts.push(
      "DISPENSA ATTUALE: Al momento non ci sono prodotti registrati nella dispensa dell'utente. Chiedi cordialmente all'utente quali ingredienti ha a portata di mano."
    );
  }

  if (customRecipeContext && customRecipeContext.trim()) {
    parts.push(`CONTESTO RICETTA/AZIONE IN CORSO: ${customRecipeContext.trim()}`);
  }

  return parts.join("\n\n");
}

// ============================================================================
// 7. PIANO SETTIMANALE ANTI-SPRECO (Tracciato tramite antiWasteWeeklyPlanFlow)
// ============================================================================
export async function generateAIAntiWasteWeeklyPlan(
  days: { dateStr: string; dayName: string }[],
  expiringProducts: { name: string; quantity: string; expiryDate?: string }[] = [],
  availableProducts: { name: string; quantity: string }[] = []
): Promise<AIMealPlanResponse | null> {
  console.log("[Genkit Flow: antiWasteWeeklyPlanFlow] Avvio pianificazione settimanale anti-spreco...");
  try {
    const result = await antiWasteWeeklyPlanFlow({
      days,
      expiringProducts,
      availableProducts,
    });
    console.log("[Genkit Flow: antiWasteWeeklyPlanFlow] Piano settimanale generato.");
    return result;
  } catch (err) {
    console.error("[Genkit Flow: antiWasteWeeklyPlanFlow] Errore esecuzione:", err);
    return null;
  }
}

// ============================================================================
// 8. CONSIGLIO SINGOLO PASTO MIRATO (Tracciato tramite singleMealSuggestionFlow)
// ============================================================================
export async function generateSingleMealSuggestion(
  slotType: "colazione" | "pranzo" | "merenda" | "cena",
  dayName: string,
  expiringProducts: { name: string; quantity: string }[] = [],
  availableProducts: { name: string; quantity: string }[] = []
): Promise<{ recipeTitle: string; notes?: string; ingredients: { name: string; quantity?: string }[] } | null> {
  console.log(`[Genkit Flow: singleMealSuggestionFlow] Suggerimento pasto per ${slotType} (${dayName})...`);
  try {
    const result = await singleMealSuggestionFlow({
      slotType,
      dayName,
      expiringProducts,
      availableProducts,
    });
    console.log("[Genkit Flow: singleMealSuggestionFlow] Piatto consigliato con successo.");
    return result;
  } catch (err) {
    console.error("[Genkit Flow: singleMealSuggestionFlow] Errore esecuzione:", err);
    return null;
  }
}

// ============================================================================
// 9. PANTRY COPILOT CON AZIONI PROPOSTE (Tracciato tramite pantryCopilotFlow)
// ============================================================================
export async function chatWithPantryCopilot(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  context: PantryCopilotContext = {}
): Promise<PantryCopilotResult> {
  console.log("[Genkit Flow: pantryCopilotFlow] Ricevuto messaggio Copilot dispensa...");
  try {
    const result = await pantryCopilotFlow({
      message,
      history,
      context,
    });
    console.log(
      `[Genkit Flow: pantryCopilotFlow] Risposta generata con ${result.proposedActions.length} azioni proposte.`
    );
    return result;
  } catch (error) {
    console.error("[Genkit Flow: pantryCopilotFlow] Errore esecuzione:", error);
    return {
      reply: "Si è verificato un errore durante la comunicazione con l'assistente. Riprova.",
      proposedActions: [],
      success: false,
    };
  }
}

// ============================================================================
// 9. ESTRAZIONE STRUTTURATA RICETTA (Tracciato tramite extractStructuredRecipeFlow)
// ============================================================================
export async function extractStructuredRecipe(
  chatText: string,
  isAntiWaste = false
): Promise<Omit<Recipe, "recipeId" | "recipeAuthorUid" | "recipeCreatedAt">> {
  console.log("[Genkit Flow: extractStructuredRecipeFlow] Estrazione ricetta strutturata...");
  try {
    const structured = await extractStructuredRecipeFlow({
      chatText,
      isAntiWaste,
    });
    console.log("[Genkit Flow: extractStructuredRecipeFlow] Ricetta estratta con successo:", structured.recipeTitle);
    const difficultyMapped: "facile" | "media" | "difficile" =
      structured.recipeDifficulty || "facile";

    return {
      recipeTitle: structured.recipeTitle,
      recipeDescription: structured.recipeDescription,
      recipeIngredients: structured.recipeIngredients,
      recipeInstructions: structured.recipeInstructions,
      recipePrepTimeMinutes: structured.recipePrepTimeMinutes,
      recipeServings: structured.recipeServings,
      recipeDifficulty: difficultyMapped,
      recipeIsAntiWaste: structured.recipeIsAntiWaste ?? isAntiWaste,
    };
  } catch (error) {
    console.error("[Genkit Flow: extractStructuredRecipeFlow] Fallback errore esecuzione:", error);
    return parseRecipeFromChatText(chatText, isAntiWaste);
  }
}

