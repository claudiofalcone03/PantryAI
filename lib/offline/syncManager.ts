import { db } from "../firebase";
import {
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  getPendingMutations,
  removePendingMutation,
  OfflineMutation,
} from "./indexedDb";

type SyncListener = (status: {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: number;
  error?: string | null;
}) => void;

const listeners: Set<SyncListener> = new Set();
let isCurrentlySyncing = false;

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(status: {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: number;
  error?: string | null;
}) {
  for (const listener of listeners) {
    try {
      listener(status);
    } catch (e) {
      console.warn("[SyncManager] Errore notifica listener:", e);
    }
  }
}

/**
 * Riesegue tutte le mutazioni accumulate offline in sequenza su Firestore
 */
export async function syncOfflineMutations(): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine || isCurrentlySyncing) {
    return { synced: 0, failed: 0 };
  }

  isCurrentlySyncing = true;
  const mutations = await getPendingMutations();

  if (mutations.length === 0) {
    isCurrentlySyncing = false;
    notifyListeners({ isSyncing: false, pendingCount: 0 });
    return { synced: 0, failed: 0 };
  }

  notifyListeners({ isSyncing: true, pendingCount: mutations.length });

  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      await executeSingleMutation(mutation);
      if (mutation.id) {
        await removePendingMutation(mutation.id);
      }
      synced++;
    } catch (err: any) {
      console.error("[SyncManager] Errore esecuzione mutazione offline:", mutation, err);
      failed++;
    }
  }

  const remaining = await getPendingMutations();
  isCurrentlySyncing = false;
  notifyListeners({
    isSyncing: false,
    pendingCount: remaining.length,
    lastSyncedAt: Date.now(),
  });

  return { synced, failed };
}

/**
 * Esegue una singola mutazione su Firestore
 */
async function executeSingleMutation(mutation: OfflineMutation): Promise<void> {
  const { type, docId, payload } = mutation;

  switch (type) {
    case "CONSUME_PRODUCT": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      await updateDoc(ref, {
        productQuantity: payload.newQuantity,
        productUpdatedAt: serverTimestamp(),
      });
      break;
    }

    case "OPEN_PRODUCT": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      await updateDoc(ref, {
        productOpenedAt: Timestamp.fromDate(new Date(payload.openedAt)),
        productOpenedExpiryAt: Timestamp.fromDate(new Date(payload.openedExpiryAt)),
        shelfLifeDays: payload.shelfLifeDays,
        productUpdatedAt: serverTimestamp(),
      });
      break;
    }

    case "UPDATE_PRODUCT_QTY": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      await updateDoc(ref, {
        productQuantity: payload.quantity,
        productUpdatedAt: serverTimestamp(),
      });
      break;
    }

    case "SET_SHOPPING_STATUS": {
      if (!docId) return;
      const ref = doc(db, "shoppingListItems", docId);
      const updateData: any = {
        listItemStatus: payload.status,
        listItemUpdatedAt: serverTimestamp(),
      };
      if (payload.status === "reserved") {
        updateData.listItemReservedBy = payload.userName || "Utente";
        updateData.listItemReservedAt = serverTimestamp();
      } else if (payload.status === "purchased") {
        updateData.listItemPurchasedBy = payload.userName || "Utente";
        updateData.listItemPurchasedAt = serverTimestamp();
      }
      await updateDoc(ref, updateData);
      break;
    }

    case "ADD_SHOPPING_ITEM": {
      await addDoc(collection(db, "shoppingListItems"), {
        listItemPantryId: mutation.pantryId,
        listItemName: payload.name,
        listItemStatus: "toBuy",
        listItemProductId: payload.productId || null,
        listItemCreatedAt: serverTimestamp(),
      });
      break;
    }

    case "DELETE_PRODUCT": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      await deleteDoc(ref);
      break;
    }

    case "FREEZE_PRODUCT": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      const now = new Date(payload.frozenAt || Date.now());
      const frozenExpiry = new Date(payload.frozenExpiryAt);
      await updateDoc(ref, {
        isFrozen: true,
        productFrozenAt: Timestamp.fromDate(now),
        productFrozenExpiryAt: Timestamp.fromDate(frozenExpiry),
        frozenMonthsDuration: payload.monthsDuration || 3,
        originalExpiryDateBeforeFreeze: payload.originalExpiryDateBeforeFreeze
          ? Timestamp.fromDate(new Date(payload.originalExpiryDateBeforeFreeze))
          : null,
        productUpdatedAt: serverTimestamp(),
      });
      break;
    }

    case "UNFREEZE_PRODUCT": {
      if (!docId) return;
      const ref = doc(db, "products", docId);
      if (payload.mode === "consume_soon") {
        const now = new Date(payload.unfrozenAt || Date.now());
        const openedExpiry = new Date(payload.openedExpiryAt);
        await updateDoc(ref, {
          isFrozen: false,
          productOpenedAt: Timestamp.fromDate(now),
          productOpenedExpiryAt: Timestamp.fromDate(openedExpiry),
          shelfLifeDays: payload.shelfLifeDays || 2,
          productFrozenExpiryAt: null,
          productUpdatedAt: serverTimestamp(),
        });
      } else {
        const originalDate = payload.originalExpiryDate
          ? Timestamp.fromDate(new Date(payload.originalExpiryDate))
          : null;
        await updateDoc(ref, {
          isFrozen: false,
          expiryDateProduct: originalDate,
          productFrozenAt: null,
          productFrozenExpiryAt: null,
          originalExpiryDateBeforeFreeze: null,
          productUpdatedAt: serverTimestamp(),
        });
      }
      break;
    }
  }
}

// Inizializza l'ascolto globale degli eventi di rete
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[SyncManager] Dispositivo tornato ONLINE: avvio sincronizzazione mutazioni...");
    syncOfflineMutations();
  });
}
