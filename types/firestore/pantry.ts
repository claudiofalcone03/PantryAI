import type { Timestamp } from "firebase/firestore";

import type { PantryMember } from "./pantryMember";

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
