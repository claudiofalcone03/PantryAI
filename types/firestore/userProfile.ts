import type { Timestamp } from "firebase/firestore";

//Tipo profilo utente
export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
}
