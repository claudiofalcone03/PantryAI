import type { Timestamp } from "firebase/firestore";

//Tipo Prodotto (lista della spesa)
export interface ShoppingListItem {
  id?: string;
  pantryId: string;
  name: string;
  productId?: string; // riferimento al prodotto nell'inventario, se esiste
  quantity: number;
  status: "open" | "reserved" | "purchased";
  requestedBy?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  syncToInventory?: boolean; // se true, al purchase sincronizzi inventory
}
