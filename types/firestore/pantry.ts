import type { Timestamp } from "firebase/firestore";

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
