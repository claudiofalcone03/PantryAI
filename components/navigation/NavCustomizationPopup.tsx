"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Layout,
  Refrigerator,
  ShoppingCart,
  ChefHat,
  CalendarDays,
  Trash2,
  Settings,
} from "lucide-react";
import {
  ALL_APP_SCREENS,
  DEFAULT_NAV_TABS,
  updateNavTabsPreferences,
} from "@/lib/firestore/userProfile";
import { auth } from "@/lib/firebase";

interface NavCustomizationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentTabs: string[];
  onTabsUpdated?: (newTabs: string[]) => void;
}

const ICON_MAP = {
  Refrigerator,
  ShoppingCart,
  ChefHat,
  CalendarDays,
  Trash2,
  Settings,
};

export function NavCustomizationPopup({
  isOpen,
  onClose,
  currentTabs,
  onTabsUpdated,
}: NavCustomizationPopupProps) {
  // Lista ordinata delle tab attive
  const [activeTabs, setActiveTabs] = useState<string[]>(currentTabs);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTabs(currentTabs && currentTabs.length > 0 ? currentTabs : DEFAULT_NAV_TABS);
    }
  }, [isOpen, currentTabs]);

  if (!isOpen) return null;

  const activeSet = new Set(activeTabs);

  // Toggle inclusione schermata nella navbar
  const handleToggleScreen = (screenId: string) => {
    if (activeSet.has(screenId)) {
      if (activeTabs.length <= 2) {
        alert("Devi mantenere almeno 2 schermate attive nella barra di navigazione.");
        return;
      }
      setActiveTabs((prev) => prev.filter((id) => id !== screenId));
    } else {
      if (activeTabs.length >= 6) {
        alert("Puoi selezionare al massimo 6 schermate per la barra di navigazione.");
        return;
      }
      setActiveTabs((prev) => [...prev, screenId]);
    }
  };

  // Sposta in alto una tab
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setActiveTabs((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Sposta in basso una tab
  const handleMoveDown = (index: number) => {
    if (index >= activeTabs.length - 1) return;
    setActiveTabs((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleResetDefault = () => {
    setActiveTabs(DEFAULT_NAV_TABS);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    try {
      await updateNavTabsPreferences(user.uid, activeTabs);
      onTabsUpdated?.(activeTabs);
      onClose();
    } catch (err) {
      console.error("Errore salvataggio personalizzazione navigazione:", err);
      alert("Errore durante il salvataggio delle preferenze.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Personalizza Barra & Mappa
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Scegli quali schermate mostrare e il loro ordine
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

        {/* Corpo Scrollabile */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Box Anteprima Barra */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                Anteprima Barra Inferiore ({activeTabs.length} attive)
              </span>
              <span className="text-[11px] text-zinc-400">Consigliate: 3 - 5</span>
            </div>
            <div className="flex items-center justify-around py-2 px-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              {activeTabs.map((tabId) => {
                const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
                if (!screen) return null;
                const IconComponent = ICON_MAP[screen.iconName];
                return (
                  <div
                    key={tabId}
                    className="flex flex-col items-center justify-center space-y-1 min-w-[50px] text-center"
                  >
                    <IconComponent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 truncate w-full">
                      {screen.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Elenco Schermate con Toggle e Riordino */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
              Schermate Disponibili
            </h3>
            <div className="space-y-2">
              {ALL_APP_SCREENS.map((screen) => {
                const isSelected = activeSet.has(screen.id);
                const orderIndex = activeTabs.indexOf(screen.id);
                const IconComponent = ICON_MAP[screen.iconName];

                return (
                  <div
                    key={screen.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60"
                    }`}
                  >
                    {/* Switch & Dettagli */}
                    <div
                      onClick={() => handleToggleScreen(screen.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {screen.name}
                          </p>
                          {screen.id === "piano-settimanale" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              Nuova!
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          {screen.description}
                        </p>
                      </div>
                    </div>

                    {/* Controlli di Riordino per le schermate attive */}
                    {isSelected && (
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(orderIndex)}
                          disabled={orderIndex <= 0}
                          title="Sposta a sinistra / in alto"
                          className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(orderIndex)}
                          disabled={orderIndex >= activeTabs.length - 1}
                          title="Sposta a destra / in basso"
                          className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-20 cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer con Azioni */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Predefinite</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Salvataggio..." : "Salva Preferenze"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
