import { Timestamp } from "firebase/firestore";

export interface RecipeIngredient {
  name: string;
  quantity?: string;
  inPantry?: boolean;
}

export interface Recipe {
  recipeId?: string;
  recipeTitle: string;
  recipeDescription?: string;
  recipeIngredients: RecipeIngredient[];
  recipeInstructions: string[];
  recipePrepTimeMinutes?: number | null;
  recipeServings?: number | null;
  recipeDifficulty?: "facile" | "media" | "difficile" | null;
  recipeAuthorUid: string;
  recipeAuthorName?: string;
  recipeSharedWithPantryId?: string | null;
  recipeIsAntiWaste?: boolean;
  appliedDietaryRegime?: string | null; // es. "Celiaca", "Vegetariana", ecc.
  appliedMemoryPrinciples?: string[] | null; // Principi atomici tenuti in conto dall'IA
  recipeCreatedAt?: Timestamp;
  recipeUpdatedAt?: Timestamp;
}

