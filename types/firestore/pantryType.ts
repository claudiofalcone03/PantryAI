import type { Timestamp } from "firebase/firestore";

import type { PantryMember } from "./pantryMemberType";

//Tipo dispensa
export interface Pantry {
  pantryId?: string;
  pantryName: string;
  pantryOwnerId: string;
  pantryCreatedAt: Timestamp;
  pantryUpdatedAt?: Timestamp;
  pantryMembers?: PantryMember[];
  pantryInviteCode?: string;
  pantryCategories?: string[]; //categorie nella dispensa
}

export const DEFAULT_PANTRY_CATEGORIES = [
  "Latticini", "Carne", "Pesce", "Frutta", "Verdura", "Bevande", "Dolci", "Snack", "Pasta", "Surgelati",
  "Altro"
];
