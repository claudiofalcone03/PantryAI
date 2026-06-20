"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createPantry, joinPantryWithCode } from "@/lib/firestore";

export default function AccessToPantryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [pantryName, setPantryName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setUserName(user.displayName ?? undefined);
      } else {
        router.replace("/login"); //redirect alla pagina di login se l'utente non è autenticato
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !pantryName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createPantry(userId, pantryName.trim(), userName);
      router.replace("/inventario"); //redirect alla pagina inventario dopo la creazione della dispensa
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Errore durante la creazione della dispensa.");
      setError(error.message || "Errore durante la creazione della dispensa.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !inviteCode.trim()) return;
    setIsJoining(true);
    setError(null);
    try {
      await joinPantryWithCode(userId, inviteCode.trim().toUpperCase(), userName); //codice in maiuscolo 
      router.replace("/inventario"); //redirect alla pagina inventario dopo l'accesso alla dispensa
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Errore durante l'accesso alla dispensa.");
      setError(error.message || "Errore durante l'accesso alla dispensa.");
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <svg className="w-10 h-10 text-zinc-400 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Colonna Creazione */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 flex flex-col">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Crea Nuova Dispensa</h2>
          <p className="text-sm text-zinc-500 mb-6 flex-grow">
            Inizia da zero. Crea una nuova dispensa e invita i tuoi coinquilini o familiari condividendo il codice d&apos;invito.
          </p>
          
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label htmlFor="pantryName" className="block text-sm font-medium text-zinc-700 mb-1">
                Nome della dispensa
              </label>
              <input
                id="pantryName"
                type="text"
                placeholder="Es. Casa in montagna"
                value={pantryName}
                onChange={(e) => setPantryName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isCreating || !pantryName.trim()}
              className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creazione in corso..." : "Crea Dispensa"}
            </button>
          </form>
        </section>

        {/* Colonna Unisciti */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 flex flex-col">
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Unisciti a una Dispensa</h2>
          <p className="text-sm text-zinc-500 mb-6 flex-grow">
            Hai ricevuto un codice d&apos;  invito? Inseriscilo qui sotto per unirti a una dispensa già esistente e collaborare.
          </p>
          
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700 mb-1">
                Codice d&apos;invito
              </label>
              <input
                id="inviteCode"
                type="text"
                placeholder="Es. A1B2C3"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm uppercase focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 uppercase"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isJoining || !inviteCode.trim()}
              className="mt-2 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? "Accesso in corso..." : "Unisciti"}
            </button>
          </form>
        </section>
      </div>

      {error && (
        <div className="mt-8 max-w-4xl w-full p-4 rounded-lg bg-red-50 text-red-700 border border-red-200 text-center text-sm font-medium shadow-sm">
          {error}
        </div>
      )}
    </main>
  );
}