import type { Recipe, RecipeIngredient } from "@/types/firestore/recipeType";

/**
 * Pulisce una stringa di titolo rimuovendo prefissi numerici, categorie e virgolette
 */
export function cleanRecipeTitle(rawTitle: string): string {
  let title = rawTitle.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();

  // Rimuovi prefissi numerici es. "1.", "1)", "Opzione 1:"
  title = title.replace(/^\d+[\.\)]\s*/, "");
  title = title.replace(/^(?:opzione|idea|ricetta)\s+\d+[:\s-]*/i, "");

  // Rimuovi etichette di categoria es. "Per i Dolci (Colazione/Merenda):"
  title = title.replace(/^per\s+[^:]+:\s*/i, "");

  // Rimuovi virgolette iniziali e finali
  title = title.replace(/^["'«“](.*)["'»”]$/, "$1").trim();

  return title || "Ricetta dello Chef";
}

/**
 * Verifica se una riga rappresenta una nota di servizio o consiglio piuttosto che un ingrediente
 */
function isServingAdviceOrTip(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const tipPhrases = [
    "accompagna con",
    "servi con",
    "ottimo con",
    "conserva in",
    "il tuo alleato",
    "se ti avanza",
    "se non riesci",
    "consiglio:",
    "suggerimento:",
    "nota:",
    "variante:",
  ];
  return tipPhrases.some((phrase) => lower.startsWith(phrase) || lower.includes(phrase));
}

/**
 * Separa quantità/dose e nome per un singolo ingrediente
 */
export function parseSingleIngredient(raw: string): RecipeIngredient | null {
  const clean = raw
    .replace(/\*\*/g, "")
    .replace(/[\*.,;:!?]+$/, "")
    .trim();
  if (!clean || clean.length < 2) return null;

  // Escludi frasi di servizio
  if (isServingAdviceOrTip(clean)) return null;

  // Pattern comune: dose all'inizio es. "4 banane", "200g di farina", "1 pezzo di burro"
  const qtyMatch = clean.match(
    /^(\d+(?:[.,/]\d+)?\s*(?:g|gr|grammi|kg|ml|l|litri|cucchiai[o]?|cucchiaini[o]?|spicch(?:io|i)|fett[ae]|pezz[io]|pz|vasett[io]|lattin[ae]|bustin[ae]|pizzic[io])?)\s*(?:di\s+)?(.*)$/i
  );

  if (qtyMatch && qtyMatch[1] && qtyMatch[2] && qtyMatch[2].trim().length > 1) {
    const qty = qtyMatch[1].trim();
    let name = qtyMatch[2].trim();
    // Pulisci eventuale "di " residuo e punteggiatura finale
    name = name.replace(/^di\s+/i, "").replace(/[\*.,;:!?]+$/, "").trim();
    // Capitalizza la prima lettera
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return { name, quantity: qty };
  }

  // Pattern con trattino o due punti es. "Farina: 200g" oppure "Pasta - 320g"
  const parts = clean.split(/[-:]/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    const name = parts[0].trim().replace(/^di\s+/i, "").replace(/[\*.,;:!?]+$/, "").trim();
    const qty = parts.slice(1).join(" ").trim().replace(/[\*.,;:!?]+$/, "").trim();
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: qty || undefined,
    };
  }

  // Ingrediente semplice senza quantità esplicita
  const simpleName = clean.replace(/^di\s+/i, "").replace(/[\*.,;:!?]+$/, "").trim();
  return {
    name: simpleName.charAt(0).toUpperCase() + simpleName.slice(1),
  };
}

/**
 * Estrae una ricetta strutturata da una risposta testuale o markdown dello Chef AI
 */
export function parseRecipeFromChatText(
  text: string,
  isAntiWaste = false
): Omit<Recipe, "recipeId" | "recipeAuthorUid" | "recipeCreatedAt"> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let rawTitle = "Ricetta dello Chef";
  const description = "";
  let prepTime: number | null = 25;
  let servings: number | null = 2;
  const ingredients: RecipeIngredient[] = [];
  const instructions: string[] = [];

  let currentSection: "unknown" | "ingredients" | "instructions" = "unknown";

  // Cerca il titolo nelle prime righe
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i]!;
    if (line.startsWith("#")) {
      rawTitle = line;
      break;
    } else if (line.startsWith("**") && line.endsWith("**") && line.length < 90) {
      rawTitle = line;
      break;
    } else if (line.toLowerCase().startsWith("titolo:") || line.toLowerCase().startsWith("ricetta:")) {
      rawTitle = line.split(":")[1]?.trim() || rawTitle;
      break;
    }
  }

  const title = cleanRecipeTitle(rawTitle);

  // Cerca tempi e porzioni nel testo
  const timeMatch = text.match(/tempo(?:\s+di\s+preparazione)?:\s*(\d+)\s*min/i) || text.match(/(\d+)\s*minuti/i);
  if (timeMatch && timeMatch[1]) {
    prepTime = parseInt(timeMatch[1], 10);
  }

  const servMatch = text.match(/(?:porzioni|per):\s*(\d+)/i) || text.match(/per\s+(\d+)\s+persone/i);
  if (servMatch && servMatch[1]) {
    servings = parseInt(servMatch[1], 10);
  }

  // Itera le righe per estrarre ingredienti e preparazione
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Riconoscimento sezioni
    if (
      lower.includes("ingredienti") ||
      lower.includes("cosa ti serve") ||
      lower.includes("cosa serve")
    ) {
      currentSection = "ingredients";
      continue;
    }
    if (
      lower.includes("preparazione") ||
      lower.includes("istruzioni") ||
      lower.includes("procedimento") ||
      lower.includes("come si prepara") ||
      lower.includes("passaggi")
    ) {
      currentSection = "instructions";
      continue;
    }

    if (currentSection === "ingredients") {
      if (line.startsWith("-") || line.startsWith("*") || line.startsWith("•")) {
        const rawBullet = line.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").trim();

        // Se la riga è una nota di servizio, saltala
        if (isServingAdviceOrTip(rawBullet)) continue;

        // Se la riga contiene più ingredienti separati da virgola (es. "4 banane, 1 pezzo di burro, 1 di Nutella")
        const subItems = rawBullet.split(",").map((s) => s.trim()).filter(Boolean);
        for (const sub of subItems) {
          const parsed = parseSingleIngredient(sub);
          if (parsed) {
            ingredients.push(parsed);
          }
        }
      }
    } else if (currentSection === "instructions") {
      // Linee numerate: 1. 2. oppure - o *
      if (/^\d+[.)]\s*/.test(line)) {
        const step = line.replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
        // Escludi passaggi vuoti o simboli isolati come "--"
        if (step && step !== "--" && step !== "-") {
          instructions.push(step);
        }
      } else if (line.startsWith("-") || line.startsWith("*")) {
        const step = line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim();
        if (step && step !== "--" && step !== "-") {
          instructions.push(step);
        }
      }
    }
  }

  // Fallback se il parsing di sezioni non ha trovato ingredienti o passaggi
  if (ingredients.length === 0) {
    ingredients.push({ name: "Ingredienti menzionati nella ricetta dello Chef" });
  }

  if (instructions.length === 0) {
    const paragraphs = text
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 20 && !p.toLowerCase().includes("ingredienti"));
    if (paragraphs.length > 0) {
      instructions.push(...paragraphs);
    } else {
      instructions.push(text.trim());
    }
  }

  return {
    recipeTitle: title,
    recipeDescription: description || `Creata con Chef AI (${prepTime || 20} min)`,
    recipeIngredients: ingredients,
    recipeInstructions: instructions,
    recipePrepTimeMinutes: prepTime,
    recipeServings: servings,
    recipeDifficulty: "facile",
    recipeIsAntiWaste: isAntiWaste,
  };
}
