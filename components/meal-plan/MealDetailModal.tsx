"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Coffee,
  Utensils,
  Apple,
  Moon,
  Clock,
  Sparkles,
  ShoppingCart,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Check,
  Edit2,
  Trash2,
  Loader2,
  ChefHat,
  Users,
} from "lucide-react";
import type { MealSlotItem, MealSlotType } from "@/types/firestore/mealPlanType";
import type { Product } from "@/types/firestore/productType";
import { findPantryMatch } from "@/lib/utils/ingredientMatcher";
import { generateMealInstructions } from "@/lib/genkit/genkit";
import { saveRecipe } from "@/lib/firestore/recipes";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface MealDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotType: MealSlotType;
  dayName: string;
  dateStr: string;
  slotItem: MealSlotItem;
  pantryProducts?: Product[];
  pantryId?: string | null;
  userId: string;
  onToggleCooked: () => Promise<void> | void;
  onUpdateInstructions: (instructions: string[], prepTimeMinutes?: number) => Promise<void> | void;
  onEdit: () => void;
  onClear: () => void;
}

const SLOT_CONFIG: Record<
  MealSlotType,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  colazione: {
    label: "Colazione",
    icon: <Coffee className="w-4 h-4 text-amber-500" />,
    badgeClass: "text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/40",
  },
  pranzo: {
    label: "Pranzo",
    icon: <Utensils className="w-4 h-4 text-emerald-500" />,
    badgeClass: "text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/40",
  },
  merenda: {
    label: "Merenda",
    icon: <Apple className="w-4 h-4 text-orange-500" />,
    badgeClass: "text-orange-700 dark:text-orange-400 bg-orange-100/80 dark:bg-orange-950/40 border-orange-200/60 dark:border-orange-800/40",
  },
  cena: {
    label: "Cena",
    icon: <Moon className="w-4 h-4 text-indigo-500" />,
    badgeClass: "text-indigo-700 dark:text-indigo-400 bg-indigo-100/80 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/40",
  },
};

export const MealDetailModal: React.FC<MealDetailModalProps> = ({
  isOpen,
  onClose,
  slotType,
  dayName,
  dateStr,
  slotItem,
  pantryProducts = [],
  pantryId,
  userId,
  onToggleCooked,
  onUpdateInstructions,
  onEdit,
  onClear,
}) => {
  const config = SLOT_CONFIG[slotType];

  // Stato per la checklist degli ingredienti selezionati per la spesa
  const [selectedForCart, setSelectedForCart] = useState<Record<number, boolean>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  // Stato per la generazione AI dei passaggi on-demand
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);
  const [localInstructions, setLocalInstructions] = useState<string[]>(
    slotItem.instructions || []
  );

  // Stato per salvataggio nel ricettario
  const [isSavingCookbook, setIsSavingCookbook] = useState(false);
  const [cookbookSaved, setCookbookSaved] = useState(false);

  // Sincronizza istruzioni locali se lo slotItem cambia
  useEffect(() => {
    setLocalInstructions(slotItem.instructions || []);
  }, [slotItem.instructions]);

  // Gestione tasto Escape per chiudere la modale
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Match ingredienti con la dispensa
  const ingredientMatches = useMemo(() => {
    const list = slotItem.ingredients || [];
    return list.map((ing) => {
      const match = findPantryMatch(ing.name, pantryProducts);
      return {
        ...ing,
        inPantry: match.matched,
        matchedProduct: match.matchedProduct,
      };
    });
  }, [slotItem.ingredients, pantryProducts]);

  // Inizializza gli ingredienti mancanti come pre-selezionati per la spesa
  useEffect(() => {
    const initSelected: Record<number, boolean> = {};
    ingredientMatches.forEach((ing, idx) => {
      if (!ing.inPantry) {
        initSelected[idx] = true;
      }
    });
    setSelectedForCart(initSelected);
    setCartSuccess(false);
    setCookbookSaved(false);
  }, [ingredientMatches]);

  if (!isOpen) return null;

  const toggleSelectIngredient = (idx: number) => {
    setSelectedForCart((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Aggiungi ingredienti selezionati alla lista della spesa
  const handleAddSelectedToCart = async () => {
    if (!pantryId || !userId) return;
    const toAdd = ingredientMatches.filter((_, idx) => selectedForCart[idx]);
    if (toAdd.length === 0) return;

    setIsAddingToCart(true);
    setCartSuccess(false);

    try {
      for (const ing of toAdd) {
        await addDoc(collection(db, "shoppingListItems"), {
          listItemPantryId: pantryId,
          listItemName: ing.name,
          listItemQuantity: 1,
          listItemUnit: ing.quantity || "pz",
          listItemCompleted: false,
          listItemAddedBy: userId,
          listItemCreatedAt: serverTimestamp(),
          listItemUpdatedAt: serverTimestamp(),
        });
      }
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3500);
    } catch (err) {
      console.error("Errore aggiunta ingredienti alla lista spesa:", err);
      alert("Si è verificato un errore durante l'aggiunta alla lista della spesa.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Genera passaggi con Chef AI on-demand
  const handleGenerateInstructions = async () => {
    setIsGeneratingSteps(true);
    try {
      const result = await generateMealInstructions(
        slotItem.recipeTitle,
        slotItem.ingredients?.map((i) => ({ name: i.name, quantity: i.quantity })) || [],
        slotItem.notes
      );

      if (result && result.instructions && result.instructions.length > 0) {
        setLocalInstructions(result.instructions);
        await onUpdateInstructions(result.instructions, result.prepTimeMinutes);
      }
    } catch (err) {
      console.error("Errore generazione istruzioni ricetta:", err);
      alert("Impossibile generare le istruzioni con l'IA al momento. Riprova tra poco.");
    } finally {
      setIsGeneratingSteps(false);
    }
  };

  // Salva ricetta nel Ricettario personale o condiviso
  const handleSaveToCookbook = async () => {
    if (!userId) return;
    setIsSavingCookbook(true);
    try {
      const cleanIngredients = (slotItem.ingredients || []).map((i) => {
        const item: { name: string; quantity?: string; inPantry?: boolean } = {
          name: i.name || "Ingrediente",
        };
        if (i.quantity && i.quantity.trim()) {
          item.quantity = i.quantity.trim();
        }
        if (typeof i.inPantry === "boolean") {
          item.inPantry = i.inPantry;
        }
        return item;
      });

      const recipePayload: any = {
        recipeTitle: slotItem.recipeTitle || "Ricetta Senza Nome",
        recipeIngredients: cleanIngredients,
        recipeInstructions:
          localInstructions.length > 0
            ? localInstructions
            : [slotItem.notes || "Preparazione libera in base agli ingredienti."],
        recipePrepTimeMinutes: slotItem.recipePrepTimeMinutes || 20,
        recipeServings: slotItem.servings || 2,
        recipeDifficulty: "facile",
        recipeIsAntiWaste: Boolean(slotItem.recipeIsAntiWaste),
      };

      if (slotItem.notes && slotItem.notes.trim()) {
        recipePayload.recipeDescription = slotItem.notes.trim();
      }

      await saveRecipe(userId, recipePayload, pantryId);
      setCookbookSaved(true);
      setTimeout(() => setCookbookSaved(false), 3500);
    } catch (err) {
      console.error("Errore salvataggio ricetta nel ricettario:", err);
      alert("Errore durante il salvataggio della ricetta nel ricettario.");
    } finally {
      setIsSavingCookbook(false);
    }
  };

  const missingCount = ingredientMatches.filter((i) => !i.inPantry).length;
  const selectedCount = Object.values(selectedForCart).filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-card rounded-3xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modale */}
        <div className="flex items-start justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-border/70 bg-muted/20">
          <div className="space-y-1.5 pr-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.badgeClass}`}
              >
                {config.icon}
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {dayName} • {dateStr}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground leading-snug">
              {slotItem.recipeTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi dettagli ricetta"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Badge & Quick Stats */}
        <div className="px-5 sm:px-6 py-3 border-b border-border/40 bg-card flex flex-wrap items-center gap-2 text-xs">
          {/* Toggle Cucinato */}
          <button
            type="button"
            onClick={onToggleCooked}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all border ${
              slotItem.isCooked
                ? "bg-emerald-500 text-white border-emerald-600 shadow-xs hover:bg-emerald-600"
                : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {slotItem.isCooked ? "Cucinato ✓" : "Segna come Cucinato"}
          </button>

          {slotItem.recipeIsAntiWaste && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/20">
              <span>♻️</span> Salva-Spreco
            </span>
          )}

          {slotItem.recipePrepTimeMinutes ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {slotItem.recipePrepTimeMinutes} min
            </span>
          ) : null}

          {slotItem.servings ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-muted text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {slotItem.servings} porzioni
            </span>
          ) : null}
        </div>

        {/* Corpo Modale Scorrevole */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-6">
          {/* 1. Note dello Chef (Integrali, senza alcun troncamento) */}
          {slotItem.notes && (
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                <ChefHat className="w-4 h-4" />
                <span>Consiglio dello Chef</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed italic">
                {slotItem.notes}
              </p>
            </div>
          )}

          {/* 2. Ingredienti & Dispensa */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span>Ingredienti ({ingredientMatches.length})</span>
                {missingCount > 0 ? (
                  <span className="text-[11px] font-normal normal-case text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                    {missingCount} da acquistare
                  </span>
                ) : (
                  <span className="text-[11px] font-normal normal-case text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    Tutti in dispensa ✓
                  </span>
                )}
              </h3>

              {ingredientMatches.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddSelectedToCart}
                  disabled={isAddingToCart || selectedCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
                >
                  {isAddingToCart ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : cartSuccess ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <ShoppingCart className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {cartSuccess
                      ? "Aggiunti!"
                      : `Aggiungi alla Spesa (${selectedCount})`}
                  </span>
                </button>
              )}
            </div>

            {ingredientMatches.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nessun ingrediente specificato per questo piatto.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ingredientMatches.map((ing, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedForCart[idx]
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedForCart[idx])}
                        onChange={() => toggleSelectIngredient(idx)}
                        className="rounded border-border text-primary focus:ring-primary/20 w-4 h-4"
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground truncate block">
                          {ing.name}
                        </span>
                        {ing.quantity && (
                          <span className="text-muted-foreground text-[11px] block">
                            Dose: {ing.quantity}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {ing.inPantry ? (
                        <span
                          title={`Disponibile: ${ing.matchedProduct?.productName || ing.name}`}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md"
                        >
                          <CheckCircle2 className="w-3 h-3" /> In Dispensa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/50 px-2 py-0.5 rounded-md">
                          <AlertCircle className="w-3 h-3" /> Mancante
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 3. Procedimento / Istruzioni di Preparazione */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <span>Procedimento di Preparazione</span>
              </h3>

              {localInstructions.length > 0 && (
                <button
                  type="button"
                  onClick={handleGenerateInstructions}
                  disabled={isGeneratingSteps}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium disabled:opacity-50"
                  title="Rigenera o migliora i passaggi con l'IA"
                >
                  <Sparkles className={`w-3 h-3 ${isGeneratingSteps ? "animate-spin" : ""}`} />
                  <span>Rigenera passaggi</span>
                </button>
              )}
            </div>

            {localInstructions.length > 0 ? (
              <div className="space-y-2">
                {localInstructions.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 flex items-start gap-3 text-sm leading-relaxed"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-foreground flex-1">{step}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-border bg-muted/10 text-center space-y-3">
                <div className="mx-auto w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <ChefHat className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    Istruzioni passo-passo non presenti
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Puoi chiedere a Chef AI di formulare il procedimento cronologico
                    ottimale per questo piatto e memorizzarlo direttamente nello slot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateInstructions}
                  disabled={isGeneratingSteps}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingSteps ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {isGeneratingSteps
                      ? "Generazione procedimento in corso..."
                      : "✨ Genera procedimento con Chef AI"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Azioni */}
        <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToCookbook}
              disabled={isSavingCookbook}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                cookbookSaved
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-card border-border hover:bg-muted text-foreground"
              }`}
            >
              {isSavingCookbook ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : cookbookSaved ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <span>{cookbookSaved ? "Salvata nel Ricettario ✓" : "Salva nel Ricettario"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-foreground transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Modifica</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(`Vuoi rimuovere "${slotItem.recipeTitle}" da questo slot?`);
                if (ok) {
                  onClose();
                  onClear();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/40 text-xs font-medium text-rose-600 dark:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Rimuovi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
