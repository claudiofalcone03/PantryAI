import type { Timestamp } from "firebase/firestore";

import type { PantryMember } from "./pantryMember";

//Tipo dispensa
export interface Pantry {
  pantryId?: string;
  namePantry: string;
  ownerPantryId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  pantryMembers?: PantryMember[];
  inviteCode?: string;
  //categories 
}
