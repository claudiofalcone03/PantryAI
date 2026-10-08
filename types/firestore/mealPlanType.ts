import type { Timestamp } from "firebase/firestore";

export type MealSlotType = "colazione" | "pranzo" | "merenda" | "cena";

export interface MealIngredient {
  name: string;
  quantity?: string;
  inPantry?: boolean;
}

export interface MealSlotItem {
  slotId: string;
  slotType: MealSlotType;
  recipeId?: string | null;
  recipeTitle: string;
  recipeIsAntiWaste?: boolean;
  recipePrepTimeMinutes?: number | null;
  servings?: number | null;
  ingredients?: MealIngredient[];
  notes?: string;
}

export interface DayMealPlan {
  date: string; // formato YYYY-MM-DD
  dayName: string; // es. "Lunedì"
  slots: Record<MealSlotType, MealSlotItem | null>;
}

export interface WeeklyMealPlan {
  weekId: string; // es. "2026-W41"
  userId: string;
  startDate: string; // YYYY-MM-DD (Lunedì)
  endDate: string; // YYYY-MM-DD (Domenica)
  days: Record<string, DayMealPlan>; // chiave data YYYY-MM-DD
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
