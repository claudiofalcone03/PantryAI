import type { Timestamp } from "firebase/firestore";

import type { Product } from "./productType";
import type { Pantry } from "./pantryType";
import type { PantryMember } from "./pantryMemberType";

//Tipo Prodotto (lista della spesa)
export interface ShoppingListItem {
  listItemId: string;
  listItemPantryId: Pantry["pantryId"];
  listItemName: string | Product["productName"]; //nome del prodotto della lista della spesa, potrebbe essere diverso se il prodotto viene creato nella lista della spesa
  listItemProductId?: Product["productId"]; // riferimento al prodotto nell'inventario, se esiste
  listItemStatus: "toBuy" | "reserved" | "purchased"; //toBuy se sta nella lista, reserved se qualcuno ha premuto "lo compro io ", purchased se è stato acquistato e risulta spuntato
  listItemReservedBy?: PantryMember["memberName"]  //utente che ha premuto lo compro io
  listItemReservedAt?: Timestamp | null;
  listItemPurchasedBy?: PantryMember["memberName"] 
  listItemPurchasedAt?: Timestamp | null;
  listItemCreatedAt: Timestamp;
  listItemUpdatedAt?: Timestamp;
  //listItemSyncToInventory?: boolean; // se true, al purchase sincronizzi inventory
}
