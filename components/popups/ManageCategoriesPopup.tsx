"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, RotateCcw, Tag } from "lucide-react";
import { updatePantryCategories, updatePantryCategoryIcons } from "@/lib/firestore/pantries";
import { DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantryType";
import { CATEGORY_FALLBACK_EMOJIS, POPULAR_FOOD_EMOJIS } from "@/lib/utils/foodIcons";

interface ManageCategoriesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  pantryId: string;
  currentCategories: string[];
  currentCategoryIcons?: Record<string, string>;
  onCategoriesUpdated: (newCategories: string[]) => void;
  onCategoryIconsUpdated?: (newCategoryIcons: Record<string, string>) => void;
}

export function ManageCategoriesPopup({
  isOpen,
  onClose,
  pantryId,
  currentCategories,
  currentCategoryIcons = {},
  onCategoriesUpdated,
  onCategoryIconsUpdated,
}: ManageCategoriesPopupProps) {
  const [newCatInput, setNewCatInput] = useState("");
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>(currentCategoryIcons);
  const [editingIconCat, setEditingIconCat] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSelectIcon = async (category: string, emoji: string) => {
    setIsUpdating(true);
    const updatedIcons = { ...categoryIcons, [category]: emoji };
    setCategoryIcons(updatedIcons);
    setEditingIconCat(null);
    try {
      await updatePantryCategoryIcons(pantryId, updatedIcons);
      onCategoryIconsUpdated?.(updatedIcons);
    } catch (err) {
      console.error("Errore salvataggio icona categoria:", err);
      setErrorMsg("Errore durante il salvataggio dell'icona.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetIcon = async (category: string) => {
    setIsUpdating(true);
    const updatedIcons = { ...categoryIcons };
    delete updatedIcons[category];
    setCategoryIcons(updatedIcons);
    setEditingIconCat(null);
    try {
      await updatePantryCategoryIcons(pantryId, updatedIcons);
      onCategoryIconsUpdated?.(updatedIcons);
    } catch (err) {
      console.error("Errore reset icona categoria:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddCategory = async (catName?: string) => {
    const nameToAdd = (catName || newCatInput).trim();
    if (!nameToAdd) return;

    if (currentCategories.some((c) => c.toLowerCase() === nameToAdd.toLowerCase())) {
      setErrorMsg(`La categoria "${nameToAdd}" esiste già.`);
      return;
    }

    setErrorMsg("");
    setIsUpdating(true);
    const updated = [...currentCategories, nameToAdd];

    try {
      await updatePantryCategories(pantryId, updated);
      onCategoriesUpdated(updated);
      setNewCatInput("");
    } catch (err) {
      console.error("Errore salvataggio categoria:", err);
      setErrorMsg("Errore durante il salvataggio della categoria.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveCategory = async (catToRemove: string) => {
    const confirmed = window.confirm(`Rimuovere la categoria "${catToRemove}"?`);
    if (!confirmed) return;

    setErrorMsg("");
    setIsUpdating(true);
    const updated = currentCategories.filter((c) => c !== catToRemove);

    try {
      await updatePantryCategories(pantryId, updated);
      onCategoriesUpdated(updated);
    } catch (err) {
      console.error("Errore eliminazione categoria:", err);
      setErrorMsg("Errore durante l'eliminazione della categoria.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm("Vuoi ripristinare le categorie predefinite?")) return;

    setErrorMsg("");
    setIsUpdating(true);
    try {
      await updatePantryCategories(pantryId, DEFAULT_PANTRY_CATEGORIES);
      onCategoriesUpdated(DEFAULT_PANTRY_CATEGORIES);
    } catch (err) {
      console.error("Errore ripristino categorie:", err);
      setErrorMsg("Errore durante il ripristino delle categorie predefinite.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Categorie predefinite non ancora presenti
  const missingDefaults = DEFAULT_PANTRY_CATEGORIES.filter(
    (def) => !currentCategories.some((c) => c.toLowerCase() === def.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-0">
      <div
        className="bg-white dark:bg-zinc-900 w-full sm:max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Gestione Categorie
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Personalizza le categorie per questa dispensa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium">
              {errorMsg}
            </div>
          )}

          {/* Form Aggiunta */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Nuova Categoria
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Es. Colazione, Spezie, Legumi..."
                value={newCatInput}
                onChange={(e) => {
                  setNewCatInput(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                disabled={!newCatInput.trim() || isUpdating}
                onClick={() => handleAddCategory()}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi</span>
              </button>
            </div>
          </div>

          {/* Elenco Categorie Attuali */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Categorie Attive ({currentCategories.length})
              </label>
              {currentCategories.length > 0 && (
                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  disabled={isUpdating}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Ripristina default</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-1">
              {currentCategories.map((cat) => {
                const currentEmoji = categoryIcons[cat] || CATEGORY_FALLBACK_EMOJIS[cat] || "🏷️";
                const isPickingIcon = editingIconCat === cat;

                return (
                  <div
                    key={cat}
                    className="relative inline-flex items-center gap-2 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 shadow-sm"
                  >
                    {/* Pulsante Icona / Emoji Categoria */}
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setEditingIconCat(isPickingIcon ? null : cat)}
                      title={`Modifica icona per ${cat}`}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-2xs"
                    >
                      {currentEmoji}
                    </button>

                    {/* Popover Scelta Emoji */}
                    {isPickingIcon && (
                      <div className="absolute top-10 left-0 z-50 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl w-64 max-h-52 overflow-y-auto">
                        <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 px-1">
                          Scegli icona per {cat}:
                        </div>
                        <div className="grid grid-cols-6 gap-1">
                          {POPULAR_FOOD_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleSelectIcon(cat, emoji)}
                              className="w-8 h-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-base transition-transform active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        {categoryIcons[cat] && (
                          <button
                            type="button"
                            onClick={() => handleResetIcon(cat)}
                            className="w-full mt-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-center border-t border-zinc-100 dark:border-zinc-800 pt-1 cursor-pointer"
                          >
                            Ripristina icona default
                          </button>
                        )}
                      </div>
                    )}

                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      disabled={isUpdating}
                      title={`Rimuovi ${cat}`}
                      className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {currentCategories.length === 0 && (
                <p className="text-sm text-zinc-400 italic">Nessuna categoria attiva.</p>
              )}
            </div>
          </div>

          {/* Categorie suggerite rapide se mancanti */}
          {missingDefaults.length > 0 && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Suggerimenti rapidi (fai clic per aggiungere)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {missingDefaults.map((def) => (
                  <button
                    key={def}
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleAddCategory(def)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{def}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium text-sm rounded-xl transition-colors shadow-sm"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
