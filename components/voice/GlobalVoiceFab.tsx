"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { AssistantChatModal } from "@/components/assistant/AssistantChatModal";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getProductsByPantry } from "@/lib/firestore/products";
import { DEFAULT_PANTRY_CATEGORIES } from "@/types/firestore/pantryType";
import type { Product } from "@/types/firestore/productType";

export function GlobalVoiceFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [pantryName, setPantryName] = useState<string>("Dispensa");
  const [categories, setCategories] = useState<string[]>(DEFAULT_PANTRY_CATEGORIES);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);

  const loadPantryContext = useCallback(async (overrideUid?: string) => {
    const uid = overrideUid || auth.currentUser?.uid;
    if (!uid) return;

    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      const uData = userDoc.data();
      const pantryId = uData?.userProfileCurrentPantryId || uData?.userProfilePantryIds?.[0];
      if (!pantryId) return;

      setCurrentPantryId(pantryId);

      const [pantryDoc, prods] = await Promise.all([
        getDoc(doc(db, "pantries", pantryId)),
        getProductsByPantry(pantryId),
      ]);

      if (pantryDoc.exists()) {
        const pData = pantryDoc.data();
        if (pData?.pantryName) {
          setPantryName(pData.pantryName);
        }
        if (pData?.pantryCategories && pData.pantryCategories.length > 0) {
          setCategories(pData.pantryCategories);
        }
      }

      setRawProducts(prods);
    } catch (err) {
      console.warn("[GlobalVoiceFab] Errore caricamento contesto dispensa:", err);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadPantryContext(user.uid);
      }
    });
    return () => unsub();
  }, [loadPantryContext]);

  // Ricarica i prodotti quando cambia l'inventario
  useEffect(() => {
    const handleUpdate = () => {
      loadPantryContext();
    };
    window.addEventListener("inventory-updated", handleUpdate);
    return () => {
      window.removeEventListener("inventory-updated", handleUpdate);
    };
  }, [loadPantryContext]);

  const handleOpen = async () => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
    await loadPantryContext();
    setIsOpen(true);
  };

  return (
    <>
      {/* Floating Action Button (Sempre in primo piano in basso a destra con sole Stelline) */}
      <aside aria-label="Assistente AI Dispensa" className="fixed bottom-20 right-4 sm:right-6 z-40">
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Apri chat con l'Assistente AI"
          title="Assistente AI Dispensa"
          className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        >
          {/* Alone pulsante animato discreto */}
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-25 animate-ping -z-10 pointer-events-none" />

          {/* Solamente icona delle stelline AI */}
          <Sparkles className="w-7 h-7 text-amber-200 group-hover:scale-110 transition-transform" />
        </button>
      </aside>

      {/* Pop-up Chat con l'Assistente AI */}
      <AssistantChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        pantryId={currentPantryId}
        pantryName={pantryName}
        pantryCategories={categories}
        products={rawProducts}
      />
    </>
  );
}
