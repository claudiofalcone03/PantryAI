import { db } from "../firebase";
import { collection, doc, setDoc, query, where, getDocs, arrayUnion, serverTimestamp, Timestamp, getDoc, arrayRemove, writeBatch } from "firebase/firestore";
import { type Pantry, DEFAULT_PANTRY_CATEGORIES } from "../../types/firestore/pantryType";
import type { PantryMember } from "../../types/firestore/pantryMemberType";

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
    pantryCategories: DEFAULT_PANTRY_CATEGORIES,
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

//Recupero delle dispense di cui l'utente fa parte
export async function getUserPantries(userId: string): Promise<Pantry[]> {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return []; //Se il documento dell'utente non esiste restituisce array vuoto

  const pantryIds = userSnap.data().userProfilePantryIds || [];
  if (pantryIds.length === 0) return []; //Se l'utente non ha dispense, restituisce array vuoto

  const pantries: Pantry[] = [];

  // Recupero i dettagli di ciascuna dispensa
  for (const pId of pantryIds) {
    const pantryRef = doc(db, "pantries", pId);
    const pantrySnap = await getDoc(pantryRef);
    if (pantrySnap.exists()) {
      pantries.push({ ...pantrySnap.data(), pantryId: pantrySnap.id } as Pantry);
    }
  }

  return pantries;
}

//Abbandono di una dispensa
export async function leavePantry(userId: string, pantryId: string) {
  const pantryRef = doc(db, "pantries", pantryId);
  const userRef = doc(db, "users", userId);

  const pantrySnap = await getDoc(pantryRef);
  if (!pantrySnap.exists()) throw new Error("Dispensa non trovata");

  const pantryData = pantrySnap.data() as Pantry;
  const members = pantryData.pantryMembers || [];

  const memberObj = members.find(m => m.memberId === userId); //L'utente che vuole uscire
  if (!memberObj) throw new Error("Non sei membro di questa dispensa");

  if (memberObj.memberRole === "owner" && members.length === 1) {
    // Se è l'unico membro e proprietario elimino la dispensa ?. Assicurati che sta un messaggio di conferma prima di eliminare
    // Messaggio modificato se l'utente è l'unico proprietario e membro della dispensa ?
  }

  const batch = writeBatch(db);  //Il batch permette di raggruppare più operazioni 

  // Rimozione utente dalla dispensa
  batch.update(pantryRef, {
    pantryMembers: arrayRemove(memberObj)
  });

  // Rimozione della dispensa dall'utente
  const userSnap = await getDoc(userRef);
  let newCurrentPantryId = null;
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.userProfileCurrentPantryId === pantryId) {
      // Se era la dispensa corrente, ne impostiamo un'altra, se presente, altrimenti null
      const remainingPantries = (userData.userProfilePantryIds || []).filter((id: string) => id !== pantryId);
      newCurrentPantryId = remainingPantries.length > 0 ? remainingPantries[0] : null;
      batch.update(userRef, {
        userProfilePantryIds: arrayRemove(pantryId),
        userProfileCurrentPantryId: newCurrentPantryId
      });
    } else {
      batch.update(userRef, {
        userProfilePantryIds: arrayRemove(pantryId)
      });
    }
  }

  await batch.commit(); //Salvataggio delle modifiche in batch
}

//Imposta la dispensa corrente
export async function setCurrentPantry(userId: string, pantryId: string) {
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    userProfileCurrentPantryId: pantryId
  }, { merge: true });
}

//Aggiorna il nome della dispensa
export async function updatePantryName(pantryId: string, newName: string) {
  const pantryRef = doc(db, "pantries", pantryId);
  await setDoc(pantryRef, { pantryName: newName, pantryUpdatedAt: serverTimestamp() }, { merge: true });
}

//Aggiorna le categorie della dispensa
export async function updatePantryCategories(pantryId: string, newCategories: string[]) {
  const pantryRef = doc(db, "pantries", pantryId);
  await setDoc(pantryRef, { pantryCategories: newCategories, pantryUpdatedAt: serverTimestamp() }, { merge: true });
}

//Rimuove un membro specifico (solo owner può chiamarla, l'autorizzazione la gestiamo nella UI/Firestore rules)
export async function removeMemberFromPantry(pantryId: string, memberToRemoveId: string) {
  const pantryRef = doc(db, "pantries", pantryId);
  const pantrySnap = await getDoc(pantryRef);
  if (!pantrySnap.exists()) throw new Error("Dispensa non trovata");

  const pantryData = pantrySnap.data() as Pantry;
  const members = pantryData.pantryMembers || [];
  
  const memberObj = members.find(m => m.memberId === memberToRemoveId);
  if (!memberObj) throw new Error("Utente non trovato nella dispensa");

  if (memberObj.memberRole === "owner") {
    throw new Error("Impossibile rimuovere l'owner. L'owner deve prima cedere il ruolo o eliminare la dispensa.");
  }

  const batch = writeBatch(db);
  batch.update(pantryRef, {
    pantryMembers: arrayRemove(memberObj),
    pantryUpdatedAt: serverTimestamp()
  });

  const userRef = doc(db, "users", memberToRemoveId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    let newCurrentPantryId = userData.userProfileCurrentPantryId;
    if (newCurrentPantryId === pantryId) {
      const remainingPantries = (userData.userProfilePantryIds || []).filter((id: string) => id !== pantryId);
      newCurrentPantryId = remainingPantries.length > 0 ? remainingPantries[0] : null;
    }
    batch.update(userRef, {
      userProfilePantryIds: arrayRemove(pantryId),
      userProfileCurrentPantryId: newCurrentPantryId
    });
  }

  await batch.commit();
}

//Aggiorna il ruolo di un membro (da owner a editor o viceversa)
export async function updateMemberRoleInPantry(pantryId: string, memberIdToUpdate: string, newRole: "owner" | "editor") {
  const pantryRef = doc(db, "pantries", pantryId);
  const pantrySnap = await getDoc(pantryRef);
  if (!pantrySnap.exists()) throw new Error("Dispensa non trovata");

  const pantryData = pantrySnap.data() as Pantry;
  const members = pantryData.pantryMembers || [];
  
  const memberObj = members.find(m => m.memberId === memberIdToUpdate);
  if (!memberObj) throw new Error("Utente non trovato nella dispensa");

  // Rimuovi il vecchio oggetto membro e aggiungi il nuovo con il ruolo aggiornato
  const updatedMemberObj = { ...memberObj, memberRole: newRole };
  
  const batch = writeBatch(db);
  batch.update(pantryRef, {
    pantryMembers: arrayRemove(memberObj)
  });
  batch.update(pantryRef, {
    pantryMembers: arrayUnion(updatedMemberObj),
    pantryUpdatedAt: serverTimestamp()
  });

  await batch.commit();
}

//Elimina completamente la dispensa e la rimuove da tutti i membri
export async function deletePantry(pantryId: string) {
  const pantryRef = doc(db, "pantries", pantryId);
  const pantrySnap = await getDoc(pantryRef);
  
  if (!pantrySnap.exists()) return;

  const pantryData = pantrySnap.data() as Pantry;
  const members = pantryData.pantryMembers || [];
  
  const batch = writeBatch(db);

  // Per ogni membro, rimuovi la dispensa dai loro riferimenti
  for (const member of members) {
    const userRef = doc(db, "users", member.memberId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      let newCurrentPantryId = userData.userProfileCurrentPantryId;
      if (newCurrentPantryId === pantryId) {
        const remainingPantries = (userData.userProfilePantryIds || []).filter((id: string) => id !== pantryId);
        newCurrentPantryId = remainingPantries.length > 0 ? remainingPantries[0] : null;
      }
      batch.update(userRef, {
        userProfilePantryIds: arrayRemove(pantryId),
        userProfileCurrentPantryId: newCurrentPantryId
      });
    }
  }

  // Nota: I prodotti all'interno della dispensa rimarrebbero "orfani" in Firestore,
  // la prassi corretta in un DB NoSQL sarebbe eliminare anche tutti i subcollection/documenti dei prodotti.
  // Dato che i prodotti potrebbero essere nella collection "products" con campo "pantryId", 
  // andrebbero eliminati. Se serve, fare una query per eliminare i prodotti della dispensa.
  // Qui eliminiamo solo la root della dispensa per semplicità, o dovremmo usare una Cloud Function.
  
  // Eliminazione della dispensa
  batch.delete(pantryRef);
  
  await batch.commit();
}
