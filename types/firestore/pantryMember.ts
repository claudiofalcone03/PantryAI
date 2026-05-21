import type { Timestamp } from "firebase/firestore";

//Tipo Membro della dispensa
export interface PantryMember {
  userId: string; //ID firebase del membro
  role: "owner" | "editor" ;
  joinedAt: Timestamp;
}
