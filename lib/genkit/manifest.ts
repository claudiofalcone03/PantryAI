export interface GenkitFlowMetadata {
  id: string;
  name: string;
  category: "Vision" | "Voice" | "Chat" | "Planning" | "Recipes";
  description: string;
  model: string;
  inputDescription: string;
  outputDescription: string;
  clientSurfaces: {
    mobile: string[];
    desktop: string[];
  };
}

export const GENKIT_FLOWS_MANIFEST: GenkitFlowMetadata[] = [
  {
    id: "analyzeImageProductsFlow",
    name: "Smart Vision Multi-Alimento & OCR Scadenze",
    category: "Vision",
    description:
      "Riconosce fino a 8 alimenti simultaneamente da scatto fotocamera o upload file, estrae date di scadenza (OCR) e stima la shelf-life dei freschi.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Immagine Base64 JPEG/PNG, Categorie dispensa opzionali",
    outputDescription: "Elenco alimenti rilevati con categoria, quantità, scadenza ISO, shelf-life e confidenza",
    clientSurfaces: {
      mobile: ["Modal Scansione Barcode / Foto IA", "Sheet Revisione Vision"],
      desktop: ["Modal Scanner Web / Upload Immagine", "Sheet Revisione Vision"],
    },
  },
  {
    id: "voiceDictationParserFlow",
    name: "Smart Voice Dictation & Multi-Action Parser",
    category: "Voice",
    description:
      "Trascrizione audio ad alta precisione e comprensione semantica dell'intento (apertura, congelamento, consumo, aggiunta spesa, carico dispensa).",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Audio Base64 WebM/MP4, MIME type, Prodotti esistenti per fuzzy matching deterministico",
    outputDescription: "Trascrizione fedele + Array di azioni strutturate pronte per esecuzione",
    clientSurfaces: {
      mobile: ["Floating Voice Button (FAB)", "Modal Dettatura Vocale", "Input Vocale Chat"],
      desktop: ["Modal Dettatura Vocale", "Input Vocale Copilot Split View"],
    },
  },
  {
    id: "pantryCopilotFlow",
    name: "Pantry Copilot Chatbot con Azioni Proposte",
    category: "Chat",
    description:
      "Assistente intelligente globale della dispensa. Risponde a domande sulle scorte e formula azioni operative approvabili in un tap.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Messaggio utente, Cronologia conversazione, Stato snapshot scorte e scadenze",
    outputDescription: "Testo risposta naturale in Markdown + Array proposedActions strutturate",
    clientSurfaces: {
      mobile: ["Bottom Sheet Chat Assistente", "Bottom Bar Tasto Assistente"],
      desktop: ["Docked Aside Split View (colonna destra)", "Header Tasto Assistente"],
    },
  },
  {
    id: "recipeChatbotFlow",
    name: "Chef AI Culinario & Ricette Chatbot",
    category: "Chat",
    description:
      "Chef culinario focalizzato su consigli gastronomici personalizzati, dosi e tecniche per cucinare gli ingredienti della dispensa.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Domanda utente, Cronologia chat, Ingredienti della dispensa disponibili",
    outputDescription: "Consiglio dello chef o ricetta passo-passo",
    clientSurfaces: {
      mobile: ["Pagina Ricettario tab Chef Chat"],
      desktop: ["Pagina Ricettario tab Chef Chat a schermo intero"],
    },
  },
  {
    id: "recipeExpirationFlow",
    name: "Generazione Ricette Anti-Spreco da Scadenze",
    category: "Recipes",
    description:
      "Genera ricette creative per valorizzare e consumare immediatamente i prodotti in scadenza critica, azzerando gli sprechi domestici.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Elenco prodotti in scadenza imminente con quantità",
    outputDescription: "Ricetta completa anti-spreco strutturata",
    clientSurfaces: {
      mobile: ["Pagina Ricettario (Pulsante 'Crea da scadenze')", "Card Spreco"],
      desktop: ["Pagina Ricettario (Pulsante 'Crea da scadenze')", "Card Spreco"],
    },
  },
  {
    id: "recipeFromIngredientsFlow",
    name: "Generazione Ricette da Ingredienti Selezionati",
    category: "Recipes",
    description:
      "Crea un piatto gustoso basandosi rigorosamente sugli ingredienti selezionati manualmente dall'utente nella dispensa.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Elenco ingredienti selezionati con quantità",
    outputDescription: "Ricetta pratica e gustosa",
    clientSurfaces: {
      mobile: ["Pagina Ricettario (Selezione Multipla Dispensa)"],
      desktop: ["Pagina Ricettario (Selezione Multipla Dispensa)"],
    },
  },
  {
    id: "antiWasteWeeklyPlanFlow",
    name: "Pianificazione Settimanale Anti-Spreco (7 Giorni x 4 Pasti)",
    category: "Planning",
    description:
      "Pianifica l'intera settimana distribuendo i cibi in scadenza nei primi giorni (Lun-Mer) e bilanciando colazione, pranzo, merenda e cena.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "7 date della settimana, Cibi in scadenza, Cibi disponibili in dispensa",
    outputDescription: "Mappa settimanale strutturata per data e pasti con flag anti-spreco e ingredienti",
    clientSurfaces: {
      mobile: ["Pagina Piano Settimanale (Tasto 'Pianifica Settimana con AI')"],
      desktop: ["Pagina Piano Settimanale (Tasto 'Pianifica Settimana con AI')"],
    },
  },
  {
    id: "singleMealSuggestionFlow",
    name: "Consiglio Singolo Pasto Mirato",
    category: "Planning",
    description:
      "Suggerisce un piatto specifico per un singolo slot orario (es. Pranzo del Giovedì) ottimizzando l'inventario domestico.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Slot (colazione/pranzo/merenda/cena), Giorno, Cibi in scadenza, Altri cibi",
    outputDescription: "Titolo piatto, note dello chef e ingredienti necessari",
    clientSurfaces: {
      mobile: ["Modal Assegna Pasto (Pulsante 'Consiglia con AI')"],
      desktop: ["Modal Assegna Pasto (Pulsante 'Consiglia con AI')"],
    },
  },
  {
    id: "extractStructuredRecipeFlow",
    name: "Estrattore Strutturato Ricette & Ingredienti Atomici",
    category: "Recipes",
    description:
      "Estrae e normalizza ricette da risposte conversazionali in formato schema JSON atomico, isolando singoli ingredienti, dosi e passaggi di cucina.",
    model: "gemini-3.1-flash-lite",
    inputDescription: "Testo conversazionale o markdown ricetta dello Chef, flag anti-spreco opzionale",
    outputDescription: "Oggetto ricetta con titolo pulito, dosi separate, passaggi ordinati e metadati",
    clientSurfaces: {
      mobile: ["Pagina Ricettario (Pulsante 'Salva nel Ricettario')", "Carosello Ricette Anti-Spreco"],
      desktop: ["Pagina Ricettario (Pulsante 'Salva nel Ricettario')", "Carosello Ricette Anti-Spreco"],
    },
  },
];
