import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp, Timestamp, deleteDoc } from "firebase/firestore";
import type { ProductHistoryLog } from "../../types/firestore/productHistoryType";

// Recupero lo storico dei prodotti per una specifica dispensa
export async function getProductHistoryByPantry(pantryId: string): Promise<ProductHistoryLog[]> {
  const historyRef = collection(db, "pantries", pantryId, "history");

  const querySnapshot = await getDocs(historyRef);
  const history: ProductHistoryLog[] = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    history.push({
      logId: docSnap.id,
      ...data,
      quantityHistory: data.quantityHistory ?? data.quantityAffected ?? 1,
    } as ProductHistoryLog);
  });

  return history;
}

// Aggiunge un record nello storico quando un prodotto viene consumato o buttato
export async function addProductHistoryLog(
  pantryId: string,
  logData: Omit<ProductHistoryLog, "logId" | "resolvedAt" | "pantryId">
): Promise<string> {
  const historyRef = doc(collection(db, "pantries", pantryId, "history"));

  const newLog: ProductHistoryLog = {
    ...logData,
    logId: historyRef.id,
    pantryId: pantryId,
    resolvedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(historyRef, newLog);
  return historyRef.id;
}

// Elimina un record dallo storico
export async function deleteProductHistoryLog(pantryId: string, logId: string): Promise<void> {
  const historyRef = doc(db, "pantries", pantryId, "history", logId);
  await deleteDoc(historyRef);
}
