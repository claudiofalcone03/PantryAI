"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  PenTool,
  Sparkles,
  Search,
  Check,
  Clock,
  Plus,
  Loader2,
  Trash2,
} from "lucide-react";
import type { MealSlotItem, MealSlotType } from "@/types/firestore/mealPlanType";
import type { Recipe } from "@/types/firestore/recipeType";
import { getUserRecipes, getPantrySharedRecipes } from "@/lib/firestore/recipes";
import { generateSingleMealSuggestion } from "@/lib/genkit/genkit";

interface AssignMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotType: MealSlotType;
  dayName: string;
  dateStr: string;
  currentSlotItem: MealSlotItem | null;
  onSave: (item: MealSlotItem) => Promise<void> | void;
  userId: string;
  pantryId?: string | null;
  expiringProducts?: { name: string; quantity: string }[];
  availableProducts?: { name: string; quantity: string }[];
}

export const AssignMealModal: React.FC<AssignMealModalProps> = ({
  isOpen,
  onClose,
  slotType,
  dayName,
  dateStr,
  currentSlotItem,
  onSave,
  userId,
  pantryId,
  expiringProducts = [],
  availableProducts = [],
}) => {
  const [activeTab, setActiveTab] = useState<"recipes" | "custom" | "ai">("recipes");

  // Stato per Tab Ricettario
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);

  // Stato per Tab Piatto Libero
  const [customTitle, setCustomTitle] = useState("");
  const [customTime, setCustomTime] = useState<number | "">("");
  const [customNotes, setCustomNotes] = useState("");
  const [customIngredients, setCustomIngredients] = useState<
    { name: string; quantity: string }[]
  >([]);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientQty, setNewIngredientQty] = useState("");

  // Stato per Tab Suggerimento IA
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    recipeTitle: string;
    notes?: string;
    ingredients: { name: string; quantity?: string }[];
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inizializza i campi quando la modale si apre
  useEffect(() => {
    if (!isOpen) return;

    if (currentSlotItem) {
      setCustomTitle(currentSlotItem.recipeTitle || "");
      setCustomTime(currentSlotItem.recipePrepTimeMinutes || "");
      setCustomNotes(currentSlotItem.notes || "");
      setCustomIngredients(
        currentSlotItem.ingredients?.map((i) => ({
          name: i.name,
          quantity: i.quantity || "",
        })) || []
      );
    } else {
      setCustomTitle("");
      setCustomTime("");
      setCustomNotes("");
      setCustomIngredients([]);
    }

    // Carica ricette salvate
    const loadRecipes = async () => {
      if (!userId) return;
      setIsLoadingRecipes(true);
      try {
        const [userList, sharedList] = await Promise.all([
          getUserRecipes(userId),
          pantryId ? getPantrySharedRecipes(pantryId) : Promise.resolve([]),
        ]);

        // Unisci ed elimina duplicati per recipeId
        const map = new Map<string, Recipe>();
        [...userList, ...sharedList].forEach((r) => {
          if (r.recipeId) map.set(r.recipeId, r);
        });
        setRecipes(Array.from(map.values()));
      } catch (err) {
        console.error("Errore caricamento ricette per assegnazione pasto:", err);
      } finally {
        setIsLoadingRecipes(false);
      }
    };

    loadRecipes();
  }, [isOpen, currentSlotItem, userId, pantryId]);

  if (!isOpen) return null;

  // Gestione aggiunta ingrediente nel form custom
  const handleAddIngredient = () => {
    if (!newIngredientName.trim()) return;
    setCustomIngredients((prev) => [
      ...prev,
      { name: newIngredientName.trim(), quantity: newIngredientQty.trim() },
    ]);
    setNewIngredientName("");
    setNewIngredientQty("");
  };

  const handleRemoveIngredient = (index: number) => {
    setCustomIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  // Seleziona ricetta dal ricettario
  const handleSelectRecipe = async (recipe: Recipe) => {
    setIsSubmitting(true);
    try {
      const item: MealSlotItem = {
        slotId: currentSlotItem?.slotId || `${dateStr}-${slotType}`,
        slotType,
        recipeId: recipe.recipeId,
        recipeTitle: recipe.recipeTitle,
        recipeIsAntiWaste: !!recipe.recipeIsAntiWaste,
        recipePrepTimeMinutes: recipe.recipePrepTimeMinutes,
        servings: recipe.recipeServings,
        ingredients: recipe.recipeIngredients?.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          inPantry: i.inPantry,
        })),
        notes: recipe.recipeDescription,
      };

      await onSave(item);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salva piatto libero
  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const item: MealSlotItem = {
        slotId: currentSlotItem?.slotId || `${dateStr}-${slotType}`,
        slotType,
        recipeId: null,
        recipeTitle: customTitle.trim(),
        recipePrepTimeMinutes: customTime ? Number(customTime) : null,
        notes: customNotes.trim() || undefined,
        ingredients: customIngredients.map((i) => ({
          name: i.name,
          quantity: i.quantity || undefined,
        })),
      };

      await onSave(item);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Genera suggerimento IA
  const handleGenerateAi = async () => {
    setIsAiLoading(true);
    try {
      const result = await generateSingleMealSuggestion(
        slotType,
        dayName,
        expiringProducts,
        availableProducts
      );
      if (result) {
        setAiSuggestion(result);
      }
    } catch (err) {
      console.error("Errore generazione pasto IA:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Accetta la proposta IA
  const handleAcceptAiSuggestion = async () => {
    if (!aiSuggestion) return;
    setIsSubmitting(true);
    try {
      const item: MealSlotItem = {
        slotId: currentSlotItem?.slotId || `${dateStr}-${slotType}`,
        slotType,
        recipeTitle: aiSuggestion.recipeTitle,
        recipeIsAntiWaste: true,
        notes: aiSuggestion.notes,
        ingredients: aiSuggestion.ingredients.map((i) => ({
          name: i.name,
          quantity: i.quantity,
        })),
      };

      await onSave(item);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRecipes = recipes.filter((r) =>
    r.recipeTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-card rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modale */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground capitalize">
              Pianifica {slotType}
            </h3>
            <p className="text-xs text-muted-foreground">
              {dayName} • {dateStr}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex p-2 bg-muted/40 border-b border-border gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("recipes")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "recipes"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>Dal Ricettario</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "custom"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-emerald-500" />
            <span>Piatto Libero</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("ai");
              if (!aiSuggestion && !isAiLoading) {
                handleGenerateAi();
              }
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "ai"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Chef AI</span>
          </button>
        </div>

        {/* Body contenuto tab */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: DAL RICETTARIO */}
          {activeTab === "recipes" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca tra le tue ricette..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              {isLoadingRecipes ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Caricamento ricettario...</span>
                </div>
              ) : filteredRecipes.length > 0 ? (
                <div className="grid gap-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredRecipes.map((recipe) => (
                    <div
                      key={recipe.recipeId}
                      onClick={() => handleSelectRecipe(recipe)}
                      className="p-3 rounded-2xl border border-border/80 bg-background hover:border-primary/50 hover:bg-muted/40 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {recipe.recipeTitle}
                          </h4>
                          {recipe.recipeIsAntiWaste && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                              ♻️ Anti-Spreco
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {recipe.recipePrepTimeMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {recipe.recipePrepTimeMinutes} min
                            </span>
                          )}
                          <span>{recipe.recipeIngredients?.length || 0} ingredienti</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="p-2 rounded-xl bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground space-y-2">
                  <p className="text-sm">Nessuna ricetta trovata.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("custom")}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Inserisci manualmente un piatto →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PIATTO LIBERO */}
          {activeTab === "custom" && (
            <form onSubmit={handleSaveCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Nome del Piatto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Risotto ai funghi, Insalata mista, Pancake d'avena..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Tempo di preparazione (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Es. 20"
                    value={customTime}
                    onChange={(e) =>
                      setCustomTime(e.target.value ? Number(e.target.value) : "")
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Note o Suggerimento
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Leggero, senza glutine"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Ingredienti necessari per la spesa */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Ingredienti principali (per la lista della spesa)
                </label>

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Ingrediente (es. Ricotta)"
                    value={newIngredientName}
                    onChange={(e) => setNewIngredientName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-input bg-background text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <input
                    type="text"
                    placeholder="Dose (es. 250g)"
                    value={newIngredientQty}
                    onChange={(e) => setNewIngredientQty(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-xl border border-input bg-background text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-muted text-xs font-semibold text-secondary-foreground flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi
                  </button>
                </div>

                {customIngredients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-muted/30 rounded-xl border border-border/40">
                    {customIngredients.map((ing, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/60 text-xs text-foreground"
                      >
                        <span>
                          {ing.name} {ing.quantity ? `(${ing.quantity})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-muted-foreground hover:text-rose-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !customTitle.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Conferma Piatto
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SUGGERIMENTO IA */}
          {activeTab === "ai" && (
            <div className="space-y-4">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
                  <div>
                    <h4 className="font-semibold text-sm text-foreground">
                      Lo Chef AI sta creando una proposta...
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Analisi degli ingredienti in scadenza nella tua dispensa
                    </p>
                  </div>
                </div>
              ) : aiSuggestion ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <h4 className="font-bold text-base text-foreground">
                        {aiSuggestion.recipeTitle}
                      </h4>
                    </div>

                    {aiSuggestion.notes && (
                      <p className="text-xs text-muted-foreground italic bg-background/60 p-2.5 rounded-xl border border-border/40">
                        💡 {aiSuggestion.notes}
                      </p>
                    )}

                    {aiSuggestion.ingredients && (
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Ingredienti previsti:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {aiSuggestion.ingredients.map((ing, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-md bg-background text-foreground border border-border/40"
                            >
                              {ing.name} {ing.quantity ? `(${ing.quantity})` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateAi}
                      disabled={isAiLoading}
                      className="flex-1 py-2.5 rounded-xl border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors"
                    >
                      Altra Idea 🔄
                    </button>
                    <button
                      type="button"
                      onClick={handleAcceptAiSuggestion}
                      disabled={isSubmitting}
                      className="flex-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Assegna Questo Piatto
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Non hai ancora generato una proposta per questo pasto.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAi}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90"
                  >
                    <Sparkles className="w-4 h-4" />
                    Chiedi allo Chef AI
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
