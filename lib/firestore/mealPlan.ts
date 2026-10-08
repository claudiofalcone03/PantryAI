import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import type {
  WeeklyMealPlan,
  DayMealPlan,
  MealSlotType,
  MealSlotItem,
} from "@/types/firestore/mealPlanType";

const DAY_NAMES_IT = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

/**
 * Calcola l'ID settimana ISO (es. "2026-W41") e gli estremi Lunedì-Domenica
 */
export function getWeekInfo(baseDate: Date = new Date()): {
  weekId: string;
  startDate: string; // YYYY-MM-DD Lunedì
  endDate: string; // YYYY-MM-DD Domenica
  days: { dateStr: string; dayName: string; isToday: boolean }[];
} {
  const d = new Date(baseDate);
  const day = d.getDay();
  // Calcola la distanza da Lunedì (1). Se è Domenica (0), la distanza è -6 giorni.
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Calcolo ISO Week Number
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = monday.getFullYear();
  const weekId = `${year}-W${String(weekNumber).padStart(2, "0")}`;

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const dayStr = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayStr}`;
  };

  const todayStr = formatDate(new Date());

  const days: { dateStr: string; dayName: string; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const curr = new Date(monday);
    curr.setDate(monday.getDate() + i);
    const dateStr = formatDate(curr);
    const dayName = DAY_NAMES_IT[curr.getDay()];
    days.push({
      dateStr,
      dayName,
      isToday: dateStr === todayStr,
    });
  }

  return {
    weekId,
    startDate: formatDate(monday),
    endDate: formatDate(sunday),
    days,
  };
}

/**
 * Recupera il piano pasti della settimana specificata per l'utente
 */
export async function getWeeklyMealPlan(
  userId: string,
  weekId: string
): Promise<WeeklyMealPlan | null> {
  if (!userId || !weekId) return null;

  try {
    const planRef = doc(db, "users", userId, "mealPlans", weekId);
    const snap = await getDoc(planRef);

    if (!snap.exists()) {
      return null;
    }

    return snap.data() as WeeklyMealPlan;
  } catch (err) {
    console.warn("[getWeeklyMealPlan] Errore recupero piano pasti:", err);
    return null;
  }
}

/**
 * Assegna o elimina un pasto in uno slot della settimana
 */
export async function saveMealSlot(
  userId: string,
  weekId: string,
  dateStr: string,
  dayName: string,
  slotType: MealSlotType,
  item: MealSlotItem | null,
  startDate: string,
  endDate: string
): Promise<void> {
  if (!userId || !weekId || !dateStr) return;

  const planRef = doc(db, "users", userId, "mealPlans", weekId);
  const snap = await getDoc(planRef);

  let planData: WeeklyMealPlan;

  if (snap.exists()) {
    planData = snap.data() as WeeklyMealPlan;
  } else {
    planData = {
      weekId,
      userId,
      startDate,
      endDate,
      days: {},
    };
  }

  if (!planData.days) planData.days = {};
  if (!planData.days[dateStr]) {
    planData.days[dateStr] = {
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

  // Assegna o cancella lo slot
  planData.days[dateStr].slots[slotType] = item;

  await setDoc(
    planRef,
    {
      ...planData,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Salva un intero piano settimanale (es. generato dall'IA)
 */
export async function saveFullWeeklyMealPlan(
  userId: string,
  weekPlan: WeeklyMealPlan
): Promise<void> {
  if (!userId || !weekPlan.weekId) return;

  const planRef = doc(db, "users", userId, "mealPlans", weekPlan.weekId);
  await setDoc(
    planRef,
    {
      ...weekPlan,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Resetta tutti i pasti di una settimana
 */
export async function clearWeeklyMealPlan(
  userId: string,
  weekId: string
): Promise<void> {
  if (!userId || !weekId) return;

  const planRef = doc(db, "users", userId, "mealPlans", weekId);
  await deleteDoc(planRef);
}
