import type { Timestamp } from "firebase/firestore";

/**
 * Regimi alimentari principali supportati dall'applicazione
 */
export type DietaryRegime =
  | "mediterranean"  // Mediterranea (default sano ed equilibrato)
  | "celiac"         // Celiaca / Senza Glutine rigorosa
  | "vegetarian"     // Vegetariana (niente carne o pesce)
  | "vegan"          // Vegana (nessun derivato animale)
  | "keto"           // Chetogenica / Low-carb
  | "pescatarian"    // Pescetariana (pesce sì, niente carne)
  | "lactose_free"   // Senza Lattosio
  | "omnivore"       // Onnivora standard
  | "custom";        // Personalizzata / Mista

export interface DietaryRegimeInfo {
  id: DietaryRegime;
  label: string;
  description: string;
  icon: string; // Emoji o icon identifier
  colorClass: string;
}

export const DIETARY_REGIMES_INFO: Record<DietaryRegime, DietaryRegimeInfo> = {
  mediterranean: {
    id: "mediterranean",
    label: "Mediterranea",
    description: "Cereali, legumi, verdure, pesce, olio EVO e frutta di stagione.",
    icon: "🥗",
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  celiac: {
    id: "celiac",
    label: "Celiaca / Senza Glutine",
    description: "Rigorosamente priva di frumento, orzo, segale e tracce di glutine.",
    icon: "🌾",
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  vegetarian: {
    id: "vegetarian",
    label: "Vegetariana",
    description: "Nessun tipo di carne o pesce; include uova e latticini se tollerati.",
    icon: "🥕",
    colorClass: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  },
  vegan: {
    id: "vegan",
    label: "Vegana",
    description: "100% vegetale: niente carne, pesce, latticini, uova o miele.",
    icon: "🌱",
    colorClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
  },
  keto: {
    id: "keto",
    label: "Chetogenica / Low Carb",
    description: "Povera di carboidrati e zuccheri, ricca di grassi sani e proteine.",
    icon: "🥑",
    colorClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
  pescatarian: {
    id: "pescatarian",
    label: "Pescetariana",
    description: "Dieta a base vegetale arricchita da pesce e frutti di mare; no carne.",
    icon: "🐟",
    colorClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  lactose_free: {
    id: "lactose_free",
    label: "Senza Lattosio",
    description: "Esclude latte e derivati contenenti lattosio; ammette delattosati.",
    icon: "🥛",
    colorClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  omnivore: {
    id: "omnivore",
    label: "Onnivora Libera",
    description: "Nessuna restrizione specifica di tipo o categoria di ingredienti.",
    icon: "🍽️",
    colorClass: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  custom: {
    id: "custom",
    label: "Personalizzata",
    description: "Regime su misura definito dalle note libere e dai principi dell'IA.",
    icon: "✨",
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
};

/**
 * Principali allergeni ed intolleranze alimentari comuni
 */
export const COMMON_ALLERGIES = [
  "Glutine",
  "Lattosio",
  "Frutta a guscio",
  "Arachidi",
  "Uova",
  "Soia",
  "Crostacei",
  "Pesce",
  "Molluschi",
  "Nichel",
  "Sesamo",
  "Sedano",
  "Senape",
  "Solfiti",
] as const;

/**
 * Preferenze dietetiche memorizzate nel profilo utente (users/{userId})
 */
export interface UserDietaryPreferences {
  primaryRegime: DietaryRegime;
  allergies: string[];         // es. ["Glutine", "Lattosio", "Frutta a guscio"]
  customNotes?: string;        // note opzionali (es. "Cucino per 2 persone la sera")
  updatedAt?: Timestamp | null;
}

/**
 * Categorie di principi atomici della memoria dell'IA
 */
export type MemoryCategory =
  | "diet"                // Regole dietetiche e nutrizionali (es. no maiale, poco sale)
  | "taste_dislike"       // Ingredienti o sapori sgraditi (es. odio coriandolo, no cipolla cruda)
  | "taste_preference"    // Cibi o cucine preferite (es. ama piatti speziati, cucina giapponese)
  | "cooking_habit"       // Abitudini di cottura (es. pasti rapidi < 20 min, porzioni abbondanti)
  | "household"           // Contesto familiare (es. c'è un bambino piccolo a tavola, cena per 2)
  | "other";              // Altre preferenze

export interface MemoryCategoryInfo {
  id: MemoryCategory;
  label: string;
  badgeLabel: string;
  colorClass: string;
  iconName: string;
}

export const MEMORY_CATEGORIES_INFO: Record<MemoryCategory, MemoryCategoryInfo> = {
  diet: {
    id: "diet",
    label: "Regola Dietetica",
    badgeLabel: "Dieta",
    colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    iconName: "Salad",
  },
  taste_dislike: {
    id: "taste_dislike",
    label: "Non Gradito / Da Evitare",
    badgeLabel: "Da Evitare",
    colorClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    iconName: "ThumbsDown",
  },
  taste_preference: {
    id: "taste_preference",
    label: "Gusto & Preferenza",
    badgeLabel: "Preferito",
    colorClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    iconName: "Heart",
  },
  cooking_habit: {
    id: "cooking_habit",
    label: "Abitudine Culinaria",
    badgeLabel: "Abitudine",
    colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    iconName: "Clock",
  },
  household: {
    id: "household",
    label: "Famiglia & Porzioni",
    badgeLabel: "Famiglia",
    colorClass: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
    iconName: "Users",
  },
  other: {
    id: "other",
    label: "Altro",
    badgeLabel: "Altro",
    colorClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    iconName: "Sparkles",
  },
};

/**
 * Principio Atomico della Memoria IA salvato in `users/{userId}/memoryFacts/{factId}`
 */
export interface AtomicMemoryPrinciple {
  id: string;
  text: string;                  // Il fatto atomico in linguaggio naturale (es. "Non ama il coriandolo")
  category: MemoryCategory;
  source: "learned" | "user";   // Appreso dall'IA o inserito manualmente dall'utente
  isActive: boolean;             // L'utente può disattivarlo temporaneamente senza cancellarlo
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
