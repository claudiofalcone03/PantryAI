"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  Trash, Users, Plus, X, Pencil, ArrowLeft, Copy,
  UserMinus, Crown, User as UserIcon
} from "lucide-react";
import { type Pantry, DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantryType";
import { Skeleton } from "@/components";
import {
  updatePantryName,
  updatePantryCategories,
  removeMemberFromPantry,
  updateMemberRoleInPantry,
  deletePantry
} from "@/lib/firestore/pantries";

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : String(err);

export default function PantrySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const pantryId = params.pantryId as string;

  const [pantry, setPantry] = useState<Pantry | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "editor" | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [newCategoryValue, setNewCategoryValue] = useState("");

  useEffect(() => {
    const fetchPantry = async () => {
      if (!pantryId || !auth.currentUser) return;
      try {
        const pantryRef = doc(db, "pantries", pantryId);
        const snap = await getDoc(pantryRef);
        if (snap.exists()) {
          const data = snap.data() as Pantry;
          setPantry({ ...data, pantryId: snap.id });
          setEditNameValue(data.pantryName);

          const myMember = data.pantryMembers?.find(m => m.memberId === auth.currentUser?.uid);
          if (myMember) {
            setCurrentUserRole(myMember.memberRole);
          }
        } else {
          alert("Dispensa non trovata");
          router.push("/profilo");
        }
      } catch (error) {
        console.error("Errore recupero dispensa:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPantry();
  }, [pantryId, router]);

  const isOwner = currentUserRole === "owner";

  const handleUpdateName = async () => {
    if (!editNameValue.trim() || !pantry) return;
    try {
      await updatePantryName(pantry.pantryId!, editNameValue.trim());
      setPantry(prev => prev ? { ...prev, pantryName: editNameValue.trim() } : null);
      setIsEditingName(false);
      alert("Nome dispensa aggiornato!");
    } catch (error: unknown) {
      alert("Errore aggiornamento nome: " + getErrorMessage(error));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryValue.trim() || !pantry) return;
    const trimmed = newCategoryValue.trim();
    const currentCats = pantry.pantryCategories || [];
    if (currentCats.includes(trimmed)) {
      alert("Categoria già esistente");
      return;
    }
    const newCats = [...currentCats, trimmed];
    try {
      await updatePantryCategories(pantry.pantryId!, newCats);
      setPantry(prev => prev ? { ...prev, pantryCategories: newCats } : null);
      setNewCategoryValue("");
    } catch (error: unknown) {
      alert("Errore aggiunta categoria: " + getErrorMessage(error));
    }
  };

  const handleRemoveCategory = async (catToRemove: string) => {
    if (!pantry) return;
    const confirmRem = window.confirm(`Vuoi davvero rimuovere la categoria "${catToRemove}"?`);
    if (!confirmRem) return;

    const currentCats = pantry.pantryCategories || [];
    const newCats = currentCats.filter(c => c !== catToRemove);
    try {
      await updatePantryCategories(pantry.pantryId!, newCats);
      setPantry(prev => prev ? { ...prev, pantryCategories: newCats } : null);
    } catch (error: unknown) {
      alert("Errore rimozione categoria: " + getErrorMessage(error));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName?: string) => {
    if (!pantry) return;
    const confirmRem = window.confirm(`Vuoi espellere ${memberName || "questo utente"} dalla dispensa?`);
    if (!confirmRem) return;

    try {
      await removeMemberFromPantry(pantry.pantryId!, memberId);
      setPantry(prev => {
        if (!prev) return null;
        return {
          ...prev,
          pantryMembers: prev.pantryMembers?.filter(m => m.memberId !== memberId)
        };
      });
      alert("Utente espulso.");
    } catch (error: unknown) {
      alert("Errore espulsione utente: " + getErrorMessage(error));
    }
  };

  const handleChangeRole = async (memberId: string, currentRole: "owner" | "editor") => {
    if (!pantry) return;
    const newRole = currentRole === "owner" ? "editor" : "owner";
    const confirmRole = window.confirm(`Vuoi cambiare il ruolo a ${newRole.toUpperCase()}?`);
    if (!confirmRole) return;

    try {
      await updateMemberRoleInPantry(pantry.pantryId!, memberId, newRole);
      setPantry(prev => {
        if (!prev) return null;
        const newMembers = prev.pantryMembers?.map(m =>
          m.memberId === memberId ? { ...m, memberRole: newRole as "owner" | "editor" } : m
        );
        return { ...prev, pantryMembers: newMembers };
      });
      alert("Ruolo aggiornato.");
    } catch (error: unknown) {
      alert("Errore modifica ruolo: " + getErrorMessage(error));
    }
  };

  const handleDeletePantry = async () => {
    if (!pantry) return;
    const confirmDel = window.prompt(`ATTENZIONE: Questa azione è irreversibile. Digita "${pantry.pantryName}" per confermare l'eliminazione.`);
    if (confirmDel !== pantry.pantryName) {
      if (confirmDel !== null) alert("Nome non corrispondente. Eliminazione annullata.");
      return;
    }

    try {
      await deletePantry(pantry.pantryId!);
      alert("Dispensa eliminata con successo.");
      router.push("/profilo");
    } catch (error: unknown) {
      alert("Errore eliminazione dispensa: " + getErrorMessage(error));
    }
  };

  const handleCopyCode = () => {
    if (pantry?.pantryInviteCode) {
      navigator.clipboard.writeText(pantry.pantryInviteCode);
      alert("Codice di invito copiato: " + pantry.pantryInviteCode);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 min-h-0 h-full max-h-screen overflow-y-auto bg-zinc-50 dark:bg-zinc-950 pb-24 text-zinc-900 dark:text-zinc-100">
        <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center space-x-4 mb-6">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-2xs border border-zinc-200 dark:border-zinc-800 space-y-4">
             <Skeleton className="h-6 w-32 mb-4" />
             <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-2xs border border-zinc-200 dark:border-zinc-800 space-y-4">
             <Skeleton className="h-6 w-48 mb-4" />
             <Skeleton className="h-10 w-full rounded-xl" />
             <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!pantry) return null;

  return (
    <main className="flex-1 min-h-0 h-full max-h-screen overflow-y-auto bg-zinc-50 dark:bg-zinc-950 pb-24 text-zinc-900 dark:text-zinc-100">
      <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto space-y-6">

        {/* Intestazione */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.push("/profilo")}
            className="p-2.5 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xs border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Impostazioni Dispensa</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configura il nome, le categorie alimentari e i membri autorizzati</p>
          </div>
        </div>

        {/* Nome Dispensa */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center">
            <Pencil className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" /> Nome Dispensa
          </h2>
          {isEditingName && isOwner ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="flex-1 p-3 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Nome dispensa"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingName(false)}
                  className="px-4 py-3 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleUpdateName}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Salva
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{pantry.pantryName}</span>
              {isOwner && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors cursor-pointer"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Invito */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" /> Invito Membri
          </h2>
          <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Codice Dispensa</p>
              <p className="text-xl font-mono font-bold tracking-widest text-zinc-900 dark:text-zinc-100">{pantry.pantryInviteCode}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-zinc-700 shadow-2xs border border-zinc-200 dark:border-zinc-600 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 transition-colors font-semibold text-xs cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>Copia</span>
            </button>
          </div>
        </section>

        {/* Categorie */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" /> Categorie Prodotti
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(pantry.pantryCategories || []).map(cat => (
              <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                {cat}
                {isOwner && (
                  <button
                    onClick={() => handleRemoveCategory(cat)}
                    className="ml-2 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded-full p-0.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {isOwner && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryValue}
                  onChange={e => setNewCategoryValue(e.target.value)}
                  placeholder="Nuova categoria"
                  className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                >
                  Aggiungi
                </button>
              </div>

              {/* Categorie Consigliate */}
              {DEFAULT_PANTRY_CATEGORIES.filter(cat => !(pantry.pantryCategories || []).includes(cat)).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Categorie suggerite:</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_PANTRY_CATEGORIES.filter(cat => !(pantry.pantryCategories || []).includes(cat)).map(cat => (
                      <button
                        key={cat}
                        onClick={async () => {
                          try {
                            const newCats = [...(pantry.pantryCategories || []), cat];
                            await updatePantryCategories(pantry.pantryId!, newCats);
                            setPantry(prev => prev ? { ...prev, pantryCategories: newCats } : null);
                          } catch (error: unknown) {
                            alert("Errore aggiunta categoria: " + getErrorMessage(error));
                          }
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Membri */}
        <section className="bg-white dark:bg-zinc-900 rounded-3xl p-0 shadow-2xs border border-zinc-200/90 dark:border-zinc-800/90 overflow-hidden">
          <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Membri Dispensa</h2>
            <span className="ml-auto bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 py-1 px-3 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-800/60">
              {pantry.pantryMembers?.length || 0}/10
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(pantry.pantryMembers || []).map(member => {
              const isMe = member.memberId === auth.currentUser?.uid;
              return (
                <div key={member.memberId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/40 dark:bg-zinc-900/40">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                      <UserIcon className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        {member.memberName || "Utente Sconosciuto"}
                        {isMe && <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md font-bold">Tu</span>}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        {member.memberRole === "owner" ? <Crown className="w-3.5 h-3.5 text-amber-500" /> : <Pencil className="w-3.5 h-3.5 text-emerald-500" />}
                        <span className="capitalize">{member.memberRole}</span>
                      </p>
                    </div>
                  </div>

                  {isOwner && !isMe && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleChangeRole(member.memberId, member.memberRole)}
                        className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        Rendi {member.memberRole === "owner" ? "Editor" : "Owner"}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.memberId, member.memberName)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors cursor-pointer"
                        title="Espelli utente"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Danger Zone */}
        {isOwner && (
          <section className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-3xl p-5 border border-rose-200/70 dark:border-rose-900/50">
              <h2 className="text-base font-bold text-rose-700 dark:text-rose-400 mb-2 flex items-center">
                <Trash className="w-5 h-5 mr-2" /> Danger Zone
              </h2>
              <p className="text-xs text-rose-600 dark:text-rose-300 mb-4">
                Questa azione eliminerà permanentemente la dispensa e rimuoverà tutti i membri autorizzati.
              </p>
              <button
                onClick={handleDeletePantry}
                className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Elimina Dispensa Definitivamente
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
