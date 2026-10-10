// Carica variabili d'ambiente se eseguito al di fuori di Next.js (es. Genkit CLI, tsx, worker)
if (typeof process !== "undefined" && typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile(".env.local");
  } catch {
    try {
      (process as any).loadEnvFile(".env");
    } catch {
      // Ignora se i file env non sono presenti nel filesystem
    }
  }
}

import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import type { ProposedAction } from "@/types/assistant/assistantType";
import { parseRecipeFromChatText } from "@/lib/recipes/recipeParser";

// Inizializzazione Istanza di Genkit con fallback sicuro
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

export const ai = genkit({
  plugins: [googleAI(apiKey ? { apiKey } : undefined)],
  model: googleAI.model(geminiModel),
});

/**
 * Utility per estrarre in modo ultra-robusto blocchi JSON da risposte LLM,
 * gestendo trailing commas, markdown, preamboli, postscript e strutture miste.
 */
export function extractJsonFromResponse<T = any>(text: string): T {
  if (!text || typeof text !== "string") {
    throw new Error("Testo di risposta non valido o vuoto.");
  }

  const trimmed = text.trim();

  const tryParse = (str: string): T | null => {
    try {
      return JSON.parse(str);
    } catch {
      try {
        // Rimuove virgole finali frequenti nelle risposte degli LLM (, } o , ])
        const sanitized = str.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  };

  // 1. Parsing diretto del testo integrale
  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  // 2. Estrazione da blocchi di codice markdown ```json ... ``` o ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const blockContent = match[1]?.trim();
    if (blockContent) {
      const parsed = tryParse(blockContent);
      if (parsed !== null) return parsed;
    }
  }

  // 3. Raccolta candidati esterni più ampi {...} e [...]
  const candidates: string[] = [];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.substring(firstBrace, lastBrace + 1));
  }

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(text.substring(firstBracket, lastBracket + 1));
  }

  if (firstBrace !== -1 && firstBracket !== -1 && firstBracket < firstBrace && lastBracket >= lastBrace) {
    candidates.reverse();
  }

  const parsedCandidates: T[] = [];
  for (const cand of candidates) {
    const parsed = tryParse(cand);
    if (parsed !== null) parsedCandidates.push(parsed);
  }

  if (parsedCandidates.length > 0) {
    // Preferisci il candidato non vuoto se disponibile
    const rich = parsedCandidates.find(
      (c) => typeof c === "object" && c !== null && Object.keys(c).length > 0
    );
    return rich || parsedCandidates[0];
  }

  // 4. Scansione iterativa bilanciata (per evitare trappole di esempi o frammenti preambolo)
  const searchBalanced = (openChar: "{" | "[", closeChar: "}" | "]"): T | null => {
    let depth = 0;
    let startIdx = -1;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === openChar) {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (char === closeChar && depth > 0) {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const segment = text.substring(startIdx, i + 1);
          const parsed = tryParse(segment);
          if (parsed !== null) return parsed;
        }
      }
    }
    return null;
  };

  const balancedArray = searchBalanced("[", "]");
  if (balancedArray !== null && (!Array.isArray(balancedArray) || balancedArray.length > 0)) {
    return balancedArray;
  }

  const balancedObj = searchBalanced("{", "}");
  if (balancedObj !== null) return balancedObj;

  throw new Error("Nessun frammento JSON valido individuato nella risposta del modello.");
}

// ============================================================================
// 1. FLOW: RECIPE FROM EXPIRATION
// ============================================================================
export const RecipeExpirationInputSchema = z.array(
  z.object({
    nome: z.string(),
    quantita: z.string(),
  })
);

export const recipeExpirationFlow = ai.defineFlow(
  {
    name: "recipeExpirationFlow",
    inputSchema: RecipeExpirationInputSchema,
    outputSchema: z.string(),
  },
  async (prodotti) => {
    if (!prodotti || prodotti.length === 0) {
      return "Nessun prodotto in scadenza selezionato per la generazione della ricetta.";
    }

    const ingredientiFormattati = prodotti
      .map((p) => `${p.quantita} di ${p.nome}`)
      .join(", ");
    const promptExpiration = `Sei uno chef esperto. I seguenti ingredienti stanno per scadere: ${ingredientiFormattati}. Crea una breve ricetta per utilizzarli, evitando gli sprechi.`;

    const { text } = await ai.generate(promptExpiration);
    return text || "Generazione ricetta fallita.";
  }
);

// ============================================================================
// 2. FLOW: RECIPE FROM SELECTED INGREDIENTS
// ============================================================================
export const RecipeFromIngredientsInputSchema = z.array(
  z.object({
    nome: z.string(),
    quantita: z.string(),
  })
);

export const recipeFromIngredientsFlow = ai.defineFlow(
  {
    name: "recipeFromIngredientsFlow",
    inputSchema: RecipeFromIngredientsInputSchema,
    outputSchema: z.string(),
  },
  async (prodotti) => {
    if (!prodotti || prodotti.length === 0) {
      return "Nessun ingrediente selezionato dalla dispensa.";
    }

    const ingredientiFormattati = prodotti
      .map((p) => `${p.quantita} di ${p.nome}`)
      .join(", ");
    const promptSelected = `Sei uno chef esperto. L'utente ha selezionato i seguenti ingredienti dalla sua dispensa: ${ingredientiFormattati}. Crea una ricetta gustosa per utilizzarli al meglio. Cerca di essere creativo ma pratico.`;

    const { text } = await ai.generate(promptSelected);
    return text || "Generazione ricetta fallita.";
  }
);

// ============================================================================
// 3. FLOW: CHEF AI RECIPE CHATBOT
// ============================================================================
export const RecipeChatbotInputSchema = z.object({
  promptChatbot: z.string(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "ai"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  prodotti: z
    .array(
      z.object({
        nome: z.string(),
        quantita: z.string(),
      })
    )
    .optional(),
});

const promptChefRole = `Sei uno chef esperto e un assistente culinario personale. Il tuo obiettivo è aiutare l'utente con ricette deliziose, consigli pratici e idee per ridurre gli sprechi.
Regole fondamentali di formattazione della ricetta:
- Usa sempre Markdown pulito e ben strutturato.
- Intestazione principale: inizia con '# Nome Ricetta' (senza prefissi numerici come '1.' o categorie come 'Per i Dolci:').
- Sezione Ingredienti: intitola '## Ingredienti' ed elenca ciascun ingrediente su una riga separata con punto elenco (- Quantità Nome). Non inserire MAI più ingredienti diversi sulla stessa riga separati da virgole.
- Sezione Preparazione: intitola '## Preparazione' ed elenca i passaggi numerati (1. Passaggio, 2. Passaggio).
- Note o consigli di servizio: se presenti, inseriscili alla fine sotto '## Consigli dello Chef' e MAI all'interno della lista degli ingredienti.`;

export const recipeChatbotFlow = ai.defineFlow(
  {
    name: "recipeChatbotFlow",
    inputSchema: RecipeChatbotInputSchema,
    outputSchema: z.string(),
  },
  async ({ promptChatbot, history = [], prodotti }) => {
    if (!promptChatbot || !promptChatbot.trim()) {
      return "Scrivi una domanda o una richiesta culinaria per iniziare.";
    }

    let contextDispensa = "";
    if (prodotti && prodotti.length > 0) {
      const ingredientiFormattati = prodotti
        .map((p) => `${p.quantita} di ${p.nome}`)
        .join(", ");
      contextDispensa = ` Contesto aggiuntivo: l'utente ha attualmente a disposizione nella sua dispensa i seguenti ingredienti: ${ingredientiFormattati}. Quando suggerisci una ricetta o rispondi, tieni a mente questi ingredienti e cerca di dare la priorità a ciò che l'utente ha già, se pertinente alla sua richiesta.`;
    }

    const systemPrompt = promptChefRole + contextDispensa;

    const messages = [
      { role: "system" as const, content: [{ text: systemPrompt }] },
      ...history.map((msg) => ({
        role: msg.role === "ai" ? ("model" as const) : ("user" as const),
        content: [{ text: msg.content }],
      })),
      { role: "user" as const, content: [{ text: promptChatbot }] },
    ];

    const { text } = await ai.generate({ messages });
    return text || "Ops, si è verificato un errore durante la generazione della risposta.";
  }
);

// ============================================================================
// 4. FLOW: SMART VISION MULTI-ITEM & OCR
// ============================================================================
export interface DetectedProductItem {
  name: string;
  category: string;
  quantity: number;
  expiryDate?: string | null;
  shelfLifeDays?: number | null;
  confidence?: "high" | "medium" | "low";
}

export const AnalyzeImageInputSchema = z.object({
  base64Image: z.string(),
  pantryCategories: z.array(z.string()).optional(),
});

export const AnalyzeImageOutputSchema = z.object({
  products: z.array(
    z.object({
      name: z.string(),
      category: z.string(),
      quantity: z.number(),
      expiryDate: z.string().nullable().optional(),
      shelfLifeDays: z.number().nullable().optional(),
      confidence: z.enum(["high", "medium", "low"]).optional(),
    })
  ),
  success: z.boolean(),
});

export const analyzeImageProductsFlow = ai.defineFlow(
  {
    name: "analyzeImageProductsFlow",
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async ({ base64Image, pantryCategories }) => {
    if (!base64Image || typeof base64Image !== "string") {
      return { products: [], success: false };
    }

    let imageUrl = base64Image;
    if (!imageUrl.startsWith("data:")) {
      imageUrl = `data:image/jpeg;base64,${base64Image}`;
    }

    const catList =
      pantryCategories && pantryCategories.length > 0
        ? pantryCategories.join(", ")
        : "Latticini, Carne, Pesce, Frutta, Verdura, Bevande, Dolci, Snack, Pasta, Surgelati, Altro";

    const promptText = `Sei un assistente visivo culinario avanzato per la catalogazione della dispensa domestica.
Analizza con accuratezza l'immagine fornita:
1. Rileva tutti i prodotti alimentari distinti visibili nell'inquadratura (fino a 8 alimenti).
2. Per ogni prodotto identificato:
   - "name": Nome chiaro ed esplicito in italiano (es. "Mele Golden", "Latte Intero", "Pasta Penne Rigate").
   - "category": La categoria più adatta scelta RIGOROSAMENTE tra: [${catList}]. Se non sicura, usa "Altro".
   - "quantity": Quantità stimata visibile come numero intero (default 1).
   - "expiryDate": Se su confezione o etichetta è stampata una data di scadenza (es. '15/10/26' o '15 OTT 2026'), convertila in 'YYYY-MM-DD'. Se non leggibile con chiarezza, inserisci null.
   - "shelfLifeDays": Per alimenti freschi/sfusi senza etichetta stampata (frutta, verdura, pane, carne fresca), stima i giorni consigliati di conservazione a temperatura corretta (es. 5, 7, 3). Altrimenti null.
   - "confidence": "high" | "medium" | "low".

Rispondi ESCLUSIVAMENTE con un array o oggetto JSON valido nella seguente struttura:
{
  "products": [
    {
      "name": "Nome",
      "category": "Categoria",
      "quantity": 1,
      "expiryDate": "YYYY-MM-DD" o null,
      "shelfLifeDays": 7 o null,
      "confidence": "high"
    }
  ]
}`;

    const messages = [
      {
        role: "user" as const,
        content: [{ media: { url: imageUrl } }, { text: promptText }],
      },
    ];

    const { text } = await ai.generate({ messages });
    if (!text) {
      return { products: [], success: false };
    }

    let rawList: Partial<DetectedProductItem>[] = [];
    try {
      const parsed = extractJsonFromResponse<{ products?: Partial<DetectedProductItem>[] } | Partial<DetectedProductItem>[]>(text);
      rawList = Array.isArray(parsed) ? parsed : parsed.products || [];
    } catch (parseErr) {
      console.warn("[analyzeImageProductsFlow] Errore parsing JSON vision:", parseErr);
      return { products: [], success: false };
    }

    const sanitizedProducts: DetectedProductItem[] = rawList.map((item) => ({
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Alimento rilevato",
      category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "Altro",
      quantity: typeof item.quantity === "number" && item.quantity > 0 ? Math.floor(item.quantity) : 1,
      expiryDate:
        typeof item.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate.trim())
          ? item.expiryDate.trim()
          : null,
      shelfLifeDays:
        typeof item.shelfLifeDays === "number" && item.shelfLifeDays > 0
          ? Math.floor(item.shelfLifeDays)
          : null,
      confidence:
        item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
          ? item.confidence
          : "medium",
    }));

    return {
      products: sanitizedProducts,
      success: sanitizedProducts.length > 0,
    };
  }
);

// ============================================================================
// 5. FLOW: VOICE DICTATION & NLP ACTION PARSER
// ============================================================================
export type VoiceActionType =
  | "create_new"
  | "update_quantity"
  | "open_item"
  | "freeze_item"
  | "unfreeze_item"
  | "consume_item"
  | "add_to_shopping_list";

export interface ExistingPantryProduct {
  id?: string;
  name: string;
  quantity: number;
  category?: string;
  isOpened?: boolean;
  isFrozen?: boolean;
  unit?: string;
}

export interface ParsedVoiceItem {
  name: string;
  quantity: number;
  category: string;
  action: VoiceActionType;
  matchedProductId?: string;
  matchedProductName?: string;
  existingQuantity?: number;
  newTotalQuantity?: number;
  monthsDuration?: number;
}

export interface VoiceParsingResult {
  rawTranscript: string;
  items?: ParsedVoiceItem[];
  success: boolean;
}

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/m4a",
]);

export const VoiceDictationInputSchema = z.object({
  audioBase64: z.string(),
  mimeType: z.string().optional().default("audio/webm"),
  contextMode: z.enum(["shopping_list", "inventory", "chat_message"]).optional().default("shopping_list"),
  pantryCategories: z.array(z.string()).optional(),
  existingProducts: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        quantity: z.number(),
        category: z.string().optional(),
        isOpened: z.boolean().optional(),
        isFrozen: z.boolean().optional(),
        unit: z.string().optional(),
      })
    )
    .optional(),
});

export const voiceDictationParserFlow = ai.defineFlow(
  {
    name: "voiceDictationParserFlow",
    inputSchema: VoiceDictationInputSchema,
    outputSchema: z.object({
      rawTranscript: z.string(),
      items: z.array(z.any()).optional(),
      success: z.boolean(),
    }),
  },
  async ({ audioBase64, mimeType = "audio/webm", contextMode = "shopping_list", pantryCategories, existingProducts }) => {
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return { rawTranscript: "", items: [], success: false };
    }

    // Difesa SSRF: blocca URL esterni o schemi non-data
    if (/^(https?:|file:|ftp:|\/\/)/i.test(audioBase64.trim())) {
      console.warn("Rilevato schema non consentito in audioBase64 (possibile tentativo SSRF).");
      return { rawTranscript: "", items: [], success: false };
    }

    // Difesa Resource Exhaustion: Max 15MB
    if (audioBase64.length > 15 * 1024 * 1024) {
      console.warn("Payload audio eccede la dimensione massima consentita (15MB).");
      return { rawTranscript: "", items: [], success: false };
    }

    // Normalizzazione sicura del MIME type (gestisce anche 'audio/webm;codecs=opus' e 'audio/mp4;codecs=...')
    const baseMime = (mimeType || "").split(";")[0].trim().toLowerCase();
    const safeMime = ALLOWED_AUDIO_MIMES.has(baseMime) ? baseMime : "audio/webm";

    let audioDataUrl = audioBase64;
    if (!audioDataUrl.startsWith("data:")) {
      audioDataUrl = `data:${safeMime};base64,${audioBase64}`;
    }

    const safeCategories = (pantryCategories || [])
      .slice(0, 30)
      .map((c) => (typeof c === "string" ? c.replace(/[\r\n"\\`]/g, "").trim().slice(0, 40) : ""))
      .filter(Boolean);

    const catList =
      safeCategories.length > 0
        ? safeCategories.join(", ")
        : "Latticini, Carne, Pesce, Frutta, Verdura, Bevande, Dolci, Snack, Pasta, Surgelati, Altro";

    const safeExistingProducts = (existingProducts || [])
      .slice(0, 50)
      .map((p) => ({
        id: typeof p.id === "string" ? p.id.slice(0, 50) : "",
        name: typeof p.name === "string" ? p.name.replace(/[\r\n"\\`]/g, "").trim().slice(0, 60) : "",
        quantity: typeof p.quantity === "number" && Number.isFinite(p.quantity) ? p.quantity : 0,
        category: typeof p.category === "string" ? p.category.slice(0, 30) : "Altro",
        isOpened: !!p.isOpened,
        isFrozen: !!p.isFrozen,
      }))
      .filter((p) => p.id && p.name);

    const existingProductsPromptBlock =
      safeExistingProducts.length > 0
        ? `\nPRODOTTI ATTUALMENTE GIÀ PRESENTI NELLA DISPENSA:\n${safeExistingProducts
            .map(
              (p) =>
                `- [ID: "${p.id}", Nome: "${p.name}", Quantità: ${p.quantity}, Categoria: "${p.category}"${
                  p.isFrozen ? ", Congelato" : ""
                }${p.isOpened ? ", Aperto" : ""}]`
            )
            .join("\n")}\n`
        : "";

    let promptInstruction = "";
    if (contextMode === "chat_message") {
      promptInstruction = `Ascolta con attenzione la registrazione audio e trascrivi fedelmente ed esattamente ciò che è stato detto in lingua italiana.
Rispondi RIGOROSAMENTE con un oggetto JSON valido:
{
  "transcript": "Testo trascritto"
}`;
    } else {
      promptInstruction = `Ascolta attentamente la registrazione audio, in cui l'utente sta pronunciando comandi vocali o dettando alimenti per la propria dispensa o spesa.
${existingProductsPromptBlock}
1. Trascrivi fedelmente il testo pronunciato nel campo "transcript".
2. Riconosci ed estrai la lista di tutti gli alimenti o comandi menzionati nel campo "items". Per ciascun elemento:
   - "name": Nome chiaro ed esplicito del prodotto (es. "Latte intero", "Spaghetti", "Carne macinata", "Uova").
   - "quantity": Quantità numerica intera pronunciata (es. 'due litri' o 'due confezioni' -> 2; se non specificata -> 1).
   - "category": Assegna la categoria più opportuna scegliendo ESCLUSIVAMENTE tra: [${catList}]. Se incerta -> "Altro".
   - "action": Determina l'azione esatta in base al verbo o all'intento pronunciato:
     * APERTURA PRODOTTO: Se l'utente dice 'ho aperto', 'apri', 'stappato', 'aperto il...' -> "open_item"
     * CONGELAMENTO: Se l'utente dice 'congela', 'metti nel congelatore', 'metti in freezer', 'surgela' -> "freeze_item" (puoi indicare "monthsDuration": 3 o il numero di mesi detto)
     * SCONGELAMENTO: Se l'utente dice 'scongela', 'tira fuori dal freezer' -> "unfreeze_item"
     * CONSUMO / FINITO: Se l'utente dice 'ho consumato', 'abbiamo finito', 'ho mangiato', 'finito', 'terminato', 'buttato', 'rimuovi' -> "consume_item"
     * AGGIUNTA ALLA SPESA: Se l'utente dice 'compra', 'segna nella spesa', 'metti nella lista spesa', 'serve comprare' o se la pagina attiva è la lista spesa -> "add_to_shopping_list"
     * AGGIORNAMENTO / AGGIUNTA IN DISPENSA:
       - Se l'alimento corrisponde a un prodotto GIÀ PRESENTE nella dispensa sopra -> "update_quantity", con "newTotalQuantity": <quantità attuale + quantità pronunciata>
       - Se l'alimento NON è presente nella dispensa sopra -> "create_new", con "newTotalQuantity": <quantità pronunciata>

   - Se l'azione riguarda un prodotto presente nella lista sopra ("open_item", "freeze_item", "unfreeze_item", "consume_item", "update_quantity"):
     imposta "matchedProductId": "<ID esatto del prodotto nella lista>",
     "matchedProductName": "<Nome esatto del prodotto nella lista>",
     "existingQuantity": <quantità attuale nella lista>

Rispondi RIGOROSAMENTE con un oggetto JSON valido:
{
  "transcript": "Testo trascritto",
  "items": [
    {
      "name": "Nome alimento",
      "quantity": 1,
      "category": "Categoria",
      "action": "open_item" | "freeze_item" | "unfreeze_item" | "consume_item" | "add_to_shopping_list" | "update_quantity" | "create_new",
      "matchedProductId": "id_del_prodotto",
      "matchedProductName": "nome_esistente",
      "existingQuantity": 1,
      "newTotalQuantity": 2,
      "monthsDuration": 3
    }
  ]
}`;
    }

    const messages = [
      {
        role: "user" as const,
        content: [
          { media: { url: audioDataUrl, contentType: safeMime } },
          { text: promptInstruction },
        ],
      },
    ];

    const { text } = await ai.generate({ messages });
    if (!text) {
      return { rawTranscript: "", items: [], success: false };
    }

    let transcript = "";
    let rawItems: Partial<ParsedVoiceItem>[] = [];

    try {
      const parsed = extractJsonFromResponse<{ transcript?: string; items?: Partial<ParsedVoiceItem>[] }>(text);
      transcript = typeof parsed.transcript === "string" ? parsed.transcript.trim().slice(0, 1000) : "";
      rawItems = Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [];
    } catch {
      // Fallback: Se la risposta del modello è testo puro privo di JSON, preserva la trascrizione dell'utente
      transcript = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim().slice(0, 1000);
    }

    const items: ParsedVoiceItem[] = rawItems.map((it) => {
      const rawName = typeof it.name === "string" ? it.name.trim().slice(0, 100) : "Alimento";
      const rawQty =
        typeof it.quantity === "number" && Number.isFinite(it.quantity) && it.quantity > 0
          ? Math.min(999, Math.floor(it.quantity))
          : 1;
      let rawCategory = typeof it.category === "string" ? it.category.trim().slice(0, 40) : "Altro";
      if (safeCategories.length > 0 && !safeCategories.includes(rawCategory)) {
        rawCategory = "Altro";
      }

      const validActions = new Set<VoiceActionType>([
        "create_new",
        "update_quantity",
        "open_item",
        "freeze_item",
        "unfreeze_item",
        "consume_item",
        "add_to_shopping_list",
      ]);

      let action: VoiceActionType = validActions.has(it.action as VoiceActionType)
        ? (it.action as VoiceActionType)
        : contextMode === "shopping_list"
        ? "add_to_shopping_list"
        : "create_new";

      let matchedId = typeof it.matchedProductId === "string" ? it.matchedProductId : undefined;
      let matchedName = typeof it.matchedProductName === "string" ? it.matchedProductName : undefined;
      let existingQty =
        typeof it.existingQuantity === "number" && Number.isFinite(it.existingQuantity)
          ? it.existingQuantity
          : undefined;
      let totalQty =
        typeof it.newTotalQuantity === "number" && Number.isFinite(it.newTotalQuantity)
          ? it.newTotalQuantity
          : rawQty;
      const monthsDuration =
        typeof it.monthsDuration === "number" && it.monthsDuration > 0 ? it.monthsDuration : 3;

      if (safeExistingProducts.length > 0) {
        const lowerName = rawName.toLowerCase();
        const found = safeExistingProducts.find((p) => {
          const pLower = p.name.toLowerCase();
          return p.id === matchedId || pLower === lowerName || pLower.includes(lowerName) || lowerName.includes(pLower);
        });

        if (found) {
          matchedId = found.id;
          matchedName = found.name;
          existingQty = found.quantity;
          rawCategory = found.category || rawCategory;

          if (action === "create_new" && contextMode === "inventory") {
            action = "update_quantity";
            totalQty = found.quantity + rawQty;
          } else if (action === "update_quantity") {
            totalQty = found.quantity + rawQty;
          } else if (action === "consume_item") {
            totalQty = Math.max(0, found.quantity - rawQty);
          }
        }
      }

      return {
        name: rawName || "Alimento",
        quantity: rawQty,
        category: rawCategory,
        action,
        matchedProductId: matchedId,
        matchedProductName: matchedName,
        existingQuantity: existingQty,
        newTotalQuantity: totalQty,
        monthsDuration,
      };
    });

    return {
      rawTranscript: transcript,
      items: contextMode !== "chat_message" ? items : undefined,
      success: true,
    };
  }
);

// ============================================================================
// 6. FLOW: ANTI-WASTE WEEKLY MEAL PLAN
// ============================================================================
export interface AIPerDayMealSlot {
  recipeTitle: string;
  recipeIsAntiWaste: boolean;
  notes?: string;
  ingredients: { name: string; quantity?: string }[];
}

export interface AIMealPlanResponse {
  days: Record<
    string,
    {
      colazione: AIPerDayMealSlot | null;
      pranzo: AIPerDayMealSlot | null;
      merenda: AIPerDayMealSlot | null;
      cena: AIPerDayMealSlot | null;
    }
  >;
}

export const AntiWasteWeeklyPlanInputSchema = z.object({
  days: z.array(
    z.object({
      dateStr: z.string(),
      dayName: z.string(),
    })
  ),
  expiringProducts: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string(),
        expiryDate: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  availableProducts: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const antiWasteWeeklyPlanFlow = ai.defineFlow(
  {
    name: "antiWasteWeeklyPlanFlow",
    inputSchema: AntiWasteWeeklyPlanInputSchema,
    outputSchema: z.any(),
  },
  async ({ days, expiringProducts = [], availableProducts = [] }) => {
    if (!days || !Array.isArray(days) || days.length === 0) {
      return { days: {} };
    }

    let pantryContext = "PRODOTTI IN DISPENSA:\n";
    if (expiringProducts.length > 0) {
      pantryContext +=
        "⚠️ INGREDIENTI IN SCADENZA RAVVICINATA (DA CONSUMARE NEI PRIMI GIORNI: Lun-Mar-Mer):\n" +
        expiringProducts
          .map((p) => `- ${p.name} (${p.quantity})${p.expiryDate ? ` [scade il ${p.expiryDate}]` : ""}`)
          .join("\n") +
        "\n\n";
    }
    if (availableProducts.length > 0) {
      pantryContext +=
        "ALTRI INGREDIENTI DISPONIBILI:\n" +
        availableProducts.map((p) => `- ${p.name} (${p.quantity})`).join("\n") +
        "\n";
    }

    const daysList = days.map((d) => `${d.dateStr} (${d.dayName})`).join(", ");

    const prompt = `Sei lo Chef AI di PantryAI, un assistente culinario esperto e sostenibile specializzato nella riduzione attiva dello spreco alimentare domestico.
Crea un piano pasti settimanale bilanciato per i seguenti 7 giorni: ${daysList}.

${pantryContext}

REGOLE FONDAMENTALI:
1. Per ogni giorno fornisci i 4 pasti: "colazione", "pranzo", "merenda", "cena".
2. PRIORITÀ ASSOLUTA ANTI-SPRECO: Pianifica gli ingredienti in scadenza nei primi giorni della settimana (Lunedì, Martedì, Mercoledì) per evitare che vadano a male. Contrassegna questi pasti con "recipeIsAntiWaste": true.
3. Varia i pasti: alterna carboidrati, proteine (legumi, carne, pesce, uova) e verdure.
4. Per ogni pasto includi una breve lista dei principali "ingredients" con dosi realistiche e un breve consiglio o nota ("notes").

Rispondi RIGOROSAMENTE con un oggetto JSON valido con questa struttura esatta:
{
  "days": {
    "YYYY-MM-DD": {
      "colazione": { "recipeTitle": "Nome Piatto", "recipeIsAntiWaste": false, "notes": "Consiglio", "ingredients": [{ "name": "Ingrediente", "quantity": "dose" }] },
      "pranzo": { "recipeTitle": "Nome Piatto", "recipeIsAntiWaste": true, "notes": "Consiglio", "ingredients": [{ "name": "Ingrediente", "quantity": "dose" }] },
      "merenda": { "recipeTitle": "Nome Piatto", "recipeIsAntiWaste": false, "notes": "Consiglio", "ingredients": [{ "name": "Ingrediente", "quantity": "dose" }] },
      "cena": { "recipeTitle": "Nome Piatto", "recipeIsAntiWaste": true, "notes": "Consiglio", "ingredients": [{ "name": "Ingrediente", "quantity": "dose" }] }
    }
  }
}`;

    const messages = [{ role: "user" as const, content: [{ text: prompt }] }];
    const { text } = await ai.generate({ messages });
    if (!text) return null;

    try {
      return extractJsonFromResponse<AIMealPlanResponse>(text);
    } catch (parseErr) {
      console.warn("[antiWasteWeeklyPlanFlow] Errore parsing piano pasti:", parseErr);
      return null;
    }
  }
);

// ============================================================================
// 7. FLOW: SINGLE MEAL SUGGESTION
// ============================================================================
export const SingleMealSuggestionInputSchema = z.object({
  slotType: z.enum(["colazione", "pranzo", "merenda", "cena"]),
  dayName: z.string(),
  expiringProducts: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string(),
      })
    )
    .optional()
    .default([]),
  availableProducts: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.string(),
      })
    )
    .optional()
    .default([]),
});

export const singleMealSuggestionFlow = ai.defineFlow(
  {
    name: "singleMealSuggestionFlow",
    inputSchema: SingleMealSuggestionInputSchema,
    outputSchema: z.any(),
  },
  async ({ slotType, dayName, expiringProducts = [], availableProducts = [] }) => {
    if (!slotType || !dayName || !dayName.trim()) {
      return null;
    }

    let context = "";
    if (expiringProducts.length > 0) {
      context += `Ingredienti in scadenza prioritaria: ${expiringProducts.map((p) => p.name).join(", ")}. `;
    }
    if (availableProducts.length > 0) {
      context += `Altri ingredienti in casa: ${availableProducts.map((p) => p.name).join(", ")}.`;
    }

    const prompt = `Consiglia un singolo pasto appetitoso e facile per: ${slotType.toUpperCase()} di ${dayName}.
${context}
Prediligi ingredienti in scadenza per evitare sprechi.

Rispondi SOLO con un JSON valido:
{
  "recipeTitle": "Nome Piatto",
  "notes": "Breve consiglio dello chef",
  "ingredients": [
    { "name": "Ingrediente", "quantity": "quantità" }
  ]
}`;

    const messages = [{ role: "user" as const, content: [{ text: prompt }] }];
    const { text } = await ai.generate({ messages });
    if (!text) return null;

    try {
      return extractJsonFromResponse<{
        recipeTitle: string;
        notes?: string;
        ingredients: { name: string; quantity?: string }[];
      }>(text);
    } catch (parseErr) {
      console.warn("[singleMealSuggestionFlow] Errore parsing suggerimento pasto:", parseErr);
      return null;
    }
  }
);

// ============================================================================
// 8. FLOW: PANTRY COPILOT (CHATBOT WITH ACTIONABLE PROPOSALS)
// ============================================================================
export interface PantryCopilotContext {
  pantryName?: string;
  categories?: string[];
  products?: {
    id: string;
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
    isOpened?: boolean;
    isFrozen?: boolean;
    expiryDateStr?: string;
  }[];
  expiringProducts?: {
    id: string;
    name: string;
    quantity: number;
    expiryDateStr?: string;
  }[];
}

export interface PantryCopilotResult {
  reply: string;
  proposedActions: ProposedAction[];
  success: boolean;
}

export const PantryCopilotInputSchema = z.object({
  message: z.string(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
  context: z
    .object({
      pantryName: z.string().optional(),
      categories: z.array(z.string()).optional(),
      products: z.array(z.any()).optional(),
      expiringProducts: z.array(z.any()).optional(),
    })
    .optional()
    .default({}),
});

export const pantryCopilotFlow = ai.defineFlow(
  {
    name: "pantryCopilotFlow",
    inputSchema: PantryCopilotInputSchema,
    outputSchema: z.object({
      reply: z.string(),
      proposedActions: z.array(z.any()),
      success: z.boolean(),
    }),
  },
  async ({ message, history = [], context = {} }) => {
    if (!message || !message.trim()) {
      return {
        reply: "Come posso aiutarti con la tua dispensa?",
        proposedActions: [],
        success: true,
      };
    }

    const productsListStr = (context.products || [])
      .slice(0, 80)
      .map(
        (p) =>
          `- [ID: "${p.id}"] "${p.name}" (Q.tà: ${p.quantity} ${p.unit || "pz"}, Categoria: "${
            p.category || "Altro"
          }"${p.isOpened ? ", APERTO" : ""}${p.isFrozen ? ", CONGELATO" : ""}${
            p.expiryDateStr ? `, Scadenza: ${p.expiryDateStr}` : ""
          })`
      )
      .join("\n");

    const expiringListStr = (context.expiringProducts || [])
      .map((p) => `- "${p.name}" (Q.tà: ${p.quantity}, Scadenza: ${p.expiryDateStr || "imminente"})`)
      .join("\n");

    const categoriesStr =
      (context.categories || []).join(", ") ||
      "Pasta, Carne, Pesce, Latticini, Frutta, Verdura, Bevande, Surgelati, Dispensa, Altro";

    const systemPrompt = `Sei l'Assistente AI ufficiale della dispensa ("Pantry Copilot"). Il tuo compito è aiutare l'utente a gestire la sua dispensa casalinga, ridurre gli sprechi alimentari, rispondere a domande sui cibi disponibili, suggerire idee per i pasti e proporre modifiche alla dispensa o alla lista della spesa.

DISPENSA ATTUALE: "${context.pantryName || "Mia Dispensa"}"
CATEGORIE DISPONIBILI: ${categoriesStr}

ALIMENTI IN DISPENSA:
${productsListStr || "Nessun prodotto attualmente registrato."}

ALIMENTI IN SCADENZA IMMINENTE:
${expiringListStr || "Nessun alimento in scadenza critica."}

REGOLE ESSENZIALI:
1. Sii chiaro, empatico, amichevole e sintetico. Usa Markdown per formattare elenchi o suggerimenti.
2. Rispondi SEMPRE in lingua italiana.
3. Se l'utente fa una richiesta puramente informativa (es. "Cosa posso cucinare stasera?", "Cosa sta per scadere?", "Ho del latte?"), rispondi dettagliatamente usando le scorte fornite sopra, e lascia l'array "proposedActions" VUOTO ([]).
4. Se l'utente esprime un'intenzione operativa di MODIFICA della dispensa o della spesa (es. "Ho comprato...", "Aggiungi...", "Abbiamo finito...", "Ho aperto...", "Ho congelato...", "Metti nella lista della spesa..."), NON applicare modifiche a scatola chiusa: formula una risposta naturale di conferma e inserisci l'azione corrispondente nell'array "proposedActions". L'utente potrà poi approvarla cliccando sul pulsante di conferma nella chat.
5. Tipologie per "proposedActions":
   - "add_product": quando l'utente compra o porta a casa alimenti nuovi. Campi payload: productName, productQuantity (numero, default 1), productUnit ("pz", "kg", "g", "l"), productCategory (una tra le categorie disponibili), productExpiryDate (stimata YYYY-MM-DD se applicabile).
   - "update_quantity": variazione della quantità totale di un prodotto esistente. Usa il campo productId individuato dall'elenco. Campi payload: productId, productName, productQuantity (nuovo totale).
   - "consume_product": quando un alimento esistente è stato consumato/finito. Campi payload: productId, productName.
   - "open_product": quando un alimento è stato aperto. Campi payload: productId, productName.
   - "freeze_product": quando un alimento viene riposto nel congelatore. Campi payload: productId, productName.
   - "unfreeze_product": quando un alimento viene scongelato. Campi payload: productId, productName.
   - "add_to_shopping_list": aggiunta di uno o più alimenti alla lista della spesa. Campi payload: shoppingItemName.

FORMATO RISPOSTA:
Rispondi RIGOROSAMENTE con un JSON valido:
{
  "reply": "Testo naturale della tua risposta per l'utente...",
  "proposedActions": [
    {
      "id": "act_1",
      "type": "add_product",
      "title": "Aggiungi Latte Intero",
      "description": "Quantità: 1 l, Categoria: Latticini",
      "status": "pending",
      "payload": {
        "productId": "",
        "productName": "Latte Intero",
        "productQuantity": 1,
        "productUnit": "l",
        "productCategory": "Latticini",
        "productExpiryDate": "2026-10-15",
        "shoppingItemName": ""
      }
    }
  ]
}`;

    const formattedHistory = history.slice(-6).map((h) => ({
      role: h.role === "assistant" ? ("model" as const) : ("user" as const),
      content: [{ text: h.content }],
    }));

    const messages = [
      { role: "system" as const, content: [{ text: systemPrompt }] },
      ...formattedHistory,
      { role: "user" as const, content: [{ text: message }] },
    ];

    const { text } = await ai.generate({
      messages,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!text) {
      return {
        reply: "Non ho ricevuto risposta dall'assistente. Riprova tra poco.",
        proposedActions: [],
        success: false,
      };
    }

    try {
      const parsed = extractJsonFromResponse<{ reply?: string; proposedActions?: any[] }>(text);
      const rawActions = Array.isArray(parsed.proposedActions) ? parsed.proposedActions : [];
      const sanitizedActions: ProposedAction[] = rawActions.map((act: any, idx: number) => ({
        id: act.id || `act_${Date.now()}_${idx}`,
        type: act.type || "add_product",
        title: act.title || "Modifica dispensa",
        description: act.description || "",
        status: act.status || "pending",
        payload: act.payload || {},
      }));

      return {
        reply: parsed.reply || "Ecco le informazioni elaborate per la tua dispensa.",
        proposedActions: sanitizedActions,
        success: true,
      };
    } catch {
      return {
        reply: text,
        proposedActions: [],
        success: true,
      };
    }
  }
);

// ============================================================================
// 9. FLOW: EXTRACT STRUCTURED RECIPE FROM CHAT
// ============================================================================
export const ExtractStructuredRecipeInputSchema = z.object({
  chatText: z.string(),
  isAntiWaste: z.boolean().optional().default(false),
});

export const ExtractStructuredRecipeOutputSchema = z.object({
  recipeTitle: z.string(),
  recipeDescription: z.string().optional(),
  recipeIngredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().optional(),
    })
  ),
  recipeInstructions: z.array(z.string()),
  recipePrepTimeMinutes: z.number().nullable().optional(),
  recipeServings: z.number().nullable().optional(),
  recipeDifficulty: z.enum(["facile", "media", "difficile"]).nullable().optional(),
  recipeIsAntiWaste: z.boolean().optional(),
});

export const extractStructuredRecipeFlow = ai.defineFlow(
  {
    name: "extractStructuredRecipeFlow",
    inputSchema: ExtractStructuredRecipeInputSchema,
    outputSchema: ExtractStructuredRecipeOutputSchema,
  },
  async ({ chatText, isAntiWaste = false }) => {
    if (!chatText || !chatText.trim()) {
      const fallback = parseRecipeFromChatText(chatText, isAntiWaste);
      return {
        recipeTitle: fallback.recipeTitle,
        recipeDescription: fallback.recipeDescription || undefined,
        recipeIngredients: fallback.recipeIngredients,
        recipeInstructions: fallback.recipeInstructions,
        recipePrepTimeMinutes: fallback.recipePrepTimeMinutes,
        recipeServings: fallback.recipeServings,
        recipeDifficulty: fallback.recipeDifficulty,
        recipeIsAntiWaste: fallback.recipeIsAntiWaste,
      };
    }

    const promptText = `Sei un assistente culinario specializzato nell'estrazione e formattazione di ricette per la memorizzazione in un database strutturato.
Dato il seguente testo o messaggio dello chef AI contenente una ricetta:
---
${chatText}
---
Estrai e formatta la ricetta nei seguenti campi JSON:
1. "recipeTitle": Titolo pulito, appetitoso e privo di prefissi (elimina categoricamente numeri di elenco come '1.', etichette come 'Per i Dolci (Colazione/Merenda):', 'Opzione 1:', e virgolette). Es: 'Banana Bread al Burro d'Arachidi e Nutella'.
2. "recipeDescription": Breve frase di descrizione sul piatto.
3. "recipeIngredients": Array di oggetti { name: string, quantity?: string }.
   - ATTENZIONE CRUCIALE: Ciascun alimento deve essere un elemento separato nell'array!
   - Se nel testo sono presenti più ingredienti sulla stessa riga o separati da virgola (es. '4 banane, 1 pezzo di burro, 1 di burro d'arachidi'), dividili in ingredienti distinti.
   - Per ogni ingrediente, estrai solo il nome puro dell'alimento (es. 'Banane', 'Burro d'arachidi', 'Nutella') e la relativa dose/quantità (es. '4', '1 vasetto').
   - ESCLUDI CATEGORICAMENTE note di servizio o accompagnamento (es. 'Accompagna con i 3 succhi di frutta', 'Servi caldo', 'Conserva in frigo').
4. "recipeInstructions": Array di stringhe con i passaggi cronologici effettivi della preparazione.
   - Includi solo i passaggi reali di preparazione (es. 'Sbuccia le banane e schiacciale con una forchetta...').
   - Escludi simboli vuoti (es. '--') e note o consigli collaterali generici che non costituiscono uno step di cottura.
5. "recipePrepTimeMinutes": Tempo di preparazione stimato in minuti come numero intero (default 20).
6. "recipeServings": Numero di porzioni come numero intero (default 2).
7. "recipeDifficulty": "facile" | "media" | "difficile".
8. "recipeIsAntiWaste": ${isAntiWaste}.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme alla seguente struttura:
{
  "recipeTitle": "Nome pulito della ricetta",
  "recipeDescription": "Breve descrizione",
  "recipeIngredients": [
    { "name": "Ingrediente 1", "quantity": "Quantità" }
  ],
  "recipeInstructions": [
    "Passaggio 1",
    "Passaggio 2"
  ],
  "recipePrepTimeMinutes": 25,
  "recipeServings": 2,
  "recipeDifficulty": "facile",
  "recipeIsAntiWaste": ${isAntiWaste}
}`;

    try {
      const { text } = await ai.generate(promptText);
      if (!text) {
        const fallback = parseRecipeFromChatText(chatText, isAntiWaste);
        return {
          recipeTitle: fallback.recipeTitle,
          recipeDescription: fallback.recipeDescription || undefined,
          recipeIngredients: fallback.recipeIngredients,
          recipeInstructions: fallback.recipeInstructions,
          recipePrepTimeMinutes: fallback.recipePrepTimeMinutes,
          recipeServings: fallback.recipeServings,
          recipeDifficulty: fallback.recipeDifficulty,
          recipeIsAntiWaste: fallback.recipeIsAntiWaste,
        };
      }

      const parsed = extractJsonFromResponse<any>(text);
      if (!parsed || !parsed.recipeTitle) {
        const fallback = parseRecipeFromChatText(chatText, isAntiWaste);
        return {
          recipeTitle: fallback.recipeTitle,
          recipeDescription: fallback.recipeDescription || undefined,
          recipeIngredients: fallback.recipeIngredients,
          recipeInstructions: fallback.recipeInstructions,
          recipePrepTimeMinutes: fallback.recipePrepTimeMinutes,
          recipeServings: fallback.recipeServings,
          recipeDifficulty: fallback.recipeDifficulty,
          recipeIsAntiWaste: fallback.recipeIsAntiWaste,
        };
      }

      // Validazione e pulizia finale
      const ingredients = Array.isArray(parsed.recipeIngredients)
        ? parsed.recipeIngredients
            .filter((i: any) => i && i.name && typeof i.name === "string")
            .map((i: any) => ({
              name: String(i.name).trim(),
              quantity: i.quantity ? String(i.quantity).trim() : undefined,
            }))
        : [];

      const instructions = Array.isArray(parsed.recipeInstructions)
        ? parsed.recipeInstructions
            .map((s: any) => String(s).trim())
            .filter((s: string) => s && s !== "--" && s !== "-")
        : [];

      const difficultyVal =
        parsed.recipeDifficulty === "media" || parsed.recipeDifficulty === "difficile"
          ? parsed.recipeDifficulty
          : "facile";

      return {
        recipeTitle: String(parsed.recipeTitle).replace(/^["'«“](.*)["'»”]$/, "$1").trim(),
        recipeDescription: parsed.recipeDescription ? String(parsed.recipeDescription).trim() : undefined,
        recipeIngredients: ingredients.length > 0 ? ingredients : [{ name: "Ingredienti della ricetta" }],
        recipeInstructions: instructions.length > 0 ? instructions : [chatText.trim()],
        recipePrepTimeMinutes: typeof parsed.recipePrepTimeMinutes === "number" ? parsed.recipePrepTimeMinutes : 20,
        recipeServings: typeof parsed.recipeServings === "number" ? parsed.recipeServings : 2,
        recipeDifficulty: difficultyVal,
        recipeIsAntiWaste: isAntiWaste,
      };
    } catch (err) {
      console.warn("[extractStructuredRecipeFlow] Fallback a parser regex deterministico:", err);
      const fallback = parseRecipeFromChatText(chatText, isAntiWaste);
      return {
        recipeTitle: fallback.recipeTitle,
        recipeDescription: fallback.recipeDescription || undefined,
        recipeIngredients: fallback.recipeIngredients,
        recipeInstructions: fallback.recipeInstructions,
        recipePrepTimeMinutes: fallback.recipePrepTimeMinutes,
        recipeServings: fallback.recipeServings,
        recipeDifficulty: fallback.recipeDifficulty,
        recipeIsAntiWaste: fallback.recipeIsAntiWaste,
      };
    }
  }
);

// ============================================================================
// MANIFEST FLUSSI GENKIT (Re-export dal modulo manifest client-safe)
// ============================================================================
export { GENKIT_FLOWS_MANIFEST, type GenkitFlowMetadata } from "./manifest";

