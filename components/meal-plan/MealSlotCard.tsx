"use client";

import React from "react";
import { Coffee, Utensils, Apple, Moon, Trash2, Edit2, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import type { MealSlotItem, MealSlotType } from "@/types/firestore/mealPlanType";

interface MealSlotCardProps {
  slotType: MealSlotType;
  slotItem: MealSlotItem | null;
  dayName: string;
  onAssign: () => void;
  onClear: () => void;
  onSuggestAi?: () => void;
  isAiSuggesting?: boolean;
}

const SLOT_CONFIG: Record<
  MealSlotType,
  { label: string; icon: React.ReactNode; bgLight: string; textBadge: string }
> = {
  colazione: {
    label: "Colazione",
    icon: <Coffee className="w-4 h-4 text-amber-500" />,
    bgLight: "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40",
    textBadge: "text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/30",
  },
  pranzo: {
    label: "Pranzo",
    icon: <Utensils className="w-4 h-4 text-emerald-500" />,
    bgLight: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40",
    textBadge: "text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/30",
  },
  merenda: {
    label: "Merenda",
    icon: <Apple className="w-4 h-4 text-orange-500" />,
    bgLight: "bg-orange-50 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-800/40",
    textBadge: "text-orange-700 dark:text-orange-400 bg-orange-100/80 dark:bg-orange-900/30",
  },
  cena: {
    label: "Cena",
    icon: <Moon className="w-4 h-4 text-indigo-500" />,
    bgLight: "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-800/40",
    textBadge: "text-indigo-700 dark:text-indigo-400 bg-indigo-100/80 dark:bg-indigo-900/30",
  },
};

export const MealSlotCard: React.FC<MealSlotCardProps> = ({
  slotType,
  slotItem,
  dayName,
  onAssign,
  onClear,
  onSuggestAi,
  isAiSuggesting = false,
}) => {
  const config = SLOT_CONFIG[slotType];

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 shadow-sm flex flex-col justify-between ${
        slotItem
          ? "bg-card border-border hover:shadow-md"
          : `${config.bgLight} border-dashed`
      }`}
    >
      {/* Intestazione dello slot */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-background border border-border/60 shadow-xs">
            {config.icon}
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {config.label}
          </span>
        </div>

        {slotItem && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onAssign}
              aria-label={`Modifica ${config.label}`}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title="Cambia o modifica piatto"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label={`Rimuovi ${config.label}`}
              className="p-1 rounded-lg text-rose-500/80 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Svuota slot"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Contenuto principale: vuoto vs valorizzato */}
      {slotItem ? (
        <div className="space-y-2 mt-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm sm:text-base text-foreground leading-snug line-clamp-2">
              {slotItem.recipeTitle}
            </h4>
          </div>

          {/* Badge Salva-Spreco e Tempo */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {slotItem.recipeIsAntiWaste && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                <span>♻️</span> Salva-Spreco
              </span>
            )}

            {slotItem.recipePrepTimeMinutes ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                <Clock className="w-3 h-3" />
                {slotItem.recipePrepTimeMinutes} min
              </span>
            ) : null}
          </div>

          {/* Note dello chef se presenti */}
          {slotItem.notes && (
            <p className="text-xs text-muted-foreground italic line-clamp-2 bg-muted/40 p-2 rounded-lg border border-border/40">
              💡 {slotItem.notes}
            </p>
          )}

          {/* Ingredienti principali sintesi */}
          {slotItem.ingredients && slotItem.ingredients.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1">
                Ingredienti ({slotItem.ingredients.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {slotItem.ingredients.slice(0, 3).map((ing, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-muted-foreground" />
                    {ing.name}
                  </span>
                ))}
                {slotItem.ingredients.length > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                    +{slotItem.ingredients.length - 3} altri
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Nessun pasto pianificato</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-card hover:bg-muted text-xs font-medium text-foreground border border-border shadow-xs hover:border-primary/40 transition-colors"
            >
              + Scegli piatto
            </button>

            {onSuggestAi && (
              <button
                type="button"
                onClick={onSuggestAi}
                disabled={isAiSuggesting}
                title={`Chiedi consiglio all'IA per ${config.label} di ${dayName}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiSuggesting ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Consiglio IA</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
