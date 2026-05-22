"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (userAuth) => {
      try {
        if (!userAuth) {
          // Utente non autenticato: manda al login
          router.replace("/login");
          setAllowed(false);
          setChecking(false);
          return;
        }

        // Leggi profilo utente da Firestore
        const userRef = doc(db, "users", userAuth.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : null;

        const pantryIds: string[] | null | undefined = data?.userProfilePantryIds;

        if (!pantryIds || pantryIds.length === 0) {
          // Nessuna dispensa: manda alla pagina di onboarding/access
          router.replace("/access-to-pantry");
          setAllowed(false);
        } else {
          // Ha almeno una dispensa: assicurati che currentPantryId sia impostata
          const currentPantryId: string | null | undefined = data?.userProfileCurrentPantryId;
          const toUse = currentPantryId && pantryIds.includes(currentPantryId) ? currentPantryId : pantryIds[0];

          if (!currentPantryId || !pantryIds.includes(currentPantryId)) {
            // Salva il primo id come preferito
            try {
              await setDoc(doc(db, "users", userAuth.uid), { userProfileCurrentPantryId: toUse }, { merge: true });
              console.log("Impostata userProfileCurrentPantryId a", toUse);
            } catch (e) {
              console.error("Errore salvando currentPantryId:", e);
            }
          }

          setAllowed(true);
          // Porta l'utente all'inventario (visualizzazione predefinita)
          router.replace("/inventario");
        }
      } catch (err) {
        console.error("AppGuard error:", err);
        // In caso di errore lato DB, fallback all'onboarding per evitare stati inconsistenti
        router.replace("/access-to-pantry");
        setAllowed(false);
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
