import type { Timestamp } from "firebase/firestore";

import type { Product } from "./product";
import type { Pantry } from "./pantry";

//Tipo Prodotto (lista della spesa)
export interface shoppingListItem {
  listItemId: string;
  pantryId: Pantry["pantryId"];
  nameListItem: string; //nome del prodotto della lista della spesa, potrebbe essere diverso se il prodotto viene creato nella lista della spesa
  productId?: Product["productId"]; // riferimento al prodotto nell'inventario, se esiste
  status: "open" | "reserved" | "purchased"; //open se sta, reserved se qualcuno l'ha riservato, purchased se è stato acquistato
  listItemReservedBy?: string | null; //utente che ha premuto lo compro io
  listItemReservedAt?: Timestamp | null;
  listItemPurchasedBy?: string | null;
  listItemPurchasedAt?: Timestamp | null;
  listItemCreatedAt: Timestamp;
  listItemUpdatedAt?: Timestamp;
  syncToInventory?: boolean; // se true, al purchase sincronizzi inventory
}
