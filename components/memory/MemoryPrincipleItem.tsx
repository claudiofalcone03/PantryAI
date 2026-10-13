"use client";

import React, { useState } from "react";
import {
  Pencil,
  Trash2,
  Check,
  X,
  Sparkles,
  Bot,
  User,
  Salad,
  ThumbsDown,
  Heart,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import type { AtomicMemoryPrinciple, MemoryCategory } from "@/types/firestore/userMemoryType";
import { MEMORY_CATEGORIES_INFO } from "@/types/firestore/userMemoryType";

interface MemoryPrincipleItemProps {
  principle: AtomicMemoryPrinciple;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onUpdate: (id: string, newText: string, newCategory: MemoryCategory) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function MemoryPrincipleItem({
  principle,
  onToggle,
  onUpdate,
  onDelete,
}: MemoryPrincipleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(principle.text);
  const [editCategory, setEditCategory] = useState<MemoryCategory>(principle.category);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const catInfo = MEMORY_CATEGORIES_INFO[principle.category] || MEMORY_CATEGORIES_INFO.other;

  const getCategoryIcon = (catId: MemoryCategory) => {
    switch (catId) {
      case "diet":
        return <Salad className="w-3.5 h-3.5" />;
      case "taste_dislike":
        return <ThumbsDown className="w-3.5 h-3.5" />;
      case "taste_preference":
        return <Heart className="w-3.5 h-3.5" />;
      case "cooking_habit":
        return <Clock className="w-3.5 h-3.5" />;
      case "household":
        return <Users className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onUpdate(principle.id, editText.trim(), editCategory);
      setIsEditing(false);
    } catch (err) {
      console.error("Errore modifica principio:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleClick = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await onToggle(principle.id, !principle.isActive);
    } catch (err) {
      console.error("Errore toggle principio:", err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDeleteClick = async () => {
    if (isDeleting) return;
    const confirm = window.confirm(`Eliminare definitivamente questo principio dalla memoria?\n"${principle.text}"`);
    if (!confirm) return;

    setIsDeleting(true);
    try {
      await onDelete(principle.id);
    } catch (err) {
      console.error("Errore eliminazione principio:", err);
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`group p-4 rounded-2xl border transition-all ${
        principle.isActive
          ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700"
          : "bg-zinc-50/70 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800/50 opacity-70"
      }`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Testo Principio Atomico
            </label>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              placeholder="es. Preferisce pietanze con poco sale o senza piccante"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
              Categoria
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MEMORY_CATEGORIES_INFO) as MemoryCategory[]).map((catKey) => {
                const info = MEMORY_CATEGORIES_INFO[catKey];
                const isSelected = editCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setEditCategory(catKey)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750"
                    }`}
                  >
                    {getCategoryIcon(catKey)}
                    <span>{info.badgeLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setEditText(principle.text);
                setEditCategory(principle.category);
                setIsEditing(false);
              }}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Annulla</span>
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSaving || !editText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Salva Modifiche</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Header pillole Categoria & Fonte */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catInfo.colorClass}`}
              >
                {getCategoryIcon(principle.category)}
                <span>{catInfo.badgeLabel}</span>
              </span>

              {principle.source === "learned" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
                  <Bot className="w-3 h-3 text-indigo-500" />
                  <span>Appreso dall&apos;IA</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-750">
                  <User className="w-3 h-3 text-zinc-500" />
                  <span>Inserito da te</span>
                </span>
              )}

              {!principle.isActive && (
                <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  Disattivato
                </span>
              )}
            </div>

            {/* Testo del principio atomico */}
            <p
              className={`text-xs sm:text-sm font-medium leading-relaxed ${
                principle.isActive
                  ? "text-zinc-800 dark:text-zinc-200"
                  : "text-zinc-500 dark:text-zinc-400 italic line-through"
              }`}
            >
              {principle.text}
            </p>
          </div>

          {/* Azioni laterali: Toggle, Edit, Delete */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            {/* Toggle Attivo/Disattivo Switch */}
            <button
              type="button"
              onClick={handleToggleClick}
              disabled={isToggling}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                principle.isActive ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
              title={principle.isActive ? "Disattiva temporaneamente questo principio" : "Riattiva principio"}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  principle.isActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>

            {/* Pulsante Modifica */}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Modifica principio"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Pulsante Elimina */}
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Elimina principio definitivamente"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
