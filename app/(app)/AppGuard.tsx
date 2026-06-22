"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true); // se true, mostra il caricamento
  const [allowed, setAllowed] = useState(false);  // se false, non renderizza i figli (area protetta)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (userAuth) => {
      try {
        if (!userAuth) {
          // Utente non autenticato quindi mando a \login
          router.replace("/login");
          setAllowed(false);
          setChecking(false);
          return;
        }

        // Lettura del profilo utente da Firestore
        const userDoc = doc(db, "users", userAuth.uid); //Prendo il riferimento al documento dell'utente
        const snap = await getDoc(userDoc); //Leggo il documento
        const data = snap.exists() ? snap.data() : null; //Se esiste prendo i dati, altrimenti null

        // Carico le eventuali dispense collegate all'utente alla variabile
        const pantryIds: string[] | null | undefined = data?.userProfilePantryIds;

        if (!pantryIds || pantryIds.length === 0) {
          // Se nessuna dispensa manda alla pagina access-to-pantry
          console.log(
            `Messaggio da AppGuard: nessuna dispensa trovata per l'utente ${userAuth?.uid}; reindirizzo a /access-to-pantry`
          );
          router.replace("/access-to-pantry");
          setAllowed(false);
        } else {
          // Verifico se l'id della dispensa preferita è tra quelle collegate all'utente, altrimenti usa la prima dispensa disponibile
          const currentPantryId: string | null | undefined = data?.userProfileCurrentPantryId; // L'id della dispensa attiva preferita, se esiste

          // verifico se currenPantryId esiste e fa parte tra quelle dell'utente,
          // se sì lo uso, altrimenti prendo la prima dispensa disponibile tra quelle collegate all'utente
          const toUse = currentPantryId && pantryIds.includes(currentPantryId) ? currentPantryId : pantryIds[0];

          if (!currentPantryId || !pantryIds.includes(currentPantryId)) {
            // Salva il primo id come preferito
            try {
              await setDoc(doc(db, "users", userAuth.uid), { userProfileCurrentPantryId: toUse }, { merge: true }); //salvo l'id della dispensa attiva, uso il merge per unire con eventuali dati esistenti
              console.log("Impostata userProfileCurrentPantryId a", toUse);
            } catch (e) {
              console.error("Errore salvando currentPantryId:", e);
            }
          }

          setAllowed(true);
        }
      } catch (err) {
        console.error("AppGuard error:", err);
        router.replace("/access-to-pantry");
        setAllowed(false); //per sicurezza, non permetto di accedere all'area protetta se c'è un errore
      } finally {
        setChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-16 h-16 text-zinc-600 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
