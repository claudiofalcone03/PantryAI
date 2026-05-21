import type { Timestamp } from "firebase/firestore";

import type {userProfile} from "./userProfile";

//Tipo Membro della dispensa
export interface PantryMember {
  memberId: userProfile["userId"]; //ID firebase del membro
  memberRole: "owner" | "editor" ;
  memberJoinedAtPantry: Timestamp;
}
