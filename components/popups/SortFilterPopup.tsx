"use client";

import React from "react";
import {
  X,
  Check,
  ArrowDownAZ,
  ArrowUpZA,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  PackageOpen,
  Snowflake,
} from "lucide-react";

export type SortCriteria =
  | "none"
  | "az"
  | "za"
  | "expiry_asc"
  | "expiry_desc"
  | "qty_desc"
  | "qty_asc"
  | "newest";

interface SortOptionConfig {
  id: SortCriteria;
  label: string;
  description: string;
  icon: React.ElementType;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  {
    id: "az",
    label: "Alfabetico (A → Z)",
    description: "Ordinamento alfabetico crescente per nome prodotto",
    icon: ArrowDownAZ,
  },
  {
    id: "za",
    label: "Alfabetico (Z → A)",
    description: "Ordinamento alfabetico decrescente per nome prodotto",
    icon: ArrowUpZA,
  },
  {
    id: "expiry_asc",
    label: "Scadenza più vicina",
    description: "I prodotti che scadono prima compaiono in cima",
    icon: Clock,
  },
  {
    id: "expiry_desc",
    label: "Scadenza più lontana",
    description: "I prodotti con data di scadenza più lontana",
    icon: Calendar,
  },
  {
    id: "qty_desc",
    label: "Quantità decrescente",
    description: "I prodotti con giacenza più alta in cima",
    icon: Layers,
  },
  {
    id: "qty_asc",
    label: "Quantità crescente",
    description: "I prodotti quasi esauriti in cima",
    icon: Layers,
  },
  {
    id: "newest",
    label: "Aggiunti di recente",
    description: "Gli ultimi prodotti inseriti nella dispensa",
    icon: Sparkles,
  },
  {
    id: "none",
    label: "Ordine predefinito",
    description: "Nessun ordinamento specifico applicato",
    icon: Sparkles,
  },
];

interface SortFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentSort: SortCriteria;
  onSelectSort: (sort: SortCriteria) => void;
  showOnlyExpiring: boolean;
  onToggleExpiring: () => void;
  showOnlyOpened: boolean;
  onToggleOpened: () => void;
  showOnlyFrozen: boolean;
  onToggleFrozen: () => void;
}

export function SortFilterPopup({
  isOpen,
  onClose,
  currentSort,
  onSelectSort,
  showOnlyExpiring,
  onToggleExpiring,
  showOnlyOpened,
  onToggleOpened,
  showOnlyFrozen,
  onToggleFrozen,
}: SortFilterPopupProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Ordina e Filtra Inventario
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personalizza la visualizzazione della tua dispensa
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Sezione Filtri Rapidi di Stato */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Filtri Rapidi di Stato
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onToggleExpiring}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  showOnlyExpiring
                    ? "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-semibold"
                    : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>In Scadenza</span>
              </button>

              <button
                type="button"
                onClick={onToggleOpened}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  showOnlyOpened
                    ? "bg-green-100 dark:bg-green-950/50 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 font-semibold"
                    : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                }`}
              >
                <PackageOpen className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span>Solo Aperti</span>
              </button>

              <button
                type="button"
                onClick={onToggleFrozen}
                className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                  showOnlyFrozen
                    ? "bg-cyan-100 dark:bg-cyan-950/50 border-cyan-300 dark:border-cyan-700 text-cyan-800 dark:text-cyan-300 font-semibold"
                    : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                }`}
              >
                <Snowflake className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Freezer</span>
              </button>
            </div>
          </div>

          {/* Sezione Criteri di Ordinamento */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Criterio di Ordinamento
            </label>
            <div className="space-y-1.5">
              {SORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = currentSort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelectSort(opt.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-green-50 dark:bg-green-950/30 border-green-500 text-green-900 dark:text-green-100 font-medium shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-green-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {opt.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors shadow-xs"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
