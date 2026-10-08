/**
 * PantryAI - Client-side IndexedDB Wrapper
 * Gestisce la persistenza offline dell'inventario, della lista spesa e della coda delle mutazioni.
 */

const DB_NAME = "PantryAIOfflineDB";
const DB_VERSION = 1;

export interface OfflineMutation {
  id?: number;
  type: "CONSUME_PRODUCT" | "OPEN_PRODUCT" | "UPDATE_PRODUCT_QTY" | "SET_SHOPPING_STATUS" | "ADD_SHOPPING_ITEM" | "DELETE_PRODUCT" | "FREEZE_PRODUCT" | "UNFREEZE_PRODUCT";
  pantryId: string;
  docId?: string;
  payload: any;
  createdAt: number;
  attempts?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB non disponibile in questo ambiente."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;

      // Store prodotti in cache
      if (!db.objectStoreNames.contains("cachedProducts")) {
        const productStore = db.createObjectStore("cachedProducts", { keyPath: "productId" });
        productStore.createIndex("productPantryId", "productPantryId", { unique: false });
      }

      // Store lista spesa in cache
      if (!db.objectStoreNames.contains("cachedShoppingItems")) {
        const shoppingStore = db.createObjectStore("cachedShoppingItems", { keyPath: "listItemId" });
        shoppingStore.createIndex("listItemPantryId", "listItemPantryId", { unique: false });
      }

      // Coda mutazioni offline
      if (!db.objectStoreNames.contains("mutationsQueue")) {
        db.createObjectStore("mutationsQueue", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===============================================================
// CACHE PRODOTTI
// ===============================================================

export async function saveCachedProducts(pantryId: string, products: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cachedProducts", "readwrite");
    const store = tx.objectStore("cachedProducts");

    for (const prod of products) {
      if (prod.productId) {
        store.put({ ...prod, productPantryId: pantryId, _cachedAt: Date.now() });
      }
    }
  } catch (err) {
    console.warn("[IndexedDB] Errore salvataggio prodotti in cache:", err);
  }
}

export async function getCachedProducts(pantryId: string): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("cachedProducts", "readonly");
    const store = tx.objectStore("cachedProducts");
    const index = store.index("productPantryId");

    return new Promise((resolve) => {
      const req = index.getAll(pantryId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[IndexedDB] Errore lettura prodotti da cache:", err);
    return [];
  }
}

// ===============================================================
// CACHE LISTA DELLA SPESA
// ===============================================================

export async function saveCachedShoppingItems(pantryId: string, items: any[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("cachedShoppingItems", "readwrite");
    const store = tx.objectStore("cachedShoppingItems");

    for (const it of items) {
      if (it.listItemId) {
        store.put({ ...it, listItemPantryId: pantryId, _cachedAt: Date.now() });
      }
    }
  } catch (err) {
    console.warn("[IndexedDB] Errore salvataggio lista spesa in cache:", err);
  }
}

export async function getCachedShoppingItems(pantryId: string): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("cachedShoppingItems", "readonly");
    const store = tx.objectStore("cachedShoppingItems");
    const index = store.index("listItemPantryId");

    return new Promise((resolve) => {
      const req = index.getAll(pantryId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[IndexedDB] Errore lettura lista spesa da cache:", err);
    return [];
  }
}

// ===============================================================
// CODA MUTAZIONI OFFLINE
// ===============================================================

export async function enqueueOfflineMutation(mutation: Omit<OfflineMutation, "id">): Promise<number> {
  const db = await openDB();
  const tx = db.transaction("mutationsQueue", "readwrite");
  const store = tx.objectStore("mutationsQueue");

  return new Promise((resolve, reject) => {
    const req = store.add(mutation);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction("mutationsQueue", "readonly");
    const store = tx.objectStore("mutationsQueue");

    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removePendingMutation(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("mutationsQueue", "readwrite");
    const store = tx.objectStore("mutationsQueue");
    store.delete(id);
  } catch (err) {
    console.warn("[IndexedDB] Errore rimozione mutazione:", err);
  }
}

export async function clearAllPendingMutations(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction("mutationsQueue", "readwrite");
    const store = tx.objectStore("mutationsQueue");
    store.clear();
  } catch (err) {
    console.warn("[IndexedDB] Errore pulizia coda mutazioni:", err);
  }
}
