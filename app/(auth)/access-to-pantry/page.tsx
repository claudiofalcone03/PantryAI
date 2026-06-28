"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createPantry, joinPantryWithCode } from "@/lib/firestore/pantries";
import { AlertCircle, PlusCircle, Users, Loader2 } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">Benvenuto in PantryAI</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Scegli se creare una nuova dispensa o unirti a una già esistente.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Colonna Creazione */}
          <section className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Crea Dispensa</h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 flex-grow">
              Inizia da zero. Crea una nuova dispensa e invita i tuoi coinquilini o familiari condividendo il codice d&apos;invito.
            </p>

            <form onSubmit={handleCreate} className="flex flex-col gap-5 mt-auto">
              <div className="space-y-1">
                <label htmlFor="pantryName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">
                  Nome della dispensa
                </label>
                <input
                  id="pantryName"
                  type="text"
                  placeholder="Es. Casa in montagna"
                  value={pantryName}
                  onChange={(e) => setPantryName(e.target.value)}
                  className="block w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-zinc-50 dark:bg-zinc-950 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isCreating || !pantryName.trim()}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isCreating ? <><Loader2 className="w-5 h-5 animate-spin" /> Creazione...</> : "Crea Dispensa"}
              </button>
            </form>
          </section>

          {/* Colonna Unisciti */}
          <section className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Unisciti</h2>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 flex-grow">
              Hai ricevuto un codice d&apos;invito? Inseriscilo qui sotto per unirti a una dispensa già esistente e collaborare.
            </p>

            <form onSubmit={handleJoin} className="flex flex-col gap-5 mt-auto">
              <div className="space-y-1">
                <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">
                  Codice d&apos;invito
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  placeholder="Es. A1B2C3"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="block w-full px-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-zinc-50 dark:bg-zinc-950 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors text-zinc-900 dark:text-zinc-100 uppercase"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || !inviteCode.trim()}
                className="w-full py-3 px-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isJoining ? <><Loader2 className="w-5 h-5 animate-spin" /> Accesso...</> : "Unisciti"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}