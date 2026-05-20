import type { Timestamp } from "firebase/firestore";

//Tipo profilo utente
export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
}

//Tipo dispensa
export interface Pantry {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isShared: boolean;
  inviteCode?: string;
  description?: string;
}

//Tipo Membro della dispensa
export interface PantryMember {
  uid: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: Timestamp;
}

//Tipo Prodotto (inventario)
export interface Product {
  id?: string;
  name: string;
  category?: string; //oppure enum ?
  quantity: number;
  unitOfMeasure?: string;
  expiryDate?: Timestamp | null;
  barcode?: string | null;
  openedAt?: Timestamp | null;
  openedExpiryAt?: Timestamp | null; //si potrebbe calcolare lato app, ma se voglio filtrare velocemente conviene salcvare questa info
  addToShoppingList: boolean;
  shelfLifeDays?: number | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  pantryId?: string; // utile se usi collection centrale; opzionale per subcollection
}

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