import type { Timestamp } from "firebase/firestore";

import type { UserProfile } from "./userProfile";

//Tipo Membro della dispensa
export interface PantryMember {
  memberId: UserProfile["userId"]; //ID firebase del membro
  memberRole: "owner" | "editor" ;
  memberJoinedAtPantry: Timestamp;
  memberName?: UserProfile["userProfileName"]
}
