import { db } from "../firebase";
import { collection, doc, setDoc, query, where, getDocs, arrayUnion, serverTimestamp, Timestamp } from "firebase/firestore";
import type { PantryMember } from "../../types/firestore/pantryMember";

//Funzione genera codice invito, un codice alfanumerico di 6 caratteri in maiuscolo
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

//Creazione nuova dispensa
export async function createPantry(userId: string, pantryName: string, userProfileName?: string) {
  const pantryRef = doc(collection(db, "pantries"));
  const inviteCode = generateInviteCode();

  const newPantry = {
    pantryId: pantryRef.id,
    pantryName,
    pantryOwnerId: userId,
    pantryCreatedAt: serverTimestamp(),
    pantryInviteCode: inviteCode,
    pantryMembers: [{
      memberId: userId,
      memberRole: "owner",
      memberJoinedAtPantry: Timestamp.now(),
      memberName: userProfileName || null
    }]
  };

  await setDoc(pantryRef, newPantry); //Salvataggio documento nel firestore

  const userRef = doc(db, "users", userId);
  //Aggiunta dispensa all'utente
  await setDoc(userRef, {
    userProfilePantryIds: arrayUnion(pantryRef.id),
    userProfileCurrentPantryId: pantryRef.id //Dispensa corrente
  }, { merge: true });

  return pantryRef.id;
}

//Accesso a una dispensa tramite codice 
export async function joinPantryWithCode(userId: string, inviteCode: string, userProfileName?: string) {
  const pantriesRef = collection(db, "pantries");
  const q = query(pantriesRef, where("pantryInviteCode", "==", inviteCode));
  const querySnapshot = await getDocs(q); //Quanti documenti corrispondono al codice

  if (querySnapshot.empty) {
    throw new Error("Codice dispensa non valido o inesistente.");
  }

  const pantryDoc = querySnapshot.docs[0]; //Prendo il primo documento trovato, in teoria dovrebbe essere unico

  const pantryData = pantryDoc.data() as { pantryMembers?: PantryMember[] };

  //Blocco limite 10 utenti per dispensa
  if (pantryData.pantryMembers && pantryData.pantryMembers.length >= 10) {
    throw new Error("La dispensa ha già raggiunto il limite massimo di 10 membri.");
  }

  //Controllo se l'utente è già membro della dispensa
  const isAlreadyMember = pantryData.pantryMembers?.some((m: PantryMember) => m.memberId === userId);
  if (isAlreadyMember) {
    throw new Error("Sei già membro di questa dispensa.");
  }

  const newMember = {
    memberId: userId,
    memberRole: "editor",
    memberJoinedAtPantry: Timestamp.now(),
    memberName: userProfileName || null
  };

  await setDoc(pantryDoc.ref, {
    pantryMembers: arrayUnion(newMember)
  }, { merge: true });

  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    userProfilePantryIds: arrayUnion(pantryDoc.id),
    userProfileCurrentPantryId: pantryDoc.id
  }, { merge: true });

  return pantryDoc.id;
}
