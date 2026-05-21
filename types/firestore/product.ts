import type { Timestamp } from "firebase/firestore";
import type { Pantry } from "./pantry";
import type { shoppingListItem } from "./shoppingListItem";

//Tipo Prodotto (inventario)
export interface Product {
  productId?: string; //id del prodotto, se esiste già nell'inventario
  nameProduct: string; // nome del prodotto
  categoryProduct?: string;  // categoria del prodotto, lo devo prendere da quelle già presenti nella dispensa ?
  quantityProduct: number;
  unitOfMeasure?: string;
  expiryDateProduct?: Timestamp | null;   //data scadenza prodotto riportata sulla confezione
  barcodeProduct?: string | null;
  openedAt?: Timestamp | null;      //data apertura prodotto fresco
  openedExpiryAt?: Timestamp | null; //si potrebbe calcolare lato app, ma se voglio filtrare velocemente conviene salcvare questa info
  //addToShoppingList: boolean; //lo mantengo per avere un caricamento veloce per la UI nella dispensa
  shelfLifeDays?: number | null; //durata in giorni del prodotto fresco, per calcolare openedExpiryAt
  productCreatedAt: Timestamp;
  productUpdatedAt?: Timestamp;
  pantryId: Pantry["pantryId"]; //id della dispensa a cui il prodotto appartiene
  shoppingListItemId?: shoppingListItem["listItemId"] | null; //per collegare il prodotto alla lista della spesa, se è stato creato da lì
}
