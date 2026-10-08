"use server";

import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/google-genai';
import type { ProposedAction } from '@/types/assistant/assistantType';

// Inizializzazione Istanza di Genkit
const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';  //Modello più accessibile

const ai = genkit({
    plugins: [googleAI()],
    model: googleAI.model(geminiModel),
});


// Prompt per generare ricette in base ai prodotti in scadenza
export async function generateRecipeExpiration(prodotti: { nome: string, quantita: string }[]) {
    console.log("Generazione ricetta da scaduti in corso...");
    console.log("Dati in ingresso ricevuti dal client:", JSON.stringify(prodotti, null, 2));

    const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
    const promptExpiration = `Sei uno chef esperto. I seguenti ingredienti stanno per scadere: ${ingredientiFormattati}. Crea una breve ricetta per utilizzarli, evitando gli sprechi.`;


    console.log("Prompt Gemini:");
    console.log(promptExpiration);

    try {
        const { text } = await ai.generate(promptExpiration);
        console.log("Risposta di Gemini:");
        console.log(text);
        console.log("Generazione ricetta da scaduti conclusa.");
        return text;
    } catch (error) {
        console.error("Errore Genkit:", error);
        return "Generazione ricetta fallita.";
    }
}

// Prompt per generare ricette in base agli ingredienti selezionati
export async function generateRecipeFromIngredients(prodotti: { nome: string, quantita: string }[]) {
    console.log("Generazione ricetta da ingredienti selezionati in corso...");
    console.log("Dati in ingresso ricevuti dal client:", JSON.stringify(prodotti, null, 2));

    const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
    const promptSelected = `Sei uno chef esperto. L'utente ha selezionato i seguenti ingredienti dalla sua dispensa: ${ingredientiFormattati}. Crea una ricetta gustosa per utilizzarli al meglio. Cerca di essere creativo ma pratico.`;

    console.log("Prompt Gemini:");
    console.log(promptSelected);

    try {
        const { text } = await ai.generate(promptSelected);
        console.log("Risposta di Gemini:");
        console.log(text);
        console.log("Generazione ricetta da ingredienti selezionati conclusa.");
        return text;
    } catch (error) {
        console.error("Errore Genkit:", error);
        return "Generazione ricetta fallita.";
    }
}

// Prompt role chatbot
const promptRole = `Sei uno chef esperto e un assistente culinario. Il tuo obiettivo è aiutare l'utente con ricette, idee per cucinare e consigli su come ridurre gli sprechi alimentari. Rispondi in modo creativo, utile e sintetico.`;

// Genera ricette in base alla richiesta dell'utente
export async function generateRecipeChatbot(
    promptChatbot: string,
    history: { role: "user" | "ai", content: string }[] = [],
    prodotti?: { nome: string, quantita: string }[]
) {
    console.log("Inizio Chatbot in corso...");
    console.log("Messaggio utente:", promptChatbot);

    let contextDispensa = "";
    if (prodotti && prodotti.length > 0) {
        const ingredientiFormattati = prodotti.map(p => `${p.quantita} di ${p.nome}`).join(", ");
        contextDispensa = `Contesto aggiuntivo: l'utente ha attualmente a disposizione nella sua dispensa i seguenti ingredienti: ${ingredientiFormattati}. Quando suggerisci una ricetta o rispondi, tieni a mente questi ingredienti e cerca di dare la priorità a ciò che l'utente ha già, se pertinente alla sua richiesta.`;
    }

    const systemPrompt = promptRole + contextDispensa;

    const messages = [
        { role: "system" as const, content: [{ text: systemPrompt }] },
        ...history.map(msg => ({
            role: msg.role === "ai" ? "model" as const : "user" as const,
            content: [{ text: msg.content }]
        })),
        { role: "user" as const, content: [{ text: promptChatbot }] }
    ];

    console.log("Messaggi chatbot inviati:");
    console.log(JSON.stringify(messages, null, 2));

    try {
        const { text } = await ai.generate({ messages });
        console.log("Risposta ricevuta da Gemini:");
        console.log(text);
        console.log("Chatbot concluso.");
        return text;
    } catch (error) {
        console.error("Errore Genkit (Chatbot):", error);
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

export async function getGeminiModelName() {
    return geminiModel;
}

export interface IdentifiedProductResult {
    productName: string;
    productCategory: string;
    success: boolean;
}

export interface DetectedProductItem {
    name: string;
    category: string;
    quantity: number;
    expiryDate?: string | null;     // 'YYYY-MM-DD' da OCR se visibile
    shelfLifeDays?: number | null;  // Giorni di shelf-life stimati per freschi/sfusi
    confidence?: "high" | "medium" | "low";
}

// Analisi avanzata Smart Vision con Gemini: Riconoscimento multi-item + OCR scadenza + stima shelf-life
export async function analyzeImageProducts(
    base64Image: string,
    pantryCategories?: string[]
): Promise<{ products: DetectedProductItem[]; success: boolean }> {
    console.log("Inizio analisi avanzata Smart Vision con Gemini...");
    try {
        let imageUrl = base64Image;
        if (!imageUrl.startsWith("data:")) {
            imageUrl = `data:image/jpeg;base64,${base64Image}`;
        }

        const catList = (pantryCategories && pantryCategories.length > 0)
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

Rispondi ESCLUSIVAMENTE con un array o oggetto JSON valido (senza testo introduttivo, senza blocchi markdown) nella seguente struttura:
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
                content: [
                    { media: { url: imageUrl } },
                    { text: promptText },
                ],
            },
        ];

        const { text } = await ai.generate({ messages });
        console.log("Risposta Gemini Smart Vision ricevuta:", text);

        if (!text) {
            return { products: [], success: false };
        }

        const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        const rawList = Array.isArray(parsed) ? parsed : (parsed.products || []);
        const sanitizedProducts: DetectedProductItem[] = rawList.map((item: Partial<DetectedProductItem>) => ({
            name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Alimento rilevato",
            category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "Altro",
            quantity: typeof item.quantity === "number" && item.quantity > 0 ? Math.floor(item.quantity) : 1,
            expiryDate: typeof item.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.expiryDate.trim())
                ? item.expiryDate.trim()
                : null,
            shelfLifeDays: typeof item.shelfLifeDays === "number" && item.shelfLifeDays > 0
                ? Math.floor(item.shelfLifeDays)
                : null,
            confidence: item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
                ? item.confidence
                : "medium",
        }));

        return {
            products: sanitizedProducts,
            success: sanitizedProducts.length > 0,
        };
    } catch (error) {
        console.error("Errore Genkit Smart Vision:", error);
        return { products: [], success: false };
    }
}

// Analisi immagine tramite Gemini Multimodal Vision per riconoscimento automatico prodotti (singolo fallback)
export async function identifyProductFromImage(base64Image: string): Promise<IdentifiedProductResult> {
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

// Trascrizione audio e NLP Parsing con Gemini (Smart Voice Parser con rilevamento alimenti esistenti e comandi avanzati)
export async function transcribeAndParseVoiceInput(
    audioBase64: string,
    mimeType = "audio/webm",
    contextMode: "shopping_list" | "inventory" | "chat_message" = "shopping_list",
    pantryCategories?: string[],
    existingProducts?: ExistingPantryProduct[]
): Promise<VoiceParsingResult> {
    console.log(`Inizio elaborazione audio vocale (modalità: ${contextMode})...`);
    try {
        if (!audioBase64 || typeof audioBase64 !== "string") {
            return { rawTranscript: "", items: [], success: false };
        }

        // Difesa contro SSRF: blocca URL esterni o schemi non-data
        if (/^(https?:|file:|ftp:|\/\/)/i.test(audioBase64.trim())) {
            console.warn("Rilevato schema non consentito in audioBase64 (possibile tentativo SSRF).");
            return { rawTranscript: "", items: [], success: false };
        }

        // Difesa contro Resource Exhaustion (Max 15MB base64 ~ 11MB audio)
        if (audioBase64.length > 15 * 1024 * 1024) {
            console.warn("Payload audio eccede la dimensione massima consentita (15MB).");
            return { rawTranscript: "", items: [], success: false };
        }

        // Whitelist MIME Type
        const safeMime = ALLOWED_AUDIO_MIMES.has(mimeType) ? mimeType : "audio/webm";

        let audioDataUrl = audioBase64;
        if (!audioDataUrl.startsWith("data:")) {
            audioDataUrl = `data:${safeMime};base64,${audioBase64}`;
        }

        // Sanitizzazione Categorie (Anti-Prompt Injection & Max 30 categorie)
        const safeCategories = (pantryCategories || [])
            .slice(0, 30)
            .map((c) => (typeof c === "string" ? c.replace(/[\r\n"\\`]/g, "").trim().slice(0, 40) : ""))
            .filter(Boolean);

        const catList = safeCategories.length > 0
            ? safeCategories.join(", ")
            : "Latticini, Carne, Pesce, Frutta, Verdura, Bevande, Dolci, Snack, Pasta, Surgelati, Altro";

        // Sanitizzazione Prodotti Esistenti in Dispensa (Anti-Prompt Injection & Max 50 alimenti)
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

        const existingProductsPromptBlock = safeExistingProducts.length > 0
            ? `\nPRODOTTI ATTUALMENTE GIÀ PRESENTI NELLA DISPENSA:\n${safeExistingProducts
                .map((p) => `- [ID: "${p.id}", Nome: "${p.name}", Quantità: ${p.quantity}, Categoria: "${p.category}"${p.isFrozen ? ", Congelato" : ""}${p.isOpened ? ", Aperto" : ""}]`)
                .join("\n")}\n`
            : "";

        let promptInstruction = "";
        if (contextMode === "chat_message") {
            promptInstruction = `Ascolta con attenzione la registrazione audio e trascrivi fedelmente ed esattamente ciò che è stato detto in lingua italiana.
Rispondi RIGOROSAMENTE con un oggetto JSON valido (senza markdown):
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
       - Se l'alimento corrisponde a un prodotto GIÀ PRESENTE nella dispensa sopra (es. 'latte' corrisponde a 'Latte parzialmente scremato', 'mele' a 'Mele Golden') -> "update_quantity", con "newTotalQuantity": <quantità attuale + quantità pronunciata>
       - Se l'alimento NON è presente nella dispensa sopra -> "create_new", con "newTotalQuantity": <quantità pronunciata>

   - Se l'azione riguarda un prodotto presente nella lista sopra ("open_item", "freeze_item", "unfreeze_item", "consume_item", "update_quantity"):
     imposta "matchedProductId": "<ID esatto del prodotto nella lista>",
     "matchedProductName": "<Nome esatto del prodotto nella lista>",
     "existingQuantity": <quantità attuale nella lista>

Rispondi RIGOROSAMENTE con un oggetto JSON valido (senza testo introduttivo, senza blocchi markdown) nella seguente forma:
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
        console.log("Risposta Gemini Voice Parsing:", text);

        if (!text) {
            return { rawTranscript: "", items: [], success: false };
        }

        const cleanedJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJson);

        const transcript = typeof parsed.transcript === "string" ? parsed.transcript.trim().slice(0, 1000) : "";
        const rawItems = Array.isArray(parsed.items) ? parsed.items.slice(0, 20) : [];
        const items: ParsedVoiceItem[] = rawItems.map((it: Partial<ParsedVoiceItem>) => {
            const rawName = typeof it.name === "string" ? it.name.trim().slice(0, 100) : "Alimento";
            const rawQty = typeof it.quantity === "number" && Number.isFinite(it.quantity) && it.quantity > 0
                ? Math.min(999, Math.floor(it.quantity))
                : 1;
            let rawCategory = typeof it.category === "string" ? it.category.trim().slice(0, 40) : "Altro";
            if (safeCategories.length > 0 && !safeCategories.includes(rawCategory)) {
                rawCategory = "Altro";
            }

            const validActions: Set<VoiceActionType> = new Set([
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
            let existingQty = typeof it.existingQuantity === "number" && Number.isFinite(it.existingQuantity) ? it.existingQuantity : undefined;
            let totalQty = typeof it.newTotalQuantity === "number" && Number.isFinite(it.newTotalQuantity) ? it.newTotalQuantity : rawQty;
            const monthsDuration = typeof it.monthsDuration === "number" && it.monthsDuration > 0 ? it.monthsDuration : 3;

            // Deterministic Matching per collegare alimenti esistenti
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
    } catch (error) {
        console.error("Errore Voice Parsing Gemini:", error);
        return { rawTranscript: "", items: [], success: false };
    }
}

// Configurazione protetta per connessione client-to-Gemini Live WebSocket
export async function getGeminiLiveConfig(clientAuthToken?: string) {
    // In produzione o ambienti esposti, rifiuta richieste prive di token o credenziali
    if (process.env.NODE_ENV === "production" && (!clientAuthToken || typeof clientAuthToken !== "string" || !clientAuthToken.trim())) {
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

export interface PantryContextProduct {
    name: string;
    quantity: string | number;
    category?: string;
    expiryDate?: string;
    isExpiringSoon?: boolean;
}

// Costruisce il contesto strutturato della dispensa per lo Chef Vocale Live e il Chatbot AI
export async function buildLiveChefPantryContext(
    prodotti: PantryContextProduct[] = [],
    customRecipeContext: string = ""
): Promise<string> {
    const parts: string[] = [];

    if (prodotti.length > 0) {
        const expiringItems = prodotti.filter(p => p.isExpiringSoon);
        const standardItems = prodotti.filter(p => !p.isExpiringSoon);

        let dispensaText = "--- STATO REALE DISPENSA UTENTE ---\n";
        if (expiringItems.length > 0) {
            dispensaText += "⚠️ PRODOTTI IN SCADENZA RAVVICINATA (USARE CON MASSIMA PRIORITÀ CONTRO GLI SPRECHI):\n";
            dispensaText += expiringItems
                .map(p => `• ${p.name}: quantità ${p.quantity}${p.category ? ` [${p.category}]` : ""}${p.expiryDate ? ` (scadenza: ${p.expiryDate})` : ""}`)
                .join("\n");
            dispensaText += "\n\n";
        }

        if (standardItems.length > 0) {
            dispensaText += "ALTRI INGREDIENTI DISPONIBILI NELLA DISPENSA:\n";
            dispensaText += standardItems
                .map(p => `• ${p.name}: quantità ${p.quantity}${p.category ? ` [${p.category}]` : ""}`)
                .join("\n");
            dispensaText += "\n\n";
        }

        dispensaText += "LINEE GUIDA CHEF VOCALE:\n" +
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

export interface AIPerDayMealSlot {
    recipeTitle: string;
    recipeIsAntiWaste: boolean;
    notes?: string;
    ingredients: { name: string; quantity?: string }[];
}

export interface AIMealPlanResponse {
    days: Record<string, {
        colazione: AIPerDayMealSlot | null;
        pranzo: AIPerDayMealSlot | null;
        merenda: AIPerDayMealSlot | null;
        cena: AIPerDayMealSlot | null;
    }>;
}

// Genera un intero piano settimanale calibrato contro gli sprechi alimentari
export async function generateAIAntiWasteWeeklyPlan(
    days: { dateStr: string; dayName: string }[],
    expiringProducts: { name: string; quantity: string; expiryDate?: string }[] = [],
    availableProducts: { name: string; quantity: string }[] = []
): Promise<AIMealPlanResponse | null> {
    try {
        let pantryContext = "PRODOTTI IN DISPENSA:\n";
        if (expiringProducts.length > 0) {
            pantryContext += "⚠️ INGREDIENTI IN SCADENZA RAVVICINATA (DA CONSUMARE NEI PRIMI GIORNI: Lun-Mar-Mer):\n" +
                expiringProducts.map(p => `- ${p.name} (${p.quantity})${p.expiryDate ? ` [scade il ${p.expiryDate}]` : ''}`).join("\n") + "\n\n";
        }
        if (availableProducts.length > 0) {
            pantryContext += "ALTRI INGREDIENTI DISPONIBILI:\n" +
                availableProducts.map(p => `- ${p.name} (${p.quantity})`).join("\n") + "\n";
        }

        const daysList = days.map(d => `${d.dateStr} (${d.dayName})`).join(", ");

        const prompt = `Sei lo Chef AI di PantryAI, un assistente culinario esperto e sostenibile specializzato nella riduzione attiva dello spreco alimentare domestico.
Crea un piano pasti settimanale bilanciato per i seguenti 7 giorni: ${daysList}.

${pantryContext}

REGOLE FONDAMENTALI:
1. Per ogni giorno fornisci i 4 pasti: "colazione", "pranzo", "merenda", "cena".
2. PRIORITÀ ASSOLUTA ANTI-SPRECO: Pianifica gli ingredienti in scadenza nei primi giorni della settimana (Lunedì, Martedì, Mercoledì) per evitare che vadano a male. Contrassegna questi pasti con "recipeIsAntiWaste": true.
3. Varia i pasti: alterna carboidrati, proteine (legumi, carne, pesce, uova) e verdure.
4. Per ogni pasto includi una breve lista dei principali "ingredients" con dosi realistiche e un breve consiglio o nota ("notes").

Rispondi RIGOROSAMENTE con un oggetto JSON valido (senza testo prima o dopo, senza markdown) con questa struttura esatta:
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

        const messages = [{ role: 'user' as const, content: [{ text: prompt }] }];
        const { text } = await ai.generate({ messages });
        if (!text) return null;

        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned) as AIMealPlanResponse;
        return parsed;
    } catch (err) {
        console.error("Errore generazione Meal Plan settimanale AI:", err);
        return null;
    }
}

// Suggerimento mirato per un singolo slot di pasto (es. Pranzo di Giovedì)
export async function generateSingleMealSuggestion(
    slotType: "colazione" | "pranzo" | "merenda" | "cena",
    dayName: string,
    expiringProducts: { name: string; quantity: string }[] = [],
    availableProducts: { name: string; quantity: string }[] = []
): Promise<{ recipeTitle: string; notes?: string; ingredients: { name: string; quantity?: string }[] } | null> {
    try {
        let context = "";
        if (expiringProducts.length > 0) {
            context += `Ingredienti in scadenza prioritaria: ${expiringProducts.map(p => p.name).join(", ")}. `;
        }
        if (availableProducts.length > 0) {
            context += `Altri ingredienti in casa: ${availableProducts.map(p => p.name).join(", ")}.`;
        }

        const prompt = `Consiglia un singolo piatto appetitoso e facile per: ${slotType.toUpperCase()} di ${dayName}.
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

        const messages = [{ role: 'user' as const, content: [{ text: prompt }] }];
        const { text } = await ai.generate({ messages });
        if (!text) return null;

        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (err) {
        console.error("Errore suggerimento singolo pasto AI:", err);
        return null;
    }
}

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

export async function chatWithPantryCopilot(
    message: string,
    history: { role: "user" | "assistant"; content: string }[] = [],
    context: PantryCopilotContext = {}
): Promise<PantryCopilotResult> {
    try {
        const productsListStr = (context.products || [])
            .slice(0, 80)
            .map(
                (p) =>
                    `- [ID: "${p.id}"] "${p.name}" (Q.tà: ${p.quantity} ${p.unit || "pz"}, Categoria: "${p.category || "Altro"}"${p.isOpened ? ", APERTO" : ""}${p.isFrozen ? ", CONGELATO" : ""}${p.expiryDateStr ? `, Scadenza: ${p.expiryDateStr}` : ""})`
            )
            .join("\n");

        const expiringListStr = (context.expiringProducts || [])
            .map((p) => `- "${p.name}" (Q.tà: ${p.quantity}, Scadenza: ${p.expiryDateStr || "imminente"})`)
            .join("\n");

        const categoriesStr = (context.categories || []).join(", ") || "Pasta, Carne, Pesce, Latticini, Frutta, Verdura, Bevande, Surgelati, Dispensa, Altro";

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
Rispondi RIGOROSAMENTE con un JSON valido (senza testo fuori dal JSON):
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

        let parsed: any = null;
        try {
            const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
            parsed = JSON.parse(cleaned);
        } catch {
            const firstBrace = text.indexOf("{");
            const lastBrace = text.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                try {
                    parsed = JSON.parse(text.substring(firstBrace, lastBrace + 1));
                } catch (e) {
                    console.warn("[chatWithPantryCopilot] Fallback JSON parse failed:", e);
                }
            }
        }

        if (parsed && typeof parsed === "object") {
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
        }

        return {
            reply: text,
            proposedActions: [],
            success: true,
        };
    } catch (error) {
        console.error("Errore chatWithPantryCopilot:", error);
        return {
            reply: "Si è verificato un errore durante la comunicazione con l'assistente. Riprova.",
            proposedActions: [],
            success: false,
        };
    }
}




