"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShoppingCart,
  Trash2,
  Loader2,
  Calendar,
  Grid3X3,
  List,
  AlertTriangle,
  Leaf,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  getProductsByPantry,
  getExpiringProductsByPantry,
} from "@/lib/firestore/products";
import {
  getWeekInfo,
  getWeeklyMealPlan,
  saveMealSlot,
  saveFullWeeklyMealPlan,
  clearWeeklyMealPlan,
} from "@/lib/firestore/mealPlan";
import {
  generateAIAntiWasteWeeklyPlan,
  generateSingleMealSuggestion,
} from "@/lib/genkit/genkit";
import type { Product } from "@/types/firestore/productType";
import type {
  WeeklyMealPlan,
  MealSlotType,
  MealSlotItem,
} from "@/types/firestore/mealPlanType";
import {
  MealSlotCard,
  AssignMealModal,
  WeeklyShoppingReviewModal,
} from "@/components";

const MEAL_SLOTS: MealSlotType[] = ["colazione", "pranzo", "merenda", "cena"];

export default function PianoSettimanalePage() {
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [pantryItems, setPantryItems] = useState<Product[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);

  // Settimana corrente e navigazione
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  // Piano pasti caricato
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(true);

  // Stati IA & Azioni
  const [isGeneratingAiWeekly, setIsGeneratingAiWeekly] = useState<boolean>(false);
  const [aiGeneratingSlot, setAiGeneratingSlot] = useState<string | null>(null);

  // Modali
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState<boolean>(false);
  const [assignModalTarget, setAssignModalTarget] = useState<{
    dateStr: string;
    dayName: string;
    slotType: MealSlotType;
  } | null>(null);

  // Calcolo estremi settimana corrente rispetto a weekOffset
  const currentWeekInfo = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return getWeekInfo(base);
  }, [weekOffset]);

  // Seleziona il giorno di oggi come default all'avvio o il primo giorno
  useEffect(() => {
    if (weekOffset === 0) {
      const todayIdx = currentWeekInfo.days.findIndex((d) => d.isToday);
      if (todayIdx !== -1) {
        setSelectedDayIndex(todayIdx);
      }
    }
  }, [weekOffset, currentWeekInfo]);

  // Caricamento Dati Utente e Dispensa
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser({ uid: user.uid });
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const pantryId = userSnap.data()?.userProfilePantryId;
          if (pantryId) {
            setCurrentPantryId(pantryId);
            const [allProducts, expiring] = await Promise.all([
              getProductsByPantry(pantryId),
              getExpiringProductsByPantry(pantryId, 5),
            ]);
            setPantryItems(allProducts.filter((p) => p.productQuantity > 0));
            setExpiringProducts(expiring.filter((p) => p.productQuantity > 0));
          }
        } catch (err) {
          console.error("Errore caricamento dati dispensa per meal plan:", err);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Caricamento Piano Pasti della settimana selezionata
  const loadPlan = useCallback(async () => {
    if (!currentUser?.uid) return;
    setIsLoadingPlan(true);
    try {
      const plan = await getWeeklyMealPlan(currentUser.uid, currentWeekInfo.weekId);
      setWeeklyPlan(plan);
    } catch (err) {
      console.error("Errore caricamento weekly meal plan:", err);
    } finally {
      setIsLoadingPlan(false);
    }
  }, [currentUser, currentWeekInfo.weekId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Formatta data leggibile per l'intervallo dell'header (es. "05 Ott - 11 Ott 2026")
  const formattedWeekRange = useMemo(() => {
    if (!currentWeekInfo.days || currentWeekInfo.days.length < 7) return "";
    const startParts = currentWeekInfo.startDate.split("-");
    const endParts = currentWeekInfo.endDate.split("-");
    return `${startParts[2]}/${startParts[1]} - ${endParts[2]}/${endParts[1]}/${endParts[0]}`;
  }, [currentWeekInfo]);

  // Calcola conteggio totale pasti pianificati nella settimana
  const totalPlannedMeals = useMemo(() => {
    if (!weeklyPlan?.days) return 0;
    let count = 0;
    Object.values(weeklyPlan.days).forEach((d) => {
      if (d.slots) {
        Object.values(d.slots).forEach((s) => {
          if (s) count++;
        });
      }
    });
    return count;
  }, [weeklyPlan]);

  // Assegna pasto a uno slot
  const handleSaveSlot = async (
    dateStr: string,
    dayName: string,
    slotType: MealSlotType,
    item: MealSlotItem
  ) => {
    if (!currentUser?.uid) return;

    try {
      await saveMealSlot(
        currentUser.uid,
        currentWeekInfo.weekId,
        dateStr,
        dayName,
        slotType,
        item,
        currentWeekInfo.startDate,
        currentWeekInfo.endDate
      );

      // Aggiorna stato locale
      setWeeklyPlan((prev) => {
        const next: WeeklyMealPlan = prev
          ? JSON.parse(JSON.stringify(prev))
          : {
              weekId: currentWeekInfo.weekId,
              userId: currentUser.uid,
              startDate: currentWeekInfo.startDate,
              endDate: currentWeekInfo.endDate,
              days: {},
            };

        if (!next.days) next.days = {};
        if (!next.days[dateStr]) {
          next.days[dateStr] = {
            date: dateStr,
            dayName,
            slots: {
              colazione: null,
              pranzo: null,
              merenda: null,
              cena: null,
            },
          };
        }
        next.days[dateStr].slots[slotType] = item;
        return next;
      });
    } catch (err) {
      console.error("Errore salvataggio slot pasto:", err);
      alert("Si è verificato un errore durante il salvataggio del pasto.");
    }
  };

  // Cancella pasto da uno slot
  const handleClearSlot = async (
    dateStr: string,
    dayName: string,
    slotType: MealSlotType
  ) => {
    if (!currentUser?.uid) return;
    try {
      await saveMealSlot(
        currentUser.uid,
        currentWeekInfo.weekId,
        dateStr,
        dayName,
        slotType,
        null,
        currentWeekInfo.startDate,
        currentWeekInfo.endDate
      );

      setWeeklyPlan((prev) => {
        if (!prev?.days?.[dateStr]?.slots) return prev;
        const next = JSON.parse(JSON.stringify(prev));
        next.days[dateStr].slots[slotType] = null;
        return next;
      });
    } catch (err) {
      console.error("Errore eliminazione pasto:", err);
    }
  };

  // Suggerimento veloce IA per singolo slot
  const handleSuggestAiForSlot = async (
    dateStr: string,
    dayName: string,
    slotType: MealSlotType
  ) => {
    const slotKey = `${dateStr}-${slotType}`;
    setAiGeneratingSlot(slotKey);

    try {
      const expiringSimple = expiringProducts.map((p) => ({
        name: p.productName,
        quantity: `${p.productQuantity}`,
      }));
      const availableSimple = pantryItems.map((p) => ({
        name: p.productName,
        quantity: `${p.productQuantity}`,
      }));

      const suggestion = await generateSingleMealSuggestion(
        slotType,
        dayName,
        expiringSimple,
        availableSimple
      );

      if (suggestion) {
        const item: MealSlotItem = {
          slotId: slotKey,
          slotType,
          recipeTitle: suggestion.recipeTitle,
          recipeIsAntiWaste: true,
          notes: suggestion.notes,
          ingredients: suggestion.ingredients?.map((i) => ({
            name: i.name,
            quantity: i.quantity,
          })),
        };

        await handleSaveSlot(dateStr, dayName, slotType, item);
      }
    } catch (err) {
      console.error("Errore suggerimento singolo pasto:", err);
    } finally {
      setAiGeneratingSlot(null);
    }
  };

  // Generatore IA Piano Settimanale Completo Anti-Spreco
  const handleGenerateAiWeeklyPlan = async () => {
    if (!currentUser?.uid) return;

    if (totalPlannedMeals > 0) {
      const confirm = window.confirm(
        "Hai già dei pasti pianificati in questa settimana. Vuoi sostituirli con il nuovo piano generato dall'IA anti-spreco?"
      );
      if (!confirm) return;
    }

    setIsGeneratingAiWeekly(true);
    try {
      const expiringSimple = expiringProducts.map((p) => ({
        name: p.productName,
        quantity: `${p.productQuantity}`,
        expiryDate: p.expiryDateProduct
          ? new Date(p.expiryDateProduct.toDate()).toLocaleDateString("it-IT")
          : undefined,
      }));
      const availableSimple = pantryItems.map((p) => ({
        name: p.productName,
        quantity: `${p.productQuantity}`,
      }));

      const result = await generateAIAntiWasteWeeklyPlan(
        currentWeekInfo.days,
        expiringSimple,
        availableSimple
      );

      if (!result || !result.days) {
        alert("Non è stato possibile generare il piano settimanale. Riprova tra poco.");
        return;
      }

      // Converti in WeeklyMealPlan
      const newPlan: WeeklyMealPlan = {
        weekId: currentWeekInfo.weekId,
        userId: currentUser.uid,
        startDate: currentWeekInfo.startDate,
        endDate: currentWeekInfo.endDate,
        days: {},
      };

      currentWeekInfo.days.forEach((d) => {
        const aiDay = result.days[d.dateStr];
        newPlan.days[d.dateStr] = {
          date: d.dateStr,
          dayName: d.dayName,
          slots: {
            colazione: aiDay?.colazione
              ? {
                  slotId: `${d.dateStr}-colazione`,
                  slotType: "colazione",
                  recipeTitle: aiDay.colazione.recipeTitle,
                  recipeIsAntiWaste: aiDay.colazione.recipeIsAntiWaste,
                  notes: aiDay.colazione.notes,
                  ingredients: aiDay.colazione.ingredients,
                }
              : null,
            pranzo: aiDay?.pranzo
              ? {
                  slotId: `${d.dateStr}-pranzo`,
                  slotType: "pranzo",
                  recipeTitle: aiDay.pranzo.recipeTitle,
                  recipeIsAntiWaste: aiDay.pranzo.recipeIsAntiWaste,
                  notes: aiDay.pranzo.notes,
                  ingredients: aiDay.pranzo.ingredients,
                }
              : null,
            merenda: aiDay?.merenda
              ? {
                  slotId: `${d.dateStr}-merenda`,
                  slotType: "merenda",
                  recipeTitle: aiDay.merenda.recipeTitle,
                  recipeIsAntiWaste: aiDay.merenda.recipeIsAntiWaste,
                  notes: aiDay.merenda.notes,
                  ingredients: aiDay.merenda.ingredients,
                }
              : null,
            cena: aiDay?.cena
              ? {
                  slotId: `${d.dateStr}-cena`,
                  slotType: "cena",
                  recipeTitle: aiDay.cena.recipeTitle,
                  recipeIsAntiWaste: aiDay.cena.recipeIsAntiWaste,
                  notes: aiDay.cena.notes,
                  ingredients: aiDay.cena.ingredients,
                }
              : null,
          },
        };
      });

      await saveFullWeeklyMealPlan(currentUser.uid, newPlan);
      setWeeklyPlan(newPlan);
    } catch (err) {
      console.error("Errore generazione piano settimanale IA:", err);
      alert("Errore durante la generazione del piano settimanale.");
    } finally {
      setIsGeneratingAiWeekly(false);
    }
  };

  // Reset intero piano settimanale
  const handleClearWeek = async () => {
    if (!currentUser?.uid || totalPlannedMeals === 0) return;
    const confirm = window.confirm(
      "Sei sicuro di voler cancellare tutti i pasti pianificati per questa settimana?"
    );
    if (!confirm) return;

    try {
      await clearWeeklyMealPlan(currentUser.uid, currentWeekInfo.weekId);
      setWeeklyPlan(null);
    } catch (err) {
      console.error("Errore cancellazione piano settimanale:", err);
    }
  };

  const selectedDayInfo = currentWeekInfo.days[selectedDayIndex] || currentWeekInfo.days[0];
  const selectedDayPlan = weeklyPlan?.days?.[selectedDayInfo?.dateStr];

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Top Banner & Titolo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-primary/10 text-primary">
              <CalendarDays className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Piano Pasti Settimanale
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pianifica la tua alimentazione, valorizza gli alimenti in scadenza e genera automaticamente la spesa.
          </p>
        </div>

        {/* Pulsanti Azione Principali */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pulsante Pianifica con IA */}
          <button
            type="button"
            onClick={handleGenerateAiWeeklyPlan}
            disabled={isGeneratingAiWeekly}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isGeneratingAiWeekly ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Chef AI al lavoro...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Pianifica con IA Anti-Spreco</span>
              </>
            )}
          </button>

          {/* Pulsante Genera Spesa */}
          <button
            type="button"
            onClick={() => setIsShoppingModalOpen(true)}
            disabled={totalPlannedMeals === 0 || !currentPantryId}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-input bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm shadow-xs transition-colors disabled:opacity-40"
            title={
              totalPlannedMeals === 0
                ? "Pianifica almeno un pasto prima di generare la spesa"
                : "Genera la lista della spesa per gli ingredienti mancanti"
            }
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Genera Spesa</span>
          </button>

          {/* Svuota piano */}
          {totalPlannedMeals > 0 && (
            <button
              type="button"
              onClick={handleClearWeek}
              className="p-2.5 rounded-2xl border border-border/80 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Svuota piano della settimana"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pillola Allerta Anti-Spreco se presenti ingredienti a rischio */}
      {expiringProducts.length > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              Hai <b>{expiringProducts.length} ingredienti</b> in scadenza nei prossimi giorni (es.{" "}
              {expiringProducts.slice(0, 3).map((p) => p.productName).join(", ")}
              ). Lo Chef IA darà loro precedenza nei pasti di Lunedì, Martedì e Mercoledì!
            </span>
          </div>
          <button
            type="button"
            onClick={handleGenerateAiWeeklyPlan}
            disabled={isGeneratingAiWeekly}
            className="shrink-0 ml-3 text-xs font-bold underline hover:opacity-80"
          >
            Usa IA →
          </button>
        </div>
      )}

      {/* Selettore Settimana e Modalità Vista */}
      <div className="p-4 rounded-3xl bg-card border border-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Controlli Settimana */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="Settimana precedente"
            className="p-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center px-3">
            <span className="block text-xs uppercase font-bold tracking-wider text-muted-foreground">
              {currentWeekInfo.weekId}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {formattedWeekRange}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label="Settimana successiva"
            className="p-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="ml-2 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Questa settimana
            </button>
          )}
        </div>

        {/* Toggle Vista Singolo Giorno / Settimana Completa */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex p-1 rounded-2xl bg-muted/60 border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === "day"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Giorno</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === "week"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Settimana</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs dei Giorni (Lunedì - Domenica) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {currentWeekInfo.days.map((day, idx) => {
          const isSelected = selectedDayIndex === idx && viewMode === "day";
          const dayPlan = weeklyPlan?.days?.[day.dateStr];
          const hasMeals =
            dayPlan &&
            dayPlan.slots &&
            Object.values(dayPlan.slots).some((s) => s !== null);

          const dayNumber = day.dateStr.split("-")[2];

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => {
                setSelectedDayIndex(idx);
                setViewMode("day");
              }}
              className={`flex-1 min-w-[70px] p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 relative ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20"
                  : "bg-card border-border hover:bg-muted text-foreground"
              }`}
            >
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {day.dayName.slice(0, 3)}
              </span>
              <span className="text-base font-extrabold">{dayNumber}</span>

              {/* Indicatore oggi */}
              {day.isToday && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  Oggi
                </span>
              )}

              {/* Indicatore pasti pianificati */}
              {hasMeals && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-white" : "bg-emerald-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Vista Contenuto */}
      {isLoadingPlan ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Caricamento piano pasti...</p>
        </div>
      ) : viewMode === "day" ? (
        /* VISTA SINGOLO GIORNO */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {selectedDayInfo.dayName}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({selectedDayInfo.dateStr})
              </span>
            </h2>
            <span className="text-xs text-muted-foreground">
              {Object.values(selectedDayPlan?.slots || {}).filter(Boolean).length} di 4 pasti assegnati
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MEAL_SLOTS.map((slotType) => {
              const slotItem = selectedDayPlan?.slots?.[slotType] || null;
              const isSuggesting =
                aiGeneratingSlot === `${selectedDayInfo.dateStr}-${slotType}`;

              return (
                <MealSlotCard
                  key={slotType}
                  slotType={slotType}
                  slotItem={slotItem}
                  dayName={selectedDayInfo.dayName}
                  onAssign={() =>
                    setAssignModalTarget({
                      dateStr: selectedDayInfo.dateStr,
                      dayName: selectedDayInfo.dayName,
                      slotType,
                    })
                  }
                  onClear={() =>
                    handleClearSlot(
                      selectedDayInfo.dateStr,
                      selectedDayInfo.dayName,
                      slotType
                    )
                  }
                  onSuggestAi={() =>
                    handleSuggestAiForSlot(
                      selectedDayInfo.dateStr,
                      selectedDayInfo.dayName,
                      slotType
                    )
                  }
                  isAiSuggesting={isSuggesting}
                />
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA SETTIMANA COMPLETA */
        <div className="space-y-6">
          {currentWeekInfo.days.map((day) => {
            const dayPlan = weeklyPlan?.days?.[day.dateStr];

            return (
              <div
                key={day.dateStr}
                className="p-4 sm:p-5 rounded-3xl bg-card border border-border shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {day.dayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {day.dateStr}
                    </span>
                    {day.isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-primary/10 text-primary">
                        Oggi
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {MEAL_SLOTS.map((slotType) => {
                    const slotItem = dayPlan?.slots?.[slotType] || null;
                    const isSuggesting =
                      aiGeneratingSlot === `${day.dateStr}-${slotType}`;

                    return (
                      <MealSlotCard
                        key={slotType}
                        slotType={slotType}
                        slotItem={slotItem}
                        dayName={day.dayName}
                        onAssign={() =>
                          setAssignModalTarget({
                            dateStr: day.dateStr,
                            dayName: day.dayName,
                            slotType,
                          })
                        }
                        onClear={() =>
                          handleClearSlot(day.dateStr, day.dayName, slotType)
                        }
                        onSuggestAi={() =>
                          handleSuggestAiForSlot(
                            day.dateStr,
                            day.dayName,
                            slotType
                          )
                        }
                        isAiSuggesting={isSuggesting}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modale Assegna Piatto */}
      {assignModalTarget && (
        <AssignMealModal
          isOpen={!!assignModalTarget}
          onClose={() => setAssignModalTarget(null)}
          slotType={assignModalTarget.slotType}
          dayName={assignModalTarget.dayName}
          dateStr={assignModalTarget.dateStr}
          currentSlotItem={
            weeklyPlan?.days?.[assignModalTarget.dateStr]?.slots?.[
              assignModalTarget.slotType
            ] || null
          }
          onSave={async (item) => {
            await handleSaveSlot(
              assignModalTarget.dateStr,
              assignModalTarget.dayName,
              assignModalTarget.slotType,
              item
            );
          }}
          userId={currentUser?.uid || ""}
          pantryId={currentPantryId}
          expiringProducts={expiringProducts.map((p) => ({
            name: p.productName,
            quantity: `${p.productQuantity}`,
          }))}
          availableProducts={pantryItems.map((p) => ({
            name: p.productName,
            quantity: `${p.productQuantity}`,
          }))}
        />
      )}

      {/* Modale Revisione Spesa Settimanale */}
      <WeeklyShoppingReviewModal
        isOpen={isShoppingModalOpen}
        onClose={() => setIsShoppingModalOpen(false)}
        weekPlan={weeklyPlan}
        pantryProducts={pantryItems}
        pantryId={currentPantryId}
      />
    </div>
  );
}
