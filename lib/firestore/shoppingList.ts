import { db } from "../firebase";
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
import type { ShoppingListItem } from "../../types/firestore/shoppingListItem";
import type { Product } from "../../types/firestore/product";

//Aggiunge un prodotto esistente dell'inventario alla lista della spesa
export async function addProductToShoppingList(
  product: Product
): Promise<string> {
  if (!product.productId) {
    throw new Error("Il prodotto deve avere un ID per essere aggiunto alla lista della spesa.");
  }
  const batch = writeBatch(db);

  //Creazione del nuovo elemento nella lista della spesa
  const shoppingListRef = doc(collection(db, "shoppingListItems"));

  const newListItem: ShoppingListItem = {
    listItemId: shoppingListRef.id,
    listItemPantryId: product.productPantryId,
    listItemName: product.productName,
    listItemProductId: product.productId,
    listItemStatus: "toBuy",
    listItemCreatedAt: serverTimestamp() as Timestamp,
  };

  batch.set(shoppingListRef, newListItem);

  //Aggiornamento del prodotto nell'inventario
  const productRef = doc(db, "products", product.productId);
  batch.update(productRef, {
    addToShoppingList: true,
    productShoppingListItemId: shoppingListRef.id,
    productUpdatedAt: serverTimestamp(),
  });

  await batch.commit();

  return shoppingListRef.id;
}

//Rimuove un prodotto dell'inventario dalla lista della spesa
export async function removeProductFromShoppingList(
  product: Product
): Promise<void> {
  if (!product.productId) {
    throw new Error("Il prodotto deve avere un ID.");
  }
  if (!product.productShoppingListItemId) {
    throw new Error("Il prodotto non è associato a nessun elemento della lista della spesa.");
  }

  const batch = writeBatch(db);

  //Eliminazione dell'elemento dalla lista della spesa
  const shoppingListRef = doc(db, "shoppingListItems", product.productShoppingListItemId);
  batch.delete(shoppingListRef);

  //Aggiornamento del prodotto nell'inventario
  const productRef = doc(db, "products", product.productId);
  batch.update(productRef, {
    addToShoppingList: false,
    productShoppingListItemId: null,
    productUpdatedAt: serverTimestamp(),
  });

  await batch.commit();
}


//Funzione per aggiungere il prodotto direttamente alla lista della spesa
//Deve richiamare un componente
