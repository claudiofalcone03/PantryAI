import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { Recipe } from "@/types/firestore/recipeType";
import { withClientPerformanceTracking } from "@/lib/performance-logger.client";

/**
 * Salva una nuova ricetta per l'utente, e opzionalmente la condivide con la dispensa
 */
export async function saveRecipe(
  userId: string,
  recipeData: Omit<Recipe, "recipeId" | "recipeAuthorUid" | "recipeCreatedAt" | "recipeUpdatedAt"> & { recipeId?: string; recipeAuthorUid?: string },
  pantryId?: string | null
): Promise<string> {
  return withClientPerformanceTracking("db-latency", "saveRecipe", async () => {
    const userRecipesCol = collection(db, "users", userId, "recipes");
    const newDocRef = recipeData.recipeId
      ? doc(userRecipesCol, recipeData.recipeId)
      : doc(userRecipesCol);

    const docId = newDocRef.id;

    const dataToSave = {
      ...recipeData,
      recipeId: docId,
      recipeAuthorUid: userId,
      recipeSharedWithPantryId: pantryId || null,
      recipeCreatedAt: serverTimestamp(),
      recipeUpdatedAt: serverTimestamp(),
    };

    await setDoc(newDocRef, dataToSave);

    // Se condivisa con la dispensa, salva anche nella collezione condivisa
    if (pantryId) {
      const sharedRef = doc(db, "pantries", pantryId, "sharedRecipes", docId);
      await setDoc(sharedRef, dataToSave);
    }

    return docId;
  });
}

/**
 * Recupera tutte le ricette personali create dall'utente
 */
export async function getUserRecipes(userId: string): Promise<Recipe[]> {
  return withClientPerformanceTracking("db-latency", "getUserRecipes", async () => {
    const colRef = collection(db, "users", userId, "recipes");
    const q = query(colRef, orderBy("recipeCreatedAt", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      ...d.data(),
      recipeId: d.id,
    })) as Recipe[];
  });
}

/**
 * Recupera le ricette condivise dai membri della dispensa
 */
export async function getPantrySharedRecipes(pantryId: string): Promise<Recipe[]> {
  return withClientPerformanceTracking("db-latency", "getPantrySharedRecipes", async () => {
    const colRef = collection(db, "pantries", pantryId, "sharedRecipes");
    const q = query(colRef, orderBy("recipeCreatedAt", "desc"));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      ...d.data(),
      recipeId: d.id,
    })) as Recipe[];
  });
}

/**
 * Elimina una ricetta dal profilo e dall'eventuale condivisione della dispensa
 */
export async function deleteRecipe(
  userId: string,
  recipeId: string,
  pantryId?: string | null
): Promise<void> {
  return withClientPerformanceTracking("db-latency", "deleteRecipe", async () => {
    // Elimina da ricette utente
    const userDocRef = doc(db, "users", userId, "recipes", recipeId);
    await deleteDoc(userDocRef);

    // Se condivisa, elimina anche dalla dispensa
    if (pantryId) {
      const sharedRef = doc(db, "pantries", pantryId, "sharedRecipes", recipeId);
      try {
        await deleteDoc(sharedRef);
      } catch (err) {
        console.warn("Avviso eliminazione ricetta condivisa:", err);
      }
    }
  });
}

/**
 * Attiva o disattiva la condivisione di una ricetta con la dispensa
 */
export async function toggleShareRecipe(
  userId: string,
  recipe: Recipe,
  pantryId: string,
  shouldShare: boolean
): Promise<void> {
  if (!recipe.recipeId) return;

  return withClientPerformanceTracking("db-latency", "toggleShareRecipe", async () => {
    const userDocRef = doc(db, "users", userId, "recipes", recipe.recipeId!);
    const sharedRef = doc(db, "pantries", pantryId, "sharedRecipes", recipe.recipeId!);

    if (shouldShare) {
      await updateDoc(userDocRef, {
        recipeSharedWithPantryId: pantryId,
        recipeUpdatedAt: serverTimestamp(),
      });
      await setDoc(sharedRef, {
        ...recipe,
        recipeSharedWithPantryId: pantryId,
        recipeUpdatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userDocRef, {
        recipeSharedWithPantryId: null,
        recipeUpdatedAt: serverTimestamp(),
      });
      await deleteDoc(sharedRef);
    }
  });
}
