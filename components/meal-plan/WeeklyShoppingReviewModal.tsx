"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import type { WeeklyMealPlan } from "@/types/firestore/mealPlanType";
import type { Product } from "@/types/firestore/productType";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface WeeklyShoppingReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekPlan: WeeklyMealPlan | null;
  pantryProducts: Product[];
  pantryId: string | null;
}

interface AggregatedIngredient {
  id: string;
  name: string;
  quantities: string[];
  usedInMeals: string[];
  inPantry: boolean;
  matchedPantryName?: string;
  matchedPantryQty?: number;
}

export const WeeklyShoppingReviewModal: React.FC<WeeklyShoppingReviewModalProps> = ({
  isOpen,
  onClose,
  weekPlan,
  pantryProducts,
  pantryId,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "available">("missing");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Aggrega gli ingredienti di tutta la settimana e li confronta con la dispensa
  const aggregatedIngredients = useMemo<AggregatedIngredient[]>(() => {
    if (!weekPlan || !weekPlan.days) return [];

    const map = new Map<string, AggregatedIngredient>();

    // Normalizzazione per matching
    const normalize = (str: string) =>
      str.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

    Object.values(weekPlan.days).forEach((dayPlan) => {
      if (!dayPlan.slots) return;

      Object.values(dayPlan.slots).forEach((slot) => {
        if (!slot || !slot.ingredients || slot.ingredients.length === 0) return;

        slot.ingredients.forEach((ing) => {
          if (!ing.name || !ing.name.trim()) return;

          const key = normalize(ing.name);
          const existing = map.get(key);
          const mealRef = `${dayPlan.dayName} (${slot.recipeTitle})`;

          if (existing) {
            if (ing.quantity && !existing.quantities.includes(ing.quantity)) {
              existing.quantities.push(ing.quantity);
            }
            if (!existing.usedInMeals.includes(mealRef)) {
              existing.usedInMeals.push(mealRef);
            }
          } else {
            // Verifica disponibilità in dispensa
            const matchedPantry = pantryProducts.find((p) => {
              const pName = normalize(p.productName);
              return pName === key || pName.includes(key) || key.includes(pName);
            });

            const inPantry = !!matchedPantry && matchedPantry.productQuantity > 0;

            map.set(key, {
              id: key,
              name: ing.name.trim(),
              quantities: ing.quantity ? [ing.quantity] : [],
              usedInMeals: [mealRef],
              inPantry,
              matchedPantryName: matchedPantry?.productName,
              matchedPantryQty: matchedPantry?.productQuantity,
            });
          }
        });
      });
    });

    return Array.from(map.values());
  }, [weekPlan, pantryProducts]);

  // Seleziona di default solo gli ingredienti mancanti alla prima apertura
  React.useEffect(() => {
    if (isOpen && aggregatedIngredients.length > 0) {
      const initialMissing = new Set<string>();
      aggregatedIngredients.forEach((item) => {
        if (!item.inPantry) {
          initialMissing.add(item.id);
        }
      });
      setSelectedIds(initialMissing);
      setSuccessCount(null);
    }
  }, [isOpen, aggregatedIngredients]);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllMissing = () => {
    const next = new Set<string>();
    aggregatedIngredients.forEach((item) => {
      if (!item.inPantry) next.add(item.id);
    });
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    aggregatedIngredients.forEach((item) => next.add(item.id));
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const filteredItems = aggregatedIngredients.filter((item) => {
    if (filterMode === "missing") return !item.inPantry;
    if (filterMode === "available") return item.inPantry;
    return true;
  });

  const missingCount = aggregatedIngredients.filter((i) => !i.inPantry).length;
  const inPantryCount = aggregatedIngredients.filter((i) => i.inPantry).length;

  const handleAddToShoppingList = async () => {
    if (!pantryId || selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      const itemsToAdd = aggregatedIngredients.filter((i) => selectedIds.has(i.id));

      for (const item of itemsToAdd) {
        const qtyLabel = item.quantities.length > 0 ? ` (${item.quantities.join(", ")})` : "";
        await addDoc(collection(db, "shoppingListItems"), {
          listItemPantryId: pantryId,
          listItemName: `${item.name}${qtyLabel}`,
          listItemStatus: "toBuy",
          listItemCreatedAt: serverTimestamp(),
        });
      }

      setSuccessCount(itemsToAdd.length);
      window.dispatchEvent(new Event("shopping-list-updated"));

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Errore aggiunta spesa settimanale:", err);
      alert("Si è verificato un errore durante l'invio alla lista della spesa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-card rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header modale */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                Spesa per la Settimana
              </h3>
              <p className="text-xs text-muted-foreground">
                Incrocia i pasti pianificati con le giacenze attuali in dispensa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner statistiche / contatori */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setFilterMode("missing")}
            className={`py-3 px-2 text-center transition-colors ${
              filterMode === "missing" ? "bg-card shadow-xs font-semibold" : "hover:bg-muted/40"
            }`}
          >
            <span className="block text-base font-bold text-rose-600 dark:text-rose-400">
              {missingCount}
            </span>
            <span className="text-[11px] text-muted-foreground">Da Acquistare</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode("available")}
            className={`py-3 px-2 text-center transition-colors ${
              filterMode === "available" ? "bg-card shadow-xs font-semibold" : "hover:bg-muted/40"
            }`}
          >
            <span className="block text-base font-bold text-emerald-600 dark:text-emerald-400">
              {inPantryCount}
            </span>
            <span className="text-[11px] text-muted-foreground">In Dispensa</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`py-3 px-2 text-center transition-colors ${
              filterMode === "all" ? "bg-card shadow-xs font-semibold" : "hover:bg-muted/40"
            }`}
          >
            <span className="block text-base font-bold text-foreground">
              {aggregatedIngredients.length}
            </span>
            <span className="text-[11px] text-muted-foreground">Totale Articoli</span>
          </button>
        </div>

        {/* Toolbar filtri e selezione */}
        <div className="px-6 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Selezionati: <b className="text-foreground">{selectedIds.size}</b> su {filteredItems.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAllMissing}
              className="text-primary hover:underline font-medium"
            >
              Solo mancanti
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-muted-foreground hover:text-foreground font-medium"
            >
              Tutti
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-muted-foreground hover:text-foreground font-medium"
            >
              Deseleziona
            </button>
          </div>
        </div>

        {/* Lista degli ingredienti */}
        <div className="p-6 overflow-y-auto flex-1 space-y-2">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const isChecked = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? "border-primary/50 bg-primary/5 shadow-xs"
                      : "border-border/80 bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      className="text-primary shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(item.id);
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {item.name}
                        </span>
                        {item.quantities.length > 0 && (
                          <span className="text-xs text-muted-foreground font-medium">
                            ({item.quantities.join(", ")})
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground truncate">
                        Pasti: {item.usedInMeals.join(" • ")}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {item.inPantry ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        In dispensa ({item.matchedPantryQty})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertCircle className="w-3 h-3" />
                        Mancante
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
              <p className="text-sm font-medium">Nessun ingrediente in questa categoria.</p>
              <p className="text-xs">Tutti i prodotti necessari sono già in dispensa o selezionati!</p>
            </div>
          )}
        </div>

        {/* Footer con azione di invio */}
        <div className="p-4 px-6 border-t border-border bg-card flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {successCount !== null ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Aggiunti {successCount} prodotti alla spesa!
              </span>
            ) : (
              <span>I prodotti selezionati verranno salvati nella lista della spesa.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-input text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Annulla
            </button>

            <button
              type="button"
              disabled={isSubmitting || selectedIds.size === 0 || !pantryId}
              onClick={handleAddToShoppingList}
              className="flex-2 sm:flex-none px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Invio in corso...
                </>
              ) : successCount !== null ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Aggiunti alla Spesa!
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Aggiungi alla Spesa ({selectedIds.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
