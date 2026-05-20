import type { Timestamp } from "firebase/firestore";

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
