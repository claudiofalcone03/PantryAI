"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Sparkles,
  Salad,
  ThumbsDown,
  Heart,
  Clock,
  Users,
  Loader2,
  Lightbulb,
} from "lucide-react";
import type { MemoryCategory } from "@/types/firestore/userMemoryType";
import { MEMORY_CATEGORIES_INFO } from "@/types/firestore/userMemoryType";

interface AddMemoryFactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (text: string, category: MemoryCategory) => Promise<void>;
}

const PRESET_EXAMPLES: { text: string; category: MemoryCategory }[] = [
  { text: "Non gradisce la cipolla cruda nei piatti", category: "taste_dislike" },
  { text: "Preferisce preparazioni rapide sotto i 25 minuti", category: "cooking_habit" },
  { text: "Ama i piatti speziati e i profumi orientali", category: "taste_preference" },
  { text: "Cucina solitamente per 2 persone la sera", category: "household" },
  { text: "Predilige metodi di cottura leggeri al forno o a vapore", category: "cooking_habit" },
  { text: "Evita pietanze con glutine o grano", category: "diet" },
];

export function AddMemoryFactModal({
  isOpen,
  onClose,
  onAdd,
}: AddMemoryFactModalProps) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("taste_dislike");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCategoryIcon = (catId: MemoryCategory) => {
    switch (catId) {
      case "diet":
        return <Salad className="w-3.5 h-3.5" />;
      case "taste_dislike":
        return <ThumbsDown className="w-3.5 h-3.5" />;
      case "taste_preference":
        return <Heart className="w-3.5 h-3.5" />;
      case "cooking_habit":
        return <Clock className="w-3.5 h-3.5" />;
      case "household":
        return <Users className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Inserisci il testo della preferenza o principio.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onAdd(text.trim(), category);
      setText("");
      setCategory("taste_dislike");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Errore durante il salvataggio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (preset: { text: string; category: MemoryCategory }) => {
    setText(preset.text);
    setCategory(preset.category);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Aggiungi Principio alla Memoria
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                L&apos;IA e lo Chef terranno conto di questa regola in ogni consiglio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Testo Principio */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
              Cosa deve ricordare l&apos;IA su di te?
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="es. Preferisco la pasta al dente con sughi di verdure; non mi piace la carne rossa."
              className="w-full px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
              autoFocus
            />
          </div>

          {/* Selezione Categoria */}
          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
              Seleziona la Categoria
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(MEMORY_CATEGORIES_INFO) as MemoryCategory[]).map((catKey) => {
                const info = MEMORY_CATEGORIES_INFO[catKey];
                const isSelected = category === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setCategory(catKey)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-semibold shadow-xs ring-1 ring-emerald-500/30"
                        : "bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="shrink-0">{getCategoryIcon(catKey)}</span>
                    <span className="text-xs truncate">{info.badgeLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggerimenti Rapidi */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Esempi frequenti (tocca per inserire):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_EXAMPLES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="text-[11px] px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-zinc-600 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-300 border border-zinc-200/80 dark:border-zinc-750 transition-colors text-left truncate max-w-full cursor-pointer"
                >
                  {preset.text}
                </button>
              ))}
            </div>
          </div>

          {/* Footer bottoni */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !text.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi alla Memoria</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
