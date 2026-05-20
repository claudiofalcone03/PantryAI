"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types/firestore";  //Importa l'interfaccia UserProfile per tipizzare

export default function RedirectLoginPage() {
  const [status, setStatus] = useState("Controllo autenticazione in corso...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setError("Nessun utente autenticato trovato dopo il login.");
        setStatus("Accesso non completato");
        return;
      }

      const userProfile: UserProfile = {
        userId: user.uid,
        email: user.email ?? "",     //vuota se non disponibile
        displayName: user.displayName ?? undefined,
        photoURL: user.photoURL ?? undefined,
        createdAt: Timestamp.now(),
      };

      console.log("Salvataggio su Firestore (users/" + user.uid + "):", userProfile);
      try {
        await setDoc(doc(db, "users", user.uid), userProfile, { merge: true });
        setStatus(`Profilo salvato correttamente in users/${user.uid}`);
      } catch (saveError) {
        console.error(saveError);
        setError("Errore durante il salvataggio del profilo utente su Firestore.");
        setStatus("Salvataggio fallito");
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl">
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Firestore test</p>
          <h1 className="text-3xl font-semibold text-zinc-900">Verifica collegamento databsse firebase a user</h1>
          <p className="text-base leading-7 text-zinc-600">
            Questa pagina salva o aggiorna il documento utente in users/{"{userId}"} appena rileva l&apos;utente autenticato.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-zinc-100 p-4 text-sm text-zinc-700">
          {status}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 text-sm text-zinc-500">
          <p>Campi salvati nel documento:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>userId</li>
            <li>email</li>
            <li>displayName</li>
            <li>photoURL</li>
            <li>createdAt</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
