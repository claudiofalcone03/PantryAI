import type { Timestamp } from "firebase/firestore";

//Tipo profilo utente
export interface UserProfile {
  userId: string;
  userEmail: string;
  userProfileName?: string; //nickname dell'utente, se vuole inserirlo
  userProfilePhotoURL?: string;
  userProfileCreatedAt?: Timestamp;
  userProfilePantryIds?: string[] | null; // Array di ID delle dispense a cui l'utente appartiene, se è vuoto vuol dire che devo ancora accedere ancora ad almeno una dispensa
  userProfileCurrentPantryId?: string | null;
}
