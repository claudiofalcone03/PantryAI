import type { Timestamp } from "firebase/firestore";
import type { Pantry } from "./pantryType";
import type { ShoppingListItem } from "./shoppingListItemType";

//Tipo Prodotto (inventario)
export interface Product {
  productId?: string; //id del prodotto, se esiste già nell'inventario
  productName: string; // nome del prodotto
  productCategory?: string;
  //categoryProduct?: Pantry["pantryCategories"]// categoria del prodotto, lo devo prendere da quelle già presenti nella dispensa ?
  productQuantity: number;
  productUnitOfMeasure?: string;
  expiryDateProduct?: Timestamp | null;   //data scadenza prodotto riportata sulla confezione
  productBarcode?: string | null;
  productOpenedAt?: Timestamp | null;      //data apertura prodotto fresco
  productOpenedExpiryAt?: Timestamp | null; //si potrebbe calcolare lato app, ma se voglio filtrare velocemente conviene salcvare questa info
  addToShoppingList: boolean; //lo mantengo per avere un caricamento veloce per la UI nella dispensa
  shelfLifeDays?: number | null; //durata in giorni del prodotto fresco, per calcolare productOpenedExpiryAt
  isFrozen?: boolean | null; // true se l'alimento è attualmente congelato nel freezer
  productFrozenAt?: Timestamp | null; // data in cui è stato congelato
  productFrozenExpiryAt?: Timestamp | null; // data di scadenza calcolata per la conservazione nel freezer
  originalExpiryDateBeforeFreeze?: Timestamp | null; // data originale salvata prima del congelamento
  frozenMonthsDuration?: number | null; // durata stimata in mesi di conservazione nel freezer (default 3)
  productCreatedAt: Timestamp;
  productUpdatedAt?: Timestamp;
  productPantryId: Pantry["pantryId"]; //id della dispensa a cui il prodotto appartiene
  productShoppingListItemId?: ShoppingListItem["listItemId"] | null; //per collegare il prodotto alla lista della spesa, se è stato creato dalla lista della spsesa
  carbonFootprint?: number | null; // valore dato da product_quantity * ecoscore_data:agribalyse:co2_total
}
