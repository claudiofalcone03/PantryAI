"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  ArrowLeft,
  Sparkles,
  Bot,
  Plus,
  Search,
  CheckCircle2,
  Save,
  Loader2,
  Salad,
} from "lucide-react";
import type {
  DietaryRegime,
  UserDietaryPreferences,
  AtomicMemoryPrinciple,
  MemoryCategory,
} from "@/types/firestore/userMemoryType";
import {
  DIETARY_REGIMES_INFO,
  COMMON_ALLERGIES,
  MEMORY_CATEGORIES_INFO,
} from "@/types/firestore/userMemoryType";
import {
  getDietaryPreferences,
  saveDietaryPreferences,
  getMemoryFacts,
  addMemoryFact,
  updateMemoryFact,
  toggleMemoryFact,
  deleteMemoryFact,
  DEFAULT_DIETARY_PREFERENCES,
} from "@/lib/firestore/userMemory";
import { MemoryPrincipleItem } from "@/components/memory/MemoryPrincipleItem";
import { AddMemoryFactModal } from "@/components/memory/AddMemoryFactModal";

export default function MemoryPreferencesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Stati Dieta & Intolleranze
  const [dietPrefs, setDietPrefs] = useState<UserDietaryPreferences>(DEFAULT_DIETARY_PREFERENCES);
  const [customAllergyInput, setCustomAllergyInput] = useState("");
  const [dietSaving, setDietSaving] = useState(false);
  const [dietSavedSuccess, setDietSavedSuccess] = useState(false);

  // Stati Memoria Atomica
  const [memoryFacts, setMemoryFacts] = useState<AtomicMemoryPrinciple[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setLoading(false);
        router.push("/profilo");
        return;
      }

      setUserId(user.uid);
      try {
        const [prefs, facts] = await Promise.all([
          getDietaryPreferences(user.uid),
          getMemoryFacts(user.uid),
        ]);
        setDietPrefs(prefs);
        setMemoryFacts(facts);
      } catch (err) {
        console.error("Errore caricamento preferenze memoria:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Gestione Dieta Principale
  const handleSelectRegime = (regimeId: DietaryRegime) => {
    setDietPrefs((prev) => ({
      ...prev,
      primaryRegime: regimeId,
    }));
    setDietSavedSuccess(false);
  };

  // Gestione Toggle Allergia
  const handleToggleAllergy = (allergy: string) => {
    setDietPrefs((prev) => {
      const exists = prev.allergies.includes(allergy);
      const nextAllergies = exists
        ? prev.allergies.filter((a) => a !== allergy)
        : [...prev.allergies, allergy];
      return {
        ...prev,
        allergies: nextAllergies,
      };
    });
    setDietSavedSuccess(false);
  };

  // Aggiungi allergia custom
  const handleAddCustomAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customAllergyInput.trim();
    if (!trimmed) return;
    if (!dietPrefs.allergies.includes(trimmed)) {
      setDietPrefs((prev) => ({
        ...prev,
        allergies: [...prev.allergies, trimmed],
      }));
    }
    setCustomAllergyInput("");
    setDietSavedSuccess(false);
  };

  // Salvataggio esplicito Dieta & Note
  const handleSaveDietaryPreferences = async () => {
    if (!userId || dietSaving) return;
    setDietSaving(true);
    setDietSavedSuccess(false);
    try {
      await saveDietaryPreferences(userId, dietPrefs);
      setDietSavedSuccess(true);
      setTimeout(() => setDietSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Errore salvataggio preferenze dietetiche:", err);
      alert("Errore durante il salvataggio delle preferenze dietetiche.");
    } finally {
      setDietSaving(false);
    }
  };

  // Operazioni Principi Atomici
  const handleAddPrinciple = async (text: string, category: MemoryCategory) => {
    if (!userId) return;
    const created = await addMemoryFact(userId, {
      text,
      category,
      source: "user",
      isActive: true,
    });
    setMemoryFacts((prev) => [created, ...prev]);
  };

  const handleTogglePrinciple = async (id: string, active: boolean) => {
    if (!userId) return;
    await toggleMemoryFact(userId, id, active);
    setMemoryFacts((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isActive: active } : f))
    );
  };

  const handleUpdatePrinciple = async (id: string, text: string, category: MemoryCategory) => {
    if (!userId) return;
    await updateMemoryFact(userId, id, { text, category });
    setMemoryFacts((prev) =>
      prev.map((f) => (f.id === id ? { ...f, text, category } : f))
    );
  };

  const handleDeletePrinciple = async (id: string) => {
    if (!userId) return;
    await deleteMemoryFact(userId, id);
    setMemoryFacts((prev) => prev.filter((f) => f.id !== id));
  };

  // Filtraggio principi
  const filteredFacts = useMemo(() => {
    return memoryFacts.filter((fact) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        fact.text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategoryFilter === "all" || fact.category === selectedCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [memoryFacts, searchQuery, selectedCategoryFilter]);

  const activeFactsCount = useMemo(() => {
    return memoryFacts.filter((f) => f.isActive).length;
  }, [memoryFacts]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50/50 dark:bg-zinc-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-zinc-500 font-medium">Caricamento memoria e preferenze...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-screen overflow-hidden bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top Bar Header Ancorata */}
      <header className="shrink-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/profilo")}
              className="p-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
              title="Torna al Profilo"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Memoria & Preferenze IA</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  ZenChef AI
                </span>
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Regime alimentare, intolleranze e principi atomici appresi dall&apos;assistente
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area con Scroll Indipendente */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8 pb-28 md:pb-16">
        {/* Banner Esplicativo Memoria Atomica */}
        <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 dark:border-emerald-500/10 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Come l&apos;IA ricorda e personalizza per te
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Ogni volta che chatti con <strong>ZenChef</strong> o chiedi aiuto a <strong>Pantry Copilot</strong>,
                l&apos;IA estrae in background singoli <em>principi atomici</em> (es. &quot;Non gradisce aglio crudo&quot;, &quot;Cena veloce per 2&quot;).
                Qui hai il <strong>controllo assoluto</strong>: puoi attivare, modificare o eliminare qualsiasi principio per mantenere le ricette perfette per le tue abitudini.
              </p>
            </div>
          </div>
        </div>

        {/* SEZIONE 1: REGIME ALIMENTARE & INTOLLERANZE */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Salad className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Regime Alimentare & Dieta
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Imposta il tuo stile nutrizionale principale e segnala allergie o intolleranze
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveDietaryPreferences}
              disabled={dietSaving}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                dietSavedSuccess
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              } disabled:opacity-50`}
            >
              {dietSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : dietSavedSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Preferenze Salvate!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Salva Preferenze</span>
                </>
              )}
            </button>
          </div>

          {/* Griglia Regimi Principali */}
          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block mb-2.5">
              1. Scegli il Regime Principale
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {(Object.keys(DIETARY_REGIMES_INFO) as DietaryRegime[]).map((regimeKey) => {
                const info = DIETARY_REGIMES_INFO[regimeKey];
                const isSelected = dietPrefs.primaryRegime === regimeKey;
                return (
                  <button
                    key={regimeKey}
                    type="button"
                    onClick={() => handleSelectRegime(regimeKey)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white dark:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{info.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold truncate">{info.label}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                        {info.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allergie & Intolleranze */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                2. Allergie & Intolleranze da Escludere Tassativamente
              </label>
              <span className="text-[11px] text-zinc-400">
                {dietPrefs.allergies.length} selezionate
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_ALLERGIES.map((allergy) => {
                const isChecked = dietPrefs.allergies.includes(allergy);
                return (
                  <button
                    key={allergy}
                    type="button"
                    onClick={() => handleToggleAllergy(allergy)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 shadow-2xs"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                    }`}
                  >
                    <span>{allergy}</span>
                    {isChecked && <CheckCircle2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                  </button>
                );
              })}

              {/* Eventuali allergie custom già inserite non presenti nella lista standard */}
              {dietPrefs.allergies
                .filter((a) => !COMMON_ALLERGIES.includes(a as any))
                .map((customAllergy) => (
                  <button
                    key={customAllergy}
                    type="button"
                    onClick={() => handleToggleAllergy(customAllergy)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 cursor-pointer"
                  >
                    <span>{customAllergy}</span>
                    <span className="text-[10px] text-rose-400">✕</span>
                  </button>
                ))}
            </div>

            {/* Input per aggiungere intolleranza custom */}
            <form onSubmit={handleAddCustomAllergy} className="flex gap-2 max-w-sm">
              <input
                type="text"
                value={customAllergyInput}
                onChange={(e) => setCustomAllergyInput(e.target.value)}
                placeholder="Aggiungi altra intolleranza..."
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={!customAllergyInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 cursor-pointer disabled:opacity-50"
              >
                + Aggiungi
              </button>
            </form>
          </div>

          {/* Note Speciali Libere */}
          <div>
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block mb-1.5">
              3. Note Libere sulla Tua Dieta (Opzionali)
            </label>
            <textarea
              rows={2}
              value={dietPrefs.customNotes || ""}
              onChange={(e) => {
                setDietPrefs((prev) => ({ ...prev, customNotes: e.target.value }));
                setDietSavedSuccess(false);
              }}
              placeholder="es. Cucino principalmente per 2 adulti e 1 bambino. A pranzo preferisco pasti veloci, a cena più elaborati."
              className="w-full px-3.5 py-2 rounded-2xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </section>

        {/* SEZIONE 2: PRINCIPI ATOMICI MEMORIZZATI DALL'IA */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Principi Atomici Memorizzati
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {activeFactsCount} attivi su {memoryFacts.length}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Fatti e gusti specifici appresi dalle chat o inseriti manualmente
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Principio</span>
            </button>
          </div>

          {/* Barra di ricerca e Filtro Categorie */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca nei principi memorizzati..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedCategoryFilter === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                }`}
              >
                Tutti ({memoryFacts.length})
              </button>

              {(Object.keys(MEMORY_CATEGORIES_INFO) as MemoryCategory[]).map((catKey) => {
                const info = MEMORY_CATEGORIES_INFO[catKey];
                const count = memoryFacts.filter((f) => f.category === catKey).length;
                if (count === 0 && selectedCategoryFilter !== catKey) return null;
                const isSelected = selectedCategoryFilter === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(catKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    {info.badgeLabel} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Elenco Principi */}
          {filteredFacts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-3">
              <Bot className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {memoryFacts.length === 0
                    ? "Nessun principio memorizzato al momento"
                    : "Nessun principio corrisponde alla ricerca"}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                  {memoryFacts.length === 0
                    ? "Man mano che chatti con ZenChef o con il Copilot, l'IA imparerà le tue preferenze stabili. Puoi anche aggiungere una regola manuale adesso!"
                    : "Prova a cambiare il filtro o la parola chiave di ricerca."}
                </p>
              </div>
              {memoryFacts.length === 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi il primo principio</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredFacts.map((fact) => (
                <MemoryPrincipleItem
                  key={fact.id}
                  principle={fact}
                  onToggle={handleTogglePrinciple}
                  onUpdate={handleUpdatePrinciple}
                  onDelete={handleDeletePrinciple}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal Aggiungi Principio */}
      <AddMemoryFactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddPrinciple}
      />
    </div>
  );
}
