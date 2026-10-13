import type { Product } from "@/types/firestore/productType";

/**
 * Mappatura lemmi irregolari per alimenti italiani (plurale -> singolare)
 */
const IRREGULAR_SINGULARS: Record<string, string> = {
  uova: "uovo",
  asparagi: "asparago",
  funghi: "fungo",
  fagioli: "fagiolo",
  piselli: "pisello",
  ceci: "cece",
  pomodori: "pomodoro",
  limoni: "limone",
  arance: "arancia",
  pesche: "pesca",
  noci: "noce",
  mandorle: "mandorla",
  nocciole: "nocciola",
  patate: "patata",
  carote: "carota",
  mele: "mela",
  pere: "pera",
  banane: "banana",
  fragole: "fragola",
  cipolle: "cipolla",
  zucchine: "zucchina",
  melanzane: "melanzana",
  spicchi: "spicchio",
  cetrioli: "cetriolo",
  peperoni: "peperone",
  carciofi: "carciofo",
  spinaci: "spinacio",
  finocchi: "finocchio",
  biscotti: "biscotto",
};

/**
 * Parole di misura, contenitori e rumore culinario da rimuovere per estrarre l'alimento puro
 */
const UNITS_AND_NOISE_WORDS = new Set([
  // Unità metriche
  "g", "gr", "grammi", "kg", "chili", "chilogrammi", "mg",
  "l", "lt", "litri", "litro", "ml", "millilitri", "cl", "dl",
  // Contenitori e confezioni
  "pezzo", "pezzi", "pz", "pzo", "confezione", "confezioni", "conf",
  "vasetto", "vasetti", "barattolo", "barattoli", "tubetto", "tubetti",
  "bustina", "bustine", "busta", "buste", "scatoletta", "scatolette",
  "lattina", "lattine", "pacco", "pacchi", "bottiglia", "bottiglie",
  // Tagli e porzioni
  "fetta", "fette", "fettina", "fettine", "spicchio", "spicchi",
  "cucchiaio", "cucchiai", "cucchiaino", "cucchiaini",
  "bicchiere", "bicchieri", "tazza", "tazze", "ciotola",
  "pizzico", "pizzichi", "manciata", "manciate", "rametto", "rametti",
  "foglia", "foglie", "filo", "goccia", "gocce", "cubetto", "cubetti",
  // Indicazioni accessorie
  "qb", "q.b.", "quanto basta", "circa", "abbondante", "fresco", "fresca",
  "freschi", "fresche", "cotto", "cotta", "crudo", "cruda", "macinato",
  "macinata", "tritato", "tritata", "tagliato", "tagliata", "a dadini",
  "a fette", "a cubetti", "pelato", "pelati", "intero", "interi",
]);

/**
 * Preposizioni e articoli italiani
 */
const STOP_WORDS = new Set([
  "di", "d", "d'", "del", "dello", "della", "dei", "degli", "delle",
  "da", "in", "con", "su", "per", "tra", "fra", "a", "al", "allo",
  "alla", "ai", "agli", "alle", "un", "uno", "una", "un'", "il",
  "lo", "la", "i", "gli", "le", "e", "ed", "o", "oppure",
]);

/**
 * Normalizza una singola parola italiana riconducendola al singolare
 */
export function singularizeItalianWord(word: string): string {
  const clean = word.toLowerCase().trim();
  if (clean.length <= 3) return clean;

  if (IRREGULAR_SINGULARS[clean]) {
    return IRREGULAR_SINGULARS[clean]!;
  }

  // Regole desinenze regolari
  if (clean.endsWith("che")) return clean.slice(0, -3) + "ca";
  if (clean.endsWith("ghe")) return clean.slice(0, -3) + "ga";
  if (clean.endsWith("e")) return clean.slice(0, -1) + "a";
  if (clean.endsWith("i")) return clean.slice(0, -1) + "o";

  return clean;
}

/**
 * Pulisce una stringa ingrediente rimuovendo quantità, unità, stop-word e normalizzando le parole
 */
export function normalizeFoodItem(raw: string): {
  normalized: string;
  tokens: string[];
} {
  if (!raw) return { normalized: "", tokens: [] };

  // 1. Rimuovi note tra parentesi es. (400g) o (facoltativo)
  let clean = raw.replace(/\([^)]*\)/g, " ");

  // 2. Rimuovi numeri e frazioni es. "4", "1/2", "0.5"
  clean = clean.replace(/\b\d+(?:[.,/]\d+)?\b/g, " ");

  // 3. Rimuovi caratteri speciali e punteggiatura
  clean = clean.replace(/[^\p{L}\s']/gu, " ");

  // 4. Normalizza apostrofi es. "d'arachidi" -> "d arachidi"
  clean = clean.replace(/'/g, " ");

  // 5. Tokenizza e filtra parole
  const rawTokens = clean
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const meaningfulTokens = rawTokens
    .filter((t) => !UNITS_AND_NOISE_WORDS.has(t) && !STOP_WORDS.has(t) && t.length > 1)
    .map(singularizeItalianWord);

  return {
    normalized: meaningfulTokens.join(" "),
    tokens: meaningfulTokens,
  };
}

/**
 * Confronta due token alimentari:
 * - Match esatto (es. "banana" === "banana")
 * - O variazione morfologica minima di desinenza (es. "arachid" / "arachide", "yogurt" / "yogurth")
 * Non consente MAI che una parola sia considerata uguale solo perché sottostringa casuale di un'altra (es. "vino" in "bovino", "mela" in "melanzana").
 */
export function isTokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  const lenDiff = Math.abs(a.length - b.length);
  if (minLen >= 4 && lenDiff <= 1 && (a.startsWith(b) || b.startsWith(a))) {
    return true;
  }
  return false;
}

/**
 * Calcola l'indice di somiglianza Dice Coefficient tra due set di token o stringhe
 */
function calculateTokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matches = 0;

  for (const token of tokensA) {
    if (tokensB.some((b) => isTokenMatch(token, b))) {
      matches++;
    }
  }

  // Punteggio pesato sull'intersezione
  return (2 * matches) / (tokensA.length + tokensB.length);
}

export interface PantryMatchResult {
  matched: boolean;
  matchedProduct?: Product;
  confidence: number;
  reason?: string;
}

/**
 * Cerca un alimento specificato nella lista dei prodotti della dispensa
 * utilizzando matching esatto, lemmatizzazione e token overlap semantico rigoroso.
 */
export function findPantryMatch(
  ingredientName: string,
  pantryProducts: Product[]
): PantryMatchResult {
  if (!ingredientName || !pantryProducts || pantryProducts.length === 0) {
    return { matched: false, confidence: 0 };
  }

  const ingParsed = normalizeFoodItem(ingredientName);
  if (ingParsed.tokens.length === 0) {
    return { matched: false, confidence: 0 };
  }

  let bestProduct: Product | undefined = undefined;
  let highestScore = 0;
  let matchReason = "";

  for (const product of pantryProducts) {
    if (!product.productName) continue;

    const prodParsed = normalizeFoodItem(product.productName);
    if (prodParsed.tokens.length === 0) continue;

    // 1. Match Esatto Normalizzato (es. "banana" === "banana", "zucchine" === "zucchine")
    if (ingParsed.normalized === prodParsed.normalized) {
      return {
        matched: true,
        matchedProduct: product,
        confidence: 1.0,
        reason: `Match esatto con ${product.productName}`,
      };
    }

    // 2. Controllo inclusione token chiave primario (es. "burro d'arachidi" vs "burro d'arachidi calvè")
    // Se tutti i token dell'ingrediente sono presenti nel prodotto
    const allIngTokensInProd = ingParsed.tokens.every((token) =>
      prodParsed.tokens.some((pToken) => isTokenMatch(token, pToken))
    );

    if (allIngTokensInProd && ingParsed.tokens.length > 0) {
      const ratio = ingParsed.tokens.length / prodParsed.tokens.length;
      if (ratio >= 0.5) {
        const score = 0.85 + 0.1 * ratio;
        if (score > highestScore) {
          highestScore = score;
          bestProduct = product;
          matchReason = `Contiene tutti i termini in ${product.productName}`;
        }
      }
      continue;
    }

    // 3. Controllo token overlap (es. "banane chiquita" vs "banana", "passata di pomodoro" vs "pomodoro")
    const overlapScore = calculateTokenOverlap(ingParsed.tokens, prodParsed.tokens);
    if (overlapScore > highestScore) {
      highestScore = overlapScore;
      bestProduct = product;
      matchReason = `Corrispondenza semantica (${Math.round(overlapScore * 100)}%) con ${product.productName}`;
    }
  }

  // Soglia di confidenza minima rigorosa per evitare falsi positivi
  const CONFIDENCE_THRESHOLD = 0.65;
  const isMatched = highestScore >= CONFIDENCE_THRESHOLD && bestProduct !== undefined;

  return {
    matched: isMatched,
    matchedProduct: isMatched ? bestProduct : undefined,
    confidence: highestScore,
    reason: matchReason,
  };
}
