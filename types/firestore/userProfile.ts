import type { Timestamp } from "firebase/firestore";

//Tipo profilo utente
export interface userProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  pantryIds: string[]; // Array di ID delle dispense a cui l'utente appartiene, se è vuoto vuol dire che devo ancora accedere ancora ad almeno una dispensa
  currentPantryId: string;
}
