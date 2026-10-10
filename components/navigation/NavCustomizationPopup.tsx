"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Check,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Layout,
  Refrigerator,
  ShoppingCart,
  ChefHat,
  CalendarDays,
  Trash2,
  Settings,
  Smartphone,
  Monitor,
  Sparkles,
  Leaf,
  User,
} from "lucide-react";
import {
  ALL_APP_SCREENS,
  DEFAULT_NAV_TABS,
  DEFAULT_DESKTOP_NAV_TABS,
  updateBothNavTabsPreferences,
} from "@/lib/firestore/userProfile";
import { auth } from "@/lib/firebase";

interface NavCustomizationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  currentTabs: string[];
  currentDesktopTabs?: string[];
  onTabsUpdated?: (newMobileTabs: string[], newDesktopTabs?: string[]) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Refrigerator,
  ShoppingCart,
  ChefHat,
  CalendarDays,
  Trash2,
  Settings,
};

type ViewMode = "mobile" | "desktop";

export function NavCustomizationPopup({
  isOpen,
  onClose,
  currentTabs,
  currentDesktopTabs,
  onTabsUpdated,
}: NavCustomizationPopupProps) {
  // Modalità attiva: rilevamento automatico del dispositivo/viewport con switch manuale
  const [activeMode, setActiveMode] = useState<ViewMode>("mobile");

  // Liste separate per Mobile e Desktop
  const [mobileTabs, setMobileTabs] = useState<string[]>(currentTabs);
  const [desktopTabs, setDesktopTabs] = useState<string[]>(
    currentDesktopTabs && currentDesktopTabs.length > 0
      ? currentDesktopTabs
      : DEFAULT_DESKTOP_NAV_TABS
  );
  const [isSaving, setIsSaving] = useState(false);

  // Auto-riconoscimento dispositivo / viewport all'apertura
  useEffect(() => {
    if (isOpen) {
      if (typeof window !== "undefined") {
        const isDesktop = window.innerWidth >= 768;
        setActiveMode(isDesktop ? "desktop" : "mobile");
      }
      setMobileTabs(
        currentTabs && currentTabs.length > 0 ? currentTabs : DEFAULT_NAV_TABS
      );
      setDesktopTabs(
        currentDesktopTabs && currentDesktopTabs.length > 0
          ? currentDesktopTabs
          : DEFAULT_DESKTOP_NAV_TABS
      );
    }
  }, [isOpen, currentTabs, currentDesktopTabs]);

  if (!isOpen) return null;

  const currentActiveList = activeMode === "desktop" ? desktopTabs : mobileTabs;
  const currentSet = new Set(currentActiveList);

  // Toggle inclusione schermata nella navbar attiva
  const handleToggleScreen = (screenId: string) => {
    if (activeMode === "mobile") {
      if (currentSet.has(screenId)) {
        if (mobileTabs.length <= 3) {
          alert("Su mobile devi mantenere almeno 3 schermate attive nella barra di navigazione.");
          return;
        }
        setMobileTabs((prev) => prev.filter((id) => id !== screenId));
      } else {
        if (mobileTabs.length >= 5) {
          alert("Su mobile puoi selezionare al massimo 5 schermate per la barra di navigazione.");
          return;
        }
        setMobileTabs((prev) => [...prev, screenId]);
      }
    } else {
      // Desktop: minimo 2, massimo fino a 8
      if (currentSet.has(screenId)) {
        if (desktopTabs.length <= 2) {
          alert("Su desktop devi mantenere almeno 2 schermate attive nella sidebar.");
          return;
        }
        setDesktopTabs((prev) => prev.filter((id) => id !== screenId));
      } else {
        if (desktopTabs.length >= 8) {
          alert("Su desktop puoi selezionare al massimo 8 schermate per la sidebar.");
          return;
        }
        setDesktopTabs((prev) => [...prev, screenId]);
      }
    }
  };

  // Sposta in alto una voce
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    if (activeMode === "mobile") {
      setMobileTabs((prev) => {
        const copy = [...prev];
        const temp = copy[index - 1];
        copy[index - 1] = copy[index];
        copy[index] = temp;
        return copy;
      });
    } else {
      setDesktopTabs((prev) => {
        const copy = [...prev];
        const temp = copy[index - 1];
        copy[index - 1] = copy[index];
        copy[index] = temp;
        return copy;
      });
    }
  };

  // Sposta in basso una voce
  const handleMoveDown = (index: number) => {
    if (index >= currentActiveList.length - 1) return;
    if (activeMode === "mobile") {
      setMobileTabs((prev) => {
        const copy = [...prev];
        const temp = copy[index + 1];
        copy[index + 1] = copy[index];
        copy[index] = temp;
        return copy;
      });
    } else {
      setDesktopTabs((prev) => {
        const copy = [...prev];
        const temp = copy[index + 1];
        copy[index + 1] = copy[index];
        copy[index] = temp;
        return copy;
      });
    }
  };

  const handleResetDefault = () => {
    if (activeMode === "mobile") {
      setMobileTabs(DEFAULT_NAV_TABS);
    } else {
      setDesktopTabs(DEFAULT_DESKTOP_NAV_TABS);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    try {
      await updateBothNavTabsPreferences(user.uid, mobileTabs, desktopTabs);
      onTabsUpdated?.(mobileTabs, desktopTabs);
      onClose();
    } catch (err) {
      console.error("Errore salvataggio personalizzazione navigazione:", err);
      alert("Errore durante il salvataggio delle preferenze.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Layout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Personalizza Barra & Sidebar
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configurazioni dedicate per smartphone e computer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Scrollabile */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Switch Segmentato Mobile / Desktop con Riconoscimento Intelligente */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80">
            <button
              type="button"
              onClick={() => setActiveMode("mobile")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === "mobile"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-zinc-200/50 dark:ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Mobile (Barra)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                {mobileTabs.length} / 5
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("desktop")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMode === "desktop"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-zinc-200/50 dark:ring-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Desktop (Sidebar)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                {desktopTabs.length} / 8
              </span>
            </button>
          </div>

          {/* SIMULAZIONE REALISTICA: MODALITÀ MOBILE */}
          {activeMode === "mobile" && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-all animate-in fade-in">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Anteprima Barra Inferiore Mobile</span>
                </div>
                <span className="text-[11px] text-zinc-400">Vincolo: 3 - 5 schermate</span>
              </div>

              {/* Simulatore Schermo Smartphone con Navbar Inferiore */}
              <div className="p-2 pt-4 bg-zinc-100/70 dark:bg-zinc-900/90 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 flex flex-col justify-end">
                <div className="flex items-center justify-around py-2.5 px-1 bg-white/95 dark:bg-zinc-950/95 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs backdrop-blur-md">
                  {mobileTabs.map((tabId, idx) => {
                    const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
                    if (!screen) return null;
                    const IconComponent = ICON_MAP[screen.iconName] || Refrigerator;
                    const isFirst = idx === 0;

                    return (
                      <div
                        key={tabId}
                        className="flex flex-col items-center justify-center space-y-1 min-w-[48px] text-center"
                      >
                        <IconComponent
                          className={`w-4 h-4 ${
                            isFirst
                              ? "text-emerald-600 dark:text-emerald-400 scale-105"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        />
                        <span
                          className={`text-[9px] font-semibold truncate w-full ${
                            isFirst
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {screen.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SIMULAZIONE REALISTICA: MODALITÀ DESKTOP */}
          {activeMode === "desktop" && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-all animate-in fade-in">
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  <Monitor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Anteprima Sidebar Laterale Desktop</span>
                </div>
                <span className="text-[11px] text-zinc-400">Vincolo: 2 - 8 schermate</span>
              </div>

              {/* Simulatore Finestra Browser con Sidebar Laterale */}
              <div className="p-3 bg-zinc-100/70 dark:bg-zinc-900/90 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
                <div className="flex gap-3">
                  {/* Mini Sidebar Desktop */}
                  <div className="w-48 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-2.5 shadow-xs flex flex-col justify-between space-y-3">
                    {/* Header Mini Sidebar con Logo */}
                    <div>
                      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 border-b border-zinc-100 dark:border-zinc-900 pb-2">
                        <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <Leaf className="w-3 h-3 fill-current" />
                        </div>
                        <span className="font-extrabold text-xs tracking-tight text-zinc-900 dark:text-zinc-100">
                          Pantry<span className="text-emerald-600 dark:text-emerald-400">AI</span>
                        </span>
                      </div>

                      {/* Voci di navigazione verticali ordinate */}
                      <div className="space-y-1">
                        {desktopTabs.map((tabId, idx) => {
                          const screen = ALL_APP_SCREENS.find((s) => s.id === tabId);
                          if (!screen) return null;
                          const IconComponent = ICON_MAP[screen.iconName] || Refrigerator;
                          const isFirst = idx === 0;

                          return (
                            <div
                              key={tabId}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                isFirst
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-2xs"
                                  : "text-zinc-600 dark:text-zinc-400"
                              }`}
                            >
                              <IconComponent
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  isFirst ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"
                                }`}
                              />
                              <span className="truncate text-[11px]">{screen.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Mini Sidebar */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 space-y-1">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-900 text-zinc-500 text-[10px] font-medium">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        <span>Chef AI (Cmd+J)</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-zinc-400 text-[10px]">
                        <User className="w-3 h-3" />
                        <span className="truncate">Profilo</span>
                      </div>
                    </div>
                  </div>

                  {/* Finta Area Contenuto Destro */}
                  <div className="flex-1 bg-white/60 dark:bg-zinc-950/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-3 flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Area Principale App
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-[130px]">
                      La navigazione a sinistra si aggiornerà in tempo reale
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Elenco Schermate con Toggle e Riordino */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Schermate Disponibili ({activeMode === "desktop" ? "Desktop" : "Mobile"})
              </h3>
              <span className="text-[11px] text-zinc-400">
                Tocca per mostrare o nascondere
              </span>
            </div>

            <div className="space-y-2">
              {ALL_APP_SCREENS.map((screen) => {
                const isSelected = currentSet.has(screen.id);
                const orderIndex = currentActiveList.indexOf(screen.id);
                const IconComponent = ICON_MAP[screen.iconName] || Refrigerator;

                return (
                  <div
                    key={screen.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/60"
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
                            ? "bg-emerald-600 text-white shadow-xs"
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
                          {isSelected && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              Attiva (#{orderIndex + 1})
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
                          title="Sposta in alto"
                          className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-20 cursor-pointer transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(orderIndex)}
                          disabled={orderIndex >= currentActiveList.length - 1}
                          title="Sposta in basso"
                          className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-20 cursor-pointer transition-colors"
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
            <span>Predefinite ({activeMode === "desktop" ? "Desktop" : "Mobile"})</span>
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50"
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
