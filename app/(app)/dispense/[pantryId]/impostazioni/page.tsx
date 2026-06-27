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
import {
  updatePantryName,
  updatePantryCategories,
  removeMemberFromPantry,
  updateMemberRoleInPantry,
  deletePantry
} from "@/lib/firestore/pantries";

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
    } catch (error: any) {
      alert("Errore aggiornamento nome: " + error.message);
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
    } catch (error: any) {
      alert("Errore aggiunta categoria: " + error.message);
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
    } catch (error: any) {
      alert("Errore rimozione categoria: " + error.message);
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
    } catch (error: any) {
      alert("Errore espulsione utente: " + error.message);
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
    } catch (error: any) {
      alert("Errore modifica ruolo: " + error.message);
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
    } catch (error: any) {
      alert("Errore eliminazione dispensa: " + error.message);
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
      <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-500">Caricamento...</p>
      </main>
    );
  }

  if (!pantry) return null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* Intestazione */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => router.push("/profilo")}
            className="p-2 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Impostazioni Dispensa</h1>
        </div>

        {/* Nome Dispensa */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Pencil className="w-5 h-5 mr-2 text-blue-500" /> Nome Dispensa
          </h2>
          {isEditingName && isOwner ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="flex-1 p-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white"
                placeholder="Nome dispensa"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingName(false)}
                  className="px-4 py-3 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleUpdateName}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Salva
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-lg text-gray-800 dark:text-gray-200">{pantry.pantryName}</span>
              {isOwner && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                  <Pencil className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Invito */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-green-500" /> Invito Membri
          </h2>
          <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-zinc-700">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Codice Dispensa</p>
              <p className="text-xl font-mono font-bold tracking-widest text-gray-900 dark:text-white">{pantry.pantryInviteCode}</p>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-zinc-700 shadow-sm border border-gray-200 dark:border-zinc-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span className="font-medium text-sm">Copia</span>
            </button>
          </div>
        </section>

        {/* Categorie */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-2 text-orange-500" /> Categorie Prodotti
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(pantry.pantryCategories || []).map(cat => (
              <span key={cat} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                {cat}
                {isOwner && (
                  <button
                    onClick={() => handleRemoveCategory(cat)}
                    className="ml-2 hover:bg-orange-200 dark:hover:bg-orange-800 rounded-full p-0.5 transition-colors"
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
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
                >
                  Aggiungi
                </button>
              </div>

              {/* Categorie Consigliate */}
              {DEFAULT_PANTRY_CATEGORIES.filter(cat => !(pantry.pantryCategories || []).includes(cat)).length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Categorie suggerite:</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_PANTRY_CATEGORIES.filter(cat => !(pantry.pantryCategories || []).includes(cat)).map(cat => (
                      <button
                        key={cat}
                        onClick={async () => {
                          try {
                            const newCats = [...(pantry.pantryCategories || []), cat];
                            await updatePantryCategories(pantry.pantryId!, newCats);
                            setPantry(prev => prev ? { ...prev, pantryCategories: newCats } : null);
                          } catch (error: any) {
                            alert("Errore aggiunta categoria: " + error.message);
                          }
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700 transition-colors"
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
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-0 shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Membri Dispensa</h2>
            <span className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 py-1 px-3 rounded-full text-xs font-bold">
              {pantry.pantryMembers?.length || 0}/10
            </span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-zinc-800">
            {(pantry.pantryMembers || []).map(member => {
              const isMe = member.memberId === auth.currentUser?.uid;
              return (
                <div key={member.memberId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-zinc-900/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-700 rounded-full flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {member.memberName || "Utente Sconosciuto"}
                        {isMe && <span className="text-xs bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-md">Tu</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        {member.memberRole === "owner" ? <Crown className="w-3.5 h-3.5 text-yellow-500" /> : <Pencil className="w-3.5 h-3.5 text-blue-500" />}
                        <span className="capitalize">{member.memberRole}</span>
                      </p>
                    </div>
                  </div>

                  {isOwner && !isMe && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleChangeRole(member.memberId, member.memberRole)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Rendi {member.memberRole === "owner" ? "Editor" : "Owner"}
                      </button>
                      <button
                        onClick={() => handleRemoveMember(member.memberId, member.memberName)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
          <section className="mt-8 pt-4 border-t border-gray-200 dark:border-zinc-800">
            <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-5 border border-red-200 dark:border-red-900/50">
              <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center">
                <Trash className="w-5 h-5 mr-2" /> Danger Zone
              </h2>
              <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                Questa azione eliminerà permanentemente la dispensa e rimuoverà tutti i membri.
              </p>
              <button
                onClick={handleDeletePantry}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
              >
                Elimina Dispensa
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
