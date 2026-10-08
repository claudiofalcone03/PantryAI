"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Users,
  ChefHat,
  ShoppingCart,
  Share2,
  Trash2,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react";
import type { Recipe } from "@/types/firestore/recipeType";
import type { Product } from "@/types/firestore/productType";
import { toggleShareRecipe, deleteRecipe } from "@/lib/firestore/recipes";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface RecipeInlineDetailProps {
  recipe: Recipe;
  pantryId?: string;
  pantryProducts?: Product[];
  onClose: () => void;
  onRecipeUpdated?: () => void;
  onRecipeDeleted?: (recipeId: string) => void;
}

export function RecipeInlineDetail({
  recipe,
  pantryId,
  pantryProducts = [],
  onClose,
  onRecipeUpdated,
  onRecipeDeleted,
}: RecipeInlineDetailProps) {
  const currentUserId = auth.currentUser?.uid;
  const isAuthor = !recipe.recipeAuthorUid || recipe.recipeAuthorUid === currentUserId;
  const isShared = Boolean(recipe.recipeSharedWithPantryId);

  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  // Calcolo disponibilità in dispensa per ciascun ingrediente
  const pantryMatch = React.useMemo(() => {
    const pantryNames = pantryProducts.map((p) => p.productName.toLowerCase());
    const ings = recipe.recipeIngredients || [];

    const matches: Record<number, boolean> = {};
    let inPantryCount = 0;

    ings.forEach((ing, idx) => {
      const nameLower = ing.name.toLowerCase();
      const has = pantryNames.some(
        (pName) => pName.includes(nameLower) || nameLower.includes(pName)
      );
      matches[idx] = has;
      if (has) inPantryCount++;
    });

    const percent = ings.length > 0 ? Math.round((inPantryCount / ings.length) * 100) : 0;
    return { matches, inPantryCount, total: ings.length, percent };
  }, [recipe.recipeIngredients, pantryProducts]);

  // Pre-spunta automatica degli ingredienti già presenti in dispensa
  useEffect(() => {
    const initialChecked: Record<number, boolean> = {};
    Object.entries(pantryMatch.matches).forEach(([idx, has]) => {
      if (has) initialChecked[Number(idx)] = true;
    });
    setCheckedIngredients(initialChecked);
  }, [pantryMatch.matches]);

  const toggleIngredientCheck = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const missingIngredients = recipe.recipeIngredients.filter((_, idx) => !checkedIngredients[idx]);
  const missingCount = missingIngredients.length;

  const handleAddMissingToShoppingList = async () => {
    if (!pantryId) return;
    setIsAddingToCart(true);
    setCartSuccess(false);

    try {
      // Invia gli ingredienti non spuntati (o tutti se nessuno è spuntato)
      const listToProcess = missingIngredients.length > 0 ? missingIngredients : recipe.recipeIngredients;

      for (const ing of listToProcess) {
        await addDoc(collection(db, "shoppingListItems"), {
          listItemPantryId: pantryId,
          listItemName: ing.quantity ? `${ing.name} (${ing.quantity})` : ing.name,
          listItemStatus: "toBuy",
          listItemCreatedAt: serverTimestamp(),
        });
      }

      setCartSuccess(true);
      window.dispatchEvent(new Event("shopping-list-updated"));
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err) {
      console.error("Errore invio ingredienti alla spesa:", err);
      alert("Errore invio alla lista della spesa");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleToggleShare = async () => {
    if (!currentUserId || !recipe.recipeId || !pantryId) return;
    setIsSharing(true);
    try {
      await toggleShareRecipe(currentUserId, recipe, pantryId, !isShared);
      onRecipeUpdated?.();
    } catch (err) {
      console.error("Errore condivisione ricetta:", err);
      alert("Errore durante la modifica della condivisione");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUserId || !recipe.recipeId) return;
    const confirm = window.confirm("Sei sicuro di voler eliminare questa ricetta dal ricettario?");
    if (!confirm) return;

    setIsDeleting(true);
    try {
      await deleteRecipe(currentUserId, recipe.recipeId, recipe.recipeSharedWithPantryId);
      onRecipeDeleted?.(recipe.recipeId);
      onClose();
    } catch (err) {
      console.error("Errore eliminazione ricetta:", err);
      alert("Errore durante l'eliminazione della ricetta");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-5 shadow-lg shadow-emerald-500/5 mb-5 animate-in fade-in zoom-in-95 duration-200">
      {/* Header Ricetta */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              <ChefHat className="w-3.5 h-3.5" />
              Dettaglio Ricetta
            </span>
            {recipe.recipeIsAntiWaste && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                Anti-Spreco
              </span>
            )}
            {isShared && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                <Share2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                Condivisa in Dispensa
              </span>
            )}
            {recipe.recipeDifficulty && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 capitalize">
                {recipe.recipeDifficulty}
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
            {recipe.recipeTitle}
          </h2>

          {recipe.recipeDescription && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {recipe.recipeDescription}
            </p>
          )}

          {/* Metadati */}
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {recipe.recipePrepTimeMinutes && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{recipe.recipePrepTimeMinutes} min</span>
              </div>
            )}
            {recipe.recipeServings && (
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{recipe.recipeServings} porzioni</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottone Chiudi Espansione */}
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
          title="Comprimi dettaglio ricetta"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Due Colonne: Ingredienti e Preparazione */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
        {/* Ingredienti */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              Ingredienti ({recipe.recipeIngredients.length})
            </h3>
            <span className="text-[11px] text-zinc-400">Spunta per segnare</span>
          </div>

          {/* Barra Disponibilità Dispensa */}
          {pantryMatch.total > 0 && (
            <div className="mb-3 p-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/60">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {pantryMatch.inPantryCount} su {pantryMatch.total} disponibili in dispensa
                </span>
                <span
                  className={
                    pantryMatch.percent >= 70
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  {pantryMatch.percent}%
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pantryMatch.percent >= 70 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${pantryMatch.percent}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {recipe.recipeIngredients.map((ing, idx) => {
              const isChecked = Boolean(checkedIngredients[idx]);
              const inPantry = Boolean(pantryMatch.matches[idx]);

              return (
                <div
                  key={idx}
                  onClick={() => toggleIngredientCheck(idx)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-zinc-100/60 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 line-through"
                      : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                        isChecked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="font-medium truncate">{ing.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Badge Dispensa */}
                    {inPantry ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50">
                        In dispensa
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        Mancante
                      </span>
                    )}

                    {ing.quantity && (
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        {ing.quantity}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tasto Invia a Spesa */}
          {pantryId && (
            <button
              type="button"
              onClick={handleAddMissingToShoppingList}
              disabled={isAddingToCart}
              className={`mt-4 w-full py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                cartSuccess
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>
                {cartSuccess
                  ? "Ingredienti aggiunti alla Spesa!"
                  : missingCount > 0
                  ? `Aggiungi ${missingCount} ingredienti mancanti alla Spesa`
                  : "Aggiungi tutti alla Spesa"}
              </span>
            </button>
          )}
        </div>

        {/* Preparazione */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 mb-3">
            Preparazione Passaggio per Passaggio
          </h3>

          <div className="space-y-3">
            {recipe.recipeInstructions.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {step}
                </p>
              </div>
            ))}
          </div>

          {/* Azioni Condivisione & Eliminazione */}
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            {pantryId && isAuthor && (
              <button
                type="button"
                onClick={handleToggleShare}
                disabled={isSharing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isShared
                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>
                  {isSharing
                    ? "Aggiornamento..."
                    : isShared
                    ? "Condivisa con la dispensa ✓"
                    : "Condividi con i membri della dispensa"}
                </span>
              </button>
            )}

            {isAuthor && recipe.recipeId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ml-auto cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Eliminazione..." : "Elimina dal Ricettario"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
