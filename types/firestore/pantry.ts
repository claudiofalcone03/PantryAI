import type { Timestamp } from "firebase/firestore";

import type { PantryMember } from "./pantryMember";

//Tipo dispensa
export interface Pantry {
  id?: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  pantryMembers?: PantryMember[];
  inviteCode?: string;
}
