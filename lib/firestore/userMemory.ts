import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import type {
  UserDietaryPreferences,
  AtomicMemoryPrinciple,
  DietaryRegime,
  MemoryCategory,
} from "@/types/firestore/userMemoryType";
import { DIETARY_REGIMES_INFO } from "@/types/firestore/userMemoryType";

export const DEFAULT_DIETARY_PREFERENCES: UserDietaryPreferences = {
  primaryRegime: "mediterranean",
  allergies: [],
  customNotes: "",
};

/**
 * Recupera le preferenze dietetiche memorizzate per l'utente in `users/{userId}`
 */
export async function getDietaryPreferences(userId: string): Promise<UserDietaryPreferences> {
  if (!userId) return DEFAULT_DIETARY_PREFERENCES;

  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return DEFAULT_DIETARY_PREFERENCES;
    }
    const data = snap.data();
    if (data.dietaryPreferences) {
      return {
        primaryRegime: data.dietaryPreferences.primaryRegime || "mediterranean",
        allergies: Array.isArray(data.dietaryPreferences.allergies) ? data.dietaryPreferences.allergies : [],
        customNotes: data.dietaryPreferences.customNotes || "",
        updatedAt: data.dietaryPreferences.updatedAt,
      };
    }
    return DEFAULT_DIETARY_PREFERENCES;
  } catch (err) {
    console.error("[userMemory] Errore recupero preferenze dietetiche:", err);
    return DEFAULT_DIETARY_PREFERENCES;
  }
}

/**
 * Salva o aggiorna le preferenze dietetiche dell'utente in `users/{userId}`
 */
export async function saveDietaryPreferences(
  userId: string,
  prefs: Partial<UserDietaryPreferences>
): Promise<void> {
  if (!userId) return;

  try {
    const userRef = doc(db, "users", userId);
    const existing = await getDietaryPreferences(userId);
    const updated: UserDietaryPreferences = {
      primaryRegime: prefs.primaryRegime || existing.primaryRegime,
      allergies: Array.isArray(prefs.allergies) ? prefs.allergies : existing.allergies,
      customNotes: prefs.customNotes !== undefined ? prefs.customNotes : (existing.customNotes || ""),
    };

    await setDoc(
      userRef,
      {
        dietaryPreferences: {
          ...updated,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[userMemory] Errore salvataggio preferenze dietetiche:", err);
    throw err;
  }
}

/**
 * Recupera l'elenco dei principi atomici della memoria dell'IA da `users/{userId}/memoryFacts`
 */
export async function getMemoryFacts(
  userId: string,
  onlyActive = false
): Promise<AtomicMemoryPrinciple[]> {
  if (!userId) return [];

  try {
    const subColRef = collection(db, "users", userId, "memoryFacts");
    // Interroga ordinando per createdAt: evita l'obbligo di indice composito Firestore
    const q = query(subColRef, orderBy("createdAt", "desc"));

    const snap = await getDocs(q);
    let list: AtomicMemoryPrinciple[] = [];

    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        text: data.text || "",
        category: (data.category as MemoryCategory) || "other",
        source: data.source === "user" ? "user" : "learned",
        isActive: data.isActive !== false, // default true
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    if (onlyActive) {
      list = list.filter((item) => item.isActive);
    }

    return list;
  } catch (err) {
    console.error("[userMemory] Errore recupero memory facts:", err);
    return [];
  }
}

/**
 * Inserisce un nuovo principio atomico nella memoria dell'IA (`users/{userId}/memoryFacts`)
 */
export async function addMemoryFact(
  userId: string,
  fact: {
    text: string;
    category: MemoryCategory;
    source?: "learned" | "user";
    isActive?: boolean;
  }
): Promise<AtomicMemoryPrinciple> {
  if (!userId) throw new Error("ID utente obbligatorio.");
  if (!fact.text || !fact.text.trim()) throw new Error("Il testo del principio è obbligatorio.");

  const subColRef = collection(db, "users", userId, "memoryFacts");
  const now = serverTimestamp();

  const docData = {
    text: fact.text.trim(),
    category: fact.category || "other",
    source: fact.source || "user",
    isActive: fact.isActive !== false,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(subColRef, docData);

  // Aggiorna contatore denormalizzato nel profilo utente
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { memoryFactsCount: increment(1) }, { merge: true });
  } catch (cntErr) {
    console.warn("[userMemory] Avviso incremento conteggio memoria:", cntErr);
  }

  return {
    id: docRef.id,
    text: fact.text.trim(),
    category: fact.category || "other",
    source: fact.source || "user",
    isActive: fact.isActive !== false,
  };
}

/**
 * Aggiorna il testo, la categoria o lo stato di un principio atomico esistente
 */
export async function updateMemoryFact(
  userId: string,
  factId: string,
  updates: Partial<Pick<AtomicMemoryPrinciple, "text" | "category" | "isActive">>
): Promise<void> {
  if (!userId || !factId) return;

  const factRef = doc(db, "users", userId, "memoryFacts", factId);
  const dataToUpdate: any = {
    updatedAt: serverTimestamp(),
  };

  if (updates.text !== undefined) dataToUpdate.text = updates.text.trim();
  if (updates.category !== undefined) dataToUpdate.category = updates.category;
  if (updates.isActive !== undefined) dataToUpdate.isActive = Boolean(updates.isActive);

  await updateDoc(factRef, dataToUpdate);
}

/**
 * Attiva o disattiva un principio atomico
 */
export async function toggleMemoryFact(
  userId: string,
  factId: string,
  isActive: boolean
): Promise<void> {
  return updateMemoryFact(userId, factId, { isActive });
}

/**
 * Elimina definitivamente un principio atomico dalla memoria
 */
export async function deleteMemoryFact(userId: string, factId: string): Promise<void> {
  if (!userId || !factId) return;

  const factRef = doc(db, "users", userId, "memoryFacts", factId);
  await deleteDoc(factRef);

  // Aggiorna contatore denormalizzato
  try {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { memoryFactsCount: increment(-1) }, { merge: true });
  } catch (cntErr) {
    console.warn("[userMemory] Avviso decremento conteggio memoria:", cntErr);
  }
}

/**
 * Formatta in linguaggio naturale per i prompt di Gemini le preferenze dietetiche e i principi atomici attivi.
 * Utilizzato da ZenChef, Chef AI, Copilot e Gemini Live.
 */
export function formatUserDietAndMemoryContext(
  dietPrefs?: UserDietaryPreferences | null,
  activeFacts: AtomicMemoryPrinciple[] = []
): string {
  const lines: string[] = [];

  if (dietPrefs) {
    const regimeInfo = DIETARY_REGIMES_INFO[dietPrefs.primaryRegime as DietaryRegime] || DIETARY_REGIMES_INFO.mediterranean;
    lines.push(`- Regime Alimentare Primario: ${regimeInfo.label} (${regimeInfo.description})`);

    if (dietPrefs.allergies && dietPrefs.allergies.length > 0) {
      lines.push(`- ALLERGIE ED INTOLLERANZE SEGNALATE (OBBLIGATORIO EVITARE): ${dietPrefs.allergies.join(", ")}`);
    }

    if (dietPrefs.customNotes && dietPrefs.customNotes.trim()) {
      lines.push(`- Note personali sulla dieta: "${dietPrefs.customNotes.trim()}"`);
    }
  }

  if (activeFacts && activeFacts.length > 0) {
    lines.push("\nPRINCIPI ATOMICI MEMORIZZATI SULL'UTENTE (PREFERENZE, GUSTI E ABITUDINI PERSONALI):");
    activeFacts.forEach((fact) => {
      lines.push(`• [${fact.category.toUpperCase()}] ${fact.text}`);
    });
  }

  if (lines.length === 0) return "";

  return `\n--- PREFERENZE ALIMENTARI & MEMORIA PERSONALE UTENTE ---\n${lines.join("\n")}\nIMPORTANTE: Rispetta RIGOROSAMENTE le allergie, il regime alimentare e i gusti memorizzati in ogni ricetta, suggerimento o risposta! Se un ingrediente contrasta con una regola, non usarlo o proponi esplicitamente un'alternativa conforme.\n`;
}

/**
 * Analizza in background un messaggio dell'utente durante le chat per estrarre
 * e memorizzare silenziosamente eventuali nuovi principi atomici (gusti, diete, abitudini).
 * Non blocca la UI e gestisce la deduplicazione.
 */
export async function learnMemoryFromUserMessage(
  userId: string,
  userMessage: string
): Promise<AtomicMemoryPrinciple[]> {
  if (!userId || !userMessage || userMessage.trim().length < 8) return [];

  try {
    const existing = await getMemoryFacts(userId);
    const existingTexts = existing.map((e) => e.text);

    // Import dinamico della server action per evitare dipendenze circolari
    const { detectMemoryPrinciples } = await import("@/lib/genkit/genkit");
    const detected = await detectMemoryPrinciples(userMessage, existingTexts);

    if (!detected || detected.length === 0) return [];

    const newlySaved: AtomicMemoryPrinciple[] = [];
    for (const fact of detected) {
      const isDuplicate = existingTexts.some(
        (t) =>
          t.toLowerCase().includes(fact.text.toLowerCase()) ||
          fact.text.toLowerCase().includes(t.toLowerCase())
      );
      if (!isDuplicate) {
        const saved = await addMemoryFact(userId, {
          text: fact.text,
          category: fact.category,
          source: "learned",
          isActive: true,
        });
        newlySaved.push(saved);
        existingTexts.push(saved.text);
      }
    }

    return newlySaved;
  } catch (err) {
    console.warn("[userMemory] Errore apprendimento silenzioso:", err);
    return [];
  }
}

