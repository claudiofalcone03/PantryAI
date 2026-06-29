import type { Timestamp } from "firebase/firestore";
import type { Product } from "./productType";
import type { Pantry } from "./pantryType";

export interface ProductHistoryLog {
  logId?: string;

  productId: Product["productId"];
  productName: Product["productName"];
  productCategory?: Product["productCategory"];
  carbonFootprint?: Product["carbonFootprint"];
  quantityHistory: number;
  pantryId: Pantry["pantryId"];
  resolvedAt: Timestamp;
  resolution: 'consumed' | 'rescued' | 'wasted';
}
