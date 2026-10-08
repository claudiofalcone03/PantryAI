"use client";

import React, { useState, useMemo } from "react";
import {
  Bookmark,
  Sparkles,
  Clock,
  Users,
  ChevronRight,
  BookmarkPlus,
  RefreshCw,
  Share2,
  Search,
  X,
  LayoutGrid,
  SlidersHorizontal,
  Columns,
  CheckCircle2,
} from "lucide-react";
import type { Recipe } from "@/types/firestore/recipeType";
import type { Product } from "@/types/firestore/productType";

interface RecipeCarouselProps {
  savedRecipes: Recipe[];
  antiWasteRecipes: Recipe[];
  selectedRecipeId: string | null;
  onSelectRecipe: (recipe: Recipe) => void;
  loadingAntiWaste?: boolean;
  onRefreshAntiWaste?: () => void;
  pantryProducts?: Product[];
}

type QuickFilter = "all" | "quick" | "ready" | "easy" | "medium";

export function RecipeCarousel({
  savedRecipes,
  antiWasteRecipes,
  selectedRecipeId,
  onSelectRecipe,
  loadingAntiWaste = false,
  onRefreshAntiWaste,
  pantryProducts = [],
}: RecipeCarouselProps) {
  const [activeTab, setActiveTab] = useState<"saved" | "anti_waste">("saved");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const [viewMode, setViewMode] = useState<"carousel" | "grid">("carousel");

  // Calcolo disponibilità ingredienti in dispensa per ciascuna ricetta
  const getPantryStats = useMemo(() => {
    const pantryNames = pantryProducts.map((p) => p.productName.toLowerCase());

    return (recipe: Recipe) => {
      const ings = recipe.recipeIngredients || [];
      if (ings.length === 0) return { available: 0, total: 0, percent: 0 };

      let available = 0;
      for (const ing of ings) {
        const nameLower = ing.name.toLowerCase();
        const has = pantryNames.some(
          (pName) => pName.includes(nameLower) || nameLower.includes(pName)
        );
        if (has) available++;
      }

      const percent = Math.round((available / ings.length) * 100);
      return { available, total: ings.length, percent };
    };
  }, [pantryProducts]);

  const baseList = activeTab === "saved" ? savedRecipes : antiWasteRecipes;

  // Filtraggio dinamico per ricerca testuale e filtri rapidi
  const filteredList = useMemo(() => {
    return baseList.filter((rec) => {
      // 1. Filtro ricerca testuale
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = rec.recipeTitle.toLowerCase().includes(query);
        const matchDesc = rec.recipeDescription?.toLowerCase().includes(query) ?? false;
        const matchIngredients = rec.recipeIngredients.some((ing) =>
          ing.name.toLowerCase().includes(query)
        );
        if (!matchTitle && !matchDesc && !matchIngredients) {
          return false;
        }
      }

      // 2. Filtro rapido (tempo, ingredienti dispensa, difficoltà)
      if (activeFilter === "quick") {
        return rec.recipePrepTimeMinutes && rec.recipePrepTimeMinutes <= 25;
      }
      if (activeFilter === "ready") {
        const stats = getPantryStats(rec);
        return stats.percent >= 60 || stats.available === stats.total;
      }
      if (activeFilter === "easy") {
        return rec.recipeDifficulty === "facile";
      }
      if (activeFilter === "medium") {
        return (
          rec.recipeDifficulty === "media" || rec.recipeDifficulty === "difficile"
        );
      }

      return true;
    });
  }, [baseList, searchQuery, activeFilter, getPantryStats]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveFilter("all");
  };

  return (
    <div className="w-full mb-4">
      {/* Tab Selector & Controlli Superiori */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab("saved");
              setActiveFilter("all");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "saved"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 fill-current" />
            <span>Le mie ricette</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              {savedRecipes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("anti_waste");
              setActiveFilter("all");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "anti_waste"
                ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400 shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Idee Anti-Spreco</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
              {antiWasteRecipes.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Toggle Vista (Carosello orizzontale vs Griglia) */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
            <button
              type="button"
              onClick={() => setViewMode("carousel")}
              title="Vista carosello orizzontale"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "carousel"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5 rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista a griglia compatta"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Bottone Rigenera Idee Anti-Spreco */}
          {activeTab === "anti_waste" && onRefreshAntiWaste && (
            <button
              type="button"
              onClick={onRefreshAntiWaste}
              disabled={loadingAntiWaste}
              title="Rigenera idee anti-spreco dallo chef"
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-amber-600 transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAntiWaste ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Barra di Ricerca e Filtri Tag Rapidi (visibile se ci sono ricette nella categoria) */}
      {baseList.length > 0 && (
        <div className="mb-3 space-y-2">
          {/* Input Ricerca */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca ricetta per titolo, ingrediente..."
              className="w-full pl-9 pr-8 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shadow-2xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chip Filtri Rapidi */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeFilter === "all"
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
              }`}
            >
              Tutte ({baseList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("quick")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeFilter === "quick"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-emerald-300"
              }`}
            >
              <Clock className="w-3 h-3 text-emerald-500" />
              <span>≤ 25 min</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("ready")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeFilter === "ready"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-teal-300"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-teal-500" />
              <span>Pronta in dispensa</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("easy")}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeFilter === "easy"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-indigo-300"
              }`}
            >
              Facile
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter("medium")}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                activeFilter === "medium"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-purple-300"
              }`}
            >
              Media/Difficile
            </button>
          </div>
        </div>
      )}

      {/* Caricamento Idee Anti-Spreco */}
      {loadingAntiWaste && activeTab === "anti_waste" && baseList.length === 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="min-w-[240px] max-w-[260px] h-36 rounded-3xl bg-zinc-100 dark:bg-zinc-800 animate-pulse p-4 border border-zinc-200 dark:border-zinc-700/50"
            />
          ))}
        </div>
      ) : baseList.length === 0 ? (
        /* Stato Nessun Elemento nel Tab */
        <div className="p-5 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
            {activeTab === "saved" ? (
              <BookmarkPlus className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {activeTab === "saved"
              ? "Nessuna ricetta salvata al momento"
              : "Nessuna idea anti-spreco generata"}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
            {activeTab === "saved"
              ? "Chiedi una ricetta allo Chef AI nella chat sotto e tocca 'Salva nel Ricettario' per conservarla qui."
              : "Genera suggerimenti anti-spreco cliccando sul tasto rapido o chiedendo allo Chef."}
          </p>
        </div>
      ) : filteredList.length === 0 ? (
        /* Stato Nessun Risultato dal Filtro */
        <div className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-center">
          <SlidersHorizontal className="w-7 h-7 mx-auto mb-2 text-zinc-400" />
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            Nessuna ricetta corrisponde ai filtri selezionati
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Prova a modificare il termine di ricerca o seleziona un altro filtro.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-2.5 px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-xs hover:bg-zinc-300 transition-colors cursor-pointer"
          >
            Azzera filtri
          </button>
        </div>
      ) : (
        /* Visualizzazione Ricette: Carosello Orizzontale o Griglia */
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
              : "flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          }
        >
          {filteredList.map((rec, idx) => {
            const isSelected = selectedRecipeId === (rec.recipeId || `recipe-${idx}`);
            const pantryStats = getPantryStats(rec);

            return (
              <div
                key={rec.recipeId || idx}
                onClick={() => onSelectRecipe(rec)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  viewMode === "carousel" ? "min-w-[250px] max-w-[270px] shrink-0" : "w-full"
                } ${
                  isSelected
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 dark:border-emerald-500 shadow-md shadow-emerald-500/10 scale-[1.01]"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs"
                }`}
              >
                <div>
                  {/* Badge & Condivisione */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          rec.recipeIsAntiWaste
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                        }`}
                      >
                        {rec.recipeIsAntiWaste ? "Anti-Spreco" : "Ricetta"}
                      </span>

                      {rec.recipeDifficulty && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 capitalize">
                          {rec.recipeDifficulty}
                        </span>
                      )}
                    </div>

                    {rec.recipeSharedWithPantryId && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                        <Share2 className="w-3 h-3" />
                        Condivisa
                      </span>
                    )}
                  </div>

                  {/* Titolo Ricetta */}
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug">
                    {rec.recipeTitle}
                  </h4>

                  {/* Badge Disponibilità Ingredienti in Dispensa */}
                  {pantryStats.total > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          pantryStats.percent >= 70
                            ? "bg-emerald-500"
                            : pantryStats.percent > 0
                            ? "bg-amber-500"
                            : "bg-zinc-400"
                        }`}
                      />
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                        {pantryStats.available}/{pantryStats.total} ingredienti in dispensa ({pantryStats.percent}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Card con Tempo e Ingredienti */}
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    {rec.recipePrepTimeMinutes && (
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {rec.recipePrepTimeMinutes}m
                      </span>
                    )}
                    {rec.recipeServings && (
                      <span className="flex items-center gap-1 font-medium">
                        <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {rec.recipeServings}p
                      </span>
                    )}
                  </div>

                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center">
                    {isSelected ? "Espansa" : "Apri"}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
