import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import type { AssistantMessage, ProposedAction } from "@/types/assistant/assistantType";

function getMessagesCollection(userId: string, pantryId: string) {
  return collection(db, "users", userId, "pantryChats", pantryId, "messages");
}

/**
 * Sottoscrive in tempo reale ai messaggi della chat tra utente e assistente per una determinata dispensa
 */
export function subscribeAssistantMessages(
  userId: string,
  pantryId: string,
  callback: (messages: AssistantMessage[]) => void
): () => void {
  if (!userId || !pantryId) {
    callback([]);
    return () => {};
  }

  const colRef = getMessagesCollection(userId, pantryId);
  const q = query(colRef, orderBy("createdAt", "asc"), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: AssistantMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          role: data.role as "user" | "assistant",
          content: data.content || "",
          createdAt: data.createdAt || Timestamp.now(),
          proposedActions: data.proposedActions || [],
        };
      });
      callback(messages);
    },
    (err) => {
      console.error("[assistantChat] Errore ascolto messaggi Firestore:", err);
      callback([]);
    }
  );
}

/**
 * Invia un messaggio utente
 */
export async function sendUserAssistantMessage(
  userId: string,
  pantryId: string,
  content: string
): Promise<string> {
  const colRef = getMessagesCollection(userId, pantryId);
  const docRef = await addDoc(colRef, {
    role: "user",
    content,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Salva la risposta dell'assistente con le eventuali azioni confermabili
 */
export async function saveAssistantReply(
  userId: string,
  pantryId: string,
  content: string,
  proposedActions: ProposedAction[] = []
): Promise<string> {
  const colRef = getMessagesCollection(userId, pantryId);
  const docRef = await addDoc(colRef, {
    role: "assistant",
    content,
    createdAt: serverTimestamp(),
    proposedActions,
  });
  return docRef.id;
}

/**
 * Aggiorna lo stato di un'azione proposta (es. "applied" o "cancelled")
 */
export async function updateProposedActionStatus(
  userId: string,
  pantryId: string,
  messageId: string,
  actionId: string,
  newStatus: "applied" | "cancelled"
): Promise<void> {
  const msgDocRef = doc(db, "users", userId, "pantryChats", pantryId, "messages", messageId);
  const snapshot = await getDocs(query(getMessagesCollection(userId, pantryId)));
  const found = snapshot.docs.find((d) => d.id === messageId);
  if (!found) return;

  const currentActions: ProposedAction[] = found.data().proposedActions || [];
  const updatedActions = currentActions.map((act) =>
    act.id === actionId ? { ...act, status: newStatus } : act
  );

  await updateDoc(msgDocRef, {
    proposedActions: updatedActions,
  });
}

/**
 * Cancella tutti i messaggi della conversazione corrente per la dispensa
 */
export async function clearAssistantChat(userId: string, pantryId: string): Promise<void> {
  if (!userId || !pantryId) return;
  const colRef = getMessagesCollection(userId, pantryId);
  const snapshot = await getDocs(colRef);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}
