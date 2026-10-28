import { db } from "../firebase";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import type { ShoppingListItem } from "../../types/firestore/shoppingListItemType";
import type { Product } from "../../types/firestore/productType";
import { getProductsByPantry } from "./products";
import { findPantryMatch } from "../utils/ingredientMatcher";
import { getFoodIcon } from "../utils/foodIcons";

// Helper per notificare i componenti dell'aggiornamento
function dispatchShoppingListEvents(includeInventory = false) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("shopping-list-updated"));
    if (includeInventory) {
      window.dispatchEvent(new CustomEvent("inventory-updated"));
    }
  }
}

// Aggiunge un prodotto esistente dell'inventario alla lista della spesa, evitando duplicati
export async function addProductToShoppingList(
  product: Product
): Promise<string> {
  if (!product.productId) {
    throw new Error("Il prodotto deve avere un ID per essere aggiunto alla lista della spesa.");
  }

  // Verifica se esiste già un elemento nella lista della spesa per questo prodotto
  let existingItemId: string | null = null;
  const duplicateItemIds: string[] = [];

  try {
    const q = query(
      collection(db, "shoppingListItems"),
      where("listItemProductId", "==", product.productId)
    );
    const snapshot = await getDocs(q);
    snapshot.forEach((itemDoc) => {
      if (!existingItemId) {
        existingItemId = itemDoc.id;
      } else {
        duplicateItemIds.push(itemDoc.id);
      }
    });
  } catch (error) {
    console.warn("Impossibile verificare elementi duplicati nella lista della spesa:", error);
  }

  const batch = writeBatch(db);
  let targetItemId: string;

  if (existingItemId) {
    targetItemId = existingItemId;
    const shoppingListRef = doc(db, "shoppingListItems", existingItemId);
    batch.update(shoppingListRef, {
      listItemName: product.productName,
      listItemPantryId: product.productPantryId,
      listItemStatus: "toBuy",
      listItemUpdatedAt: serverTimestamp(),
    });

    // Rimuove eventuali duplicati rimasti orfani
    for (const dupId of duplicateItemIds) {
      batch.delete(doc(db, "shoppingListItems", dupId));
    }
  } else {
    const shoppingListRef = doc(collection(db, "shoppingListItems"));
    targetItemId = shoppingListRef.id;

    const newListItem: ShoppingListItem = {
      listItemId: shoppingListRef.id,
      listItemPantryId: product.productPantryId,
      listItemName: product.productName,
      listItemProductId: product.productId,
      listItemStatus: "toBuy",
      listItemCreatedAt: serverTimestamp() as Timestamp,
    };

    batch.set(shoppingListRef, newListItem);
  }

  // Aggiornamento del prodotto nell'inventario
  const productRef = doc(db, "products", product.productId);
  batch.update(productRef, {
    addToShoppingList: true,
    productShoppingListItemId: targetItemId,
    productUpdatedAt: serverTimestamp(),
  });

  await batch.commit();
  dispatchShoppingListEvents(true);

  return targetItemId;
}

// Rimuove un prodotto dell'inventario dalla lista della spesa in modo fail-safe
export async function removeProductFromShoppingList(
  product: Product
): Promise<void> {
  if (!product.productId) {
    throw new Error("Il prodotto deve avere un ID.");
  }

  const batch = writeBatch(db);
  const deletedItemIds = new Set<string>();

  // 1. Se il prodotto ha un ID associato, aggiungilo al batch di cancellazione
  if (product.productShoppingListItemId) {
    deletedItemIds.add(product.productShoppingListItemId);
    batch.delete(doc(db, "shoppingListItems", product.productShoppingListItemId));
  }

  // 2. Cerca per sicurezza qualsiasi elemento in shoppingListItems collegato a questo productId
  try {
    const q = query(
      collection(db, "shoppingListItems"),
      where("listItemProductId", "==", product.productId)
    );
    const snapshot = await getDocs(q);
    snapshot.forEach((itemDoc) => {
      if (!deletedItemIds.has(itemDoc.id)) {
        deletedItemIds.add(itemDoc.id);
        batch.delete(itemDoc.ref);
      }
    });
  } catch (error) {
    console.warn("Impossibile recuperare elementi orfani della lista della spesa:", error);
  }

  // 3. Reset sicuro e garantito dello stato del prodotto nell'inventario
  const productRef = doc(db, "products", product.productId);
  batch.update(productRef, {
    addToShoppingList: false,
    productShoppingListItemId: null,
    productUpdatedAt: serverTimestamp(),
  });

  await batch.commit();
  dispatchShoppingListEvents(true);
}

// Elimina un elemento dalla lista della spesa SENZA eliminare il prodotto in dispensa.
// Se il prodotto esiste in dispensa, disattiva il carrello (addToShoppingList: false).
export async function deleteShoppingListItem(
  listItemId: string,
  productId?: string | null,
  pantryId?: string | null
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "shoppingListItems", listItemId));

  let targetProductId = productId;
  let targetPantryId = pantryId;
  let didUpdateInventory = false;

  // Se l'ID prodotto o della dispensa non è passato esplicitamente, controlliamo il documento della lista
  if (!targetProductId || !targetPantryId) {
    try {
      const itemSnap = await getDoc(doc(db, "shoppingListItems", listItemId));
      if (itemSnap.exists()) {
        const itemData = itemSnap.data();
        if (!targetProductId) targetProductId = itemData?.listItemProductId;
        if (!targetPantryId) targetPantryId = itemData?.listItemPantryId;
      }
    } catch (e) {
      console.warn("Impossibile recuperare dettagli elemento lista spesa:", e);
    }
  }

  // 1. Aggiorna il prodotto principale associato
  if (targetProductId) {
    const productRef = doc(db, "products", targetProductId);
    batch.update(productRef, {
      addToShoppingList: false,
      productShoppingListItemId: null,
      productUpdatedAt: serverTimestamp(),
    });
    didUpdateInventory = true;
  }

  // 2. Controllo prodotti correlati nella STESSA dispensa (rispetta rigidamente le regole di sicurezza Firestore)
  if (targetPantryId) {
    try {
      const q = query(
        collection(db, "products"),
        where("productPantryId", "==", targetPantryId),
        where("productShoppingListItemId", "==", listItemId)
      );
      const snap = await getDocs(q);
      snap.forEach((pDoc) => {
        if (pDoc.id !== targetProductId) {
          batch.update(pDoc.ref, {
            addToShoppingList: false,
            productShoppingListItemId: null,
            productUpdatedAt: serverTimestamp(),
          });
          didUpdateInventory = true;
        }
      });
    } catch (err) {
      console.warn("Controllo prodotti referenziati con targetPantryId:", err);
    }
  }

  await batch.commit();
  dispatchShoppingListEvents(didUpdateInventory);
}

// Recupera tutti gli elementi della lista della spesa per una specifica dispensa
export async function getShoppingListItemsByPantry(pantryId: string): Promise<ShoppingListItem[]> {
  const q = query(
    collection(db, "shoppingListItems"),
    where("listItemPantryId", "==", pantryId)
  );

  const querySnapshot = await getDocs(q);
  const items: ShoppingListItem[] = [];

  querySnapshot.forEach((doc) => {
    items.push({ listItemId: doc.id, ...doc.data() } as ShoppingListItem);
  });

  return items;
}

// Aggiorna lo stato di un elemento nella lista della spesa
export async function updateShoppingListItemStatus(
  listItemId: string,
  newStatus: ShoppingListItem["listItemStatus"],
  memberName?: string
): Promise<void> {
  const itemRef = doc(db, "shoppingListItems", listItemId);
  const updateData: Record<string, unknown> = {
    listItemStatus: newStatus,
    listItemUpdatedAt: serverTimestamp(),
  };

  if (newStatus === "reserved" && memberName) {
    updateData.listItemReservedBy = memberName;
    updateData.listItemReservedAt = serverTimestamp();
  } else if (newStatus === "purchased" && memberName) {
    updateData.listItemPurchasedBy = memberName;
    updateData.listItemPurchasedAt = serverTimestamp();
  }

  await updateDoc(itemRef, updateData);
  dispatchShoppingListEvents(false);
}

// Helper per determinare la categoria di un alimento se non specificata
function guessFoodCategory(itemName: string): string {
  const name = itemName.toLowerCase();

  if (/latte|yogurt|panna|burro|formaggio|parmigiano|mozzarella|ricotta|stracchino|gorgonzola|caciotta|uov[ao]/i.test(name)) return "Latticini";
  if (/carne|manzo|pollo|maiale|tacchino|vitello|salsiccia|prosciutto|salame|bacon|pancetta|bistecca|hamburger|macinato/i.test(name)) return "Carne";
  if (/pesce|tonno|salmone|merluzzo|orata|spigola|gamber[io]|calamar[io]|polp[io]|alici|sarde|cozze|vongole/i.test(name)) return "Pesce";
  if (/mela|mele|pera|pere|banana|banane|arancia|arance|limon[ei]|fragol[ae]|uva|pesc[ae]|albicocc[ae]|ciliegie|kiwi|ananas|mango|avocado/i.test(name)) return "Frutta";
  if (/insalata|pomodor[io]|zucchin[ae]|carot[ae]|patat[ae]|cipoll[ae]|peperon[ei]|melanzan[ae]|spinac[io]|fungh[io]|pisell[io]|fagiol[io]|broccoli/i.test(name)) return "Verdura";
  if (/acqua|succo|vino|birra|cola|aranciata|tè|the|caffè|tisana|bevanda/i.test(name)) return "Bevande";
  if (/pasta|spaghetti|penne|rigatoni|fusilli|riso|farina|pane|gnocchi/i.test(name)) return "Pasta";
  if (/biscott[io]|cioccolat[ao]|torta|dolc[ei]|crostat[ae]|marmellata|miele|nutella|brioche/i.test(name)) return "Dolci";
  if (/patatine|cracker|taralli|snack|popcorn|arachidi/i.test(name)) return "Snack";

  return "Altro";
}

// Aggiunge un alimento alla lista della spesa mantenendo la correlazione stretta con la dispensa
// Se l'alimento esiste già in dispensa, collega quello esistente e attiva il carrello.
// Se non esiste, crea la nuova scheda prodotto in dispensa a quantità 0 con il carrello attivo.
export async function addRawItemToShoppingList(
  pantryId: string,
  itemName: string,
  options?: {
    category?: string;
    unit?: string;
  }
): Promise<string> {
  const cleanName = itemName.trim();
  if (!cleanName) {
    throw new Error("Il nome dell'alimento non può essere vuoto.");
  }

  // 1. Recupera i prodotti attuali della dispensa per verificare se l'alimento esiste già
  let existingProducts: Product[] = [];
  try {
    existingProducts = await getProductsByPantry(pantryId);
  } catch (err) {
    console.warn("Impossibile recuperare i prodotti per il matching:", err);
  }

  // 2. Controllo matching semantico (singolare/plurale, sinonimi)
  const match = findPantryMatch(cleanName, existingProducts);
  if (match.matched && match.matchedProduct && match.matchedProduct.productId) {
    // Il prodotto esiste già in dispensa: lo colleghiamo e accendiamo il carrello
    return await addProductToShoppingList(match.matchedProduct);
  }

  // 3. Il prodotto non esiste ancora in dispensa: creiamo sia la scheda a quantità 0 che l'elemento nella spesa
  const category = options?.category || guessFoodCategory(cleanName);
  const unit = options?.unit || "pz";
  const icon = getFoodIcon(cleanName, category);

  const batch = writeBatch(db);
  const productRef = doc(collection(db, "products"));
  const shoppingListRef = doc(collection(db, "shoppingListItems"));

  const newProduct: Product = {
    productId: productRef.id,
    productName: cleanName,
    productQuantity: 0,
    productUnitOfMeasure: unit,
    productCategory: category,
    productIcon: icon,
    addToShoppingList: true,
    productShoppingListItemId: shoppingListRef.id,
    productPantryId: pantryId,
    productCreatedAt: serverTimestamp() as Timestamp,
    productUpdatedAt: serverTimestamp() as Timestamp,
  };

  const newListItem: ShoppingListItem = {
    listItemId: shoppingListRef.id,
    listItemPantryId: pantryId,
    listItemName: cleanName,
    listItemProductId: productRef.id,
    listItemStatus: "toBuy",
    listItemCreatedAt: serverTimestamp() as Timestamp,
  };

  batch.set(productRef, newProduct);
  batch.set(shoppingListRef, newListItem);

  await batch.commit();
  dispatchShoppingListEvents(true);

  return shoppingListRef.id;
}

/**
 * Elimina tutti gli elementi acquistati (purchased) dalla lista della spesa per una dispensa
 */
export async function deleteCompletedShoppingListItems(pantryId: string): Promise<number> {
  if (!pantryId) return 0;
  try {
    const q = query(
      collection(db, "shoppingListItems"),
      where("listItemPantryId", "==", pantryId),
      where("listItemStatus", "==", "purchased")
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    snap.docs.forEach((itemDoc) => {
      const data = itemDoc.data() as ShoppingListItem;
      batch.delete(itemDoc.ref);
      if (data.listItemProductId) {
        batch.update(doc(db, "products", data.listItemProductId), {
          addToShoppingList: false,
          productShoppingListItemId: null,
          productUpdatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    dispatchShoppingListEvents(true);
    return snap.size;
  } catch (err) {
    console.error("Errore eliminazione elementi acquistati:", err);
    throw err;
  }
}

/**
 * Svuota completamente la lista della spesa per una dispensa
 */
export async function clearAllShoppingListItems(pantryId: string): Promise<number> {
  if (!pantryId) return 0;
  try {
    const q = query(
      collection(db, "shoppingListItems"),
      where("listItemPantryId", "==", pantryId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const batch = writeBatch(db);
    snap.docs.forEach((itemDoc) => {
      const data = itemDoc.data() as ShoppingListItem;
      batch.delete(itemDoc.ref);
      if (data.listItemProductId) {
        batch.update(doc(db, "products", data.listItemProductId), {
          addToShoppingList: false,
          productShoppingListItemId: null,
          productUpdatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    dispatchShoppingListEvents(true);
    return snap.size;
  } catch (err) {
    console.error("Errore svuotamento totale lista della spesa:", err);
    throw err;
  }
}



