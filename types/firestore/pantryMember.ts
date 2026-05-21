import type { Timestamp } from "firebase/firestore";

import type {userProfile} from "./userProfile";

//Tipo Membro della dispensa
export interface PantryMember {
  userId: userProfile["userId"]; //ID firebase del membro
  roleUserPantry: "owner" | "editor" ;
  joinedAtPantry: Timestamp;
}
