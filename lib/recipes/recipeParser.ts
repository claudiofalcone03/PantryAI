import type { Recipe, RecipeIngredient } from "@/types/firestore/recipeType";

/**
 * Estrae una ricetta strutturata da una risposta testuale o markdown dello Chef AI
 */
export function parseRecipeFromChatText(text: string, isAntiWaste = false): Omit<Recipe, "recipeId" | "recipeAuthorUid" | "recipeCreatedAt"> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let title = "Ricetta dello Chef";
  const description = "";
  let prepTime: number | null = 25;
  let servings: number | null = 2;
  const ingredients: RecipeIngredient[] = [];
  const instructions: string[] = [];

  let currentSection: "unknown" | "ingredients" | "instructions" = "unknown";

  // Cerca il titolo nelle prime righe
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]!;
    if (line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
      break;
    } else if (line.startsWith("**") && line.endsWith("**") && line.length < 80) {
      title = line.replace(/\*\*/g, "").trim();
      break;
    } else if (line.toLowerCase().startsWith("titolo:") || line.toLowerCase().startsWith("ricetta:")) {
      title = line.split(":")[1]?.replace(/\*\*/g, "").trim() || title;
      break;
    }
  }

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
    if (lower.includes("ingredienti") || lower.includes("cosa ti serve")) {
      currentSection = "ingredients";
      continue;
    }
    if (
      lower.includes("preparazione") ||
      lower.includes("istruzioni") ||
      lower.includes("procedimento") ||
      lower.includes("come si prepara")
    ) {
      currentSection = "instructions";
      continue;
    }

    if (currentSection === "ingredients") {
      if (line.startsWith("-") || line.startsWith("*") || line.startsWith("•")) {
        const rawIng = line.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").trim();
        if (rawIng) {
          // Prova a separare ingrediente e dose se c'è un trattino o due punti
          const parts = rawIng.split(/[-:]/);
          if (parts.length > 1) {
            ingredients.push({
              name: parts[0]!.trim(),
              quantity: parts.slice(1).join(" ").trim(),
            });
          } else {
            ingredients.push({ name: rawIng });
          }
        }
      }
    } else if (currentSection === "instructions") {
      // Linee numerate: 1. 2. oppure -
      if (/^\d+[.)]\s*/.test(line)) {
        const step = line.replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
        if (step) instructions.push(step);
      } else if (line.startsWith("-") || line.startsWith("*")) {
        const step = line.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim();
        if (step) instructions.push(step);
      }
    }
  }

  // Fallback se il parsing di sezioni non ha trovato ingredienti o passaggi
  if (ingredients.length === 0) {
    ingredients.push({ name: "Ingredienti menzionati nella ricetta dello Chef" });
  }

  if (instructions.length === 0) {
    // Dividi per paragrafi
    const paragraphs = text.split("\n\n").map((p) => p.trim()).filter((p) => p.length > 20);
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
