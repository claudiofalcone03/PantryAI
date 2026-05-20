import type { Timestamp } from "firebase/firestore";

//Tipo Membro della dispensa
export interface PantryMember {
  uid: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: Timestamp;
}
