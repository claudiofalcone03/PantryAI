"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Refrigerator,
  ShoppingCart,
  CalendarDays,
  ChefHat,
  Trash2,
  Settings,
  Sparkles,
  Leaf,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/firestore/userProfileType";
import { useAssistant } from "@/context/AssistantContext";

import {
  ALL_APP_SCREENS,
  DEFAULT_DESKTOP_NAV_TABS,
  type AppNavScreen,
} from "@/lib/firestore/userProfile";

const ICON_MAP: Record<string, React.ElementType> = {
  Refrigerator,
  ShoppingCart,
  CalendarDays,
  ChefHat,
  Trash2,
  Settings,
};

export function DesktopSidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [currentPantryId, setCurrentPantryId] = useState<string>("");
  const [currentPantryName, setCurrentPantryName] = useState<string>("");
  const { isAssistantOpen, toggleAssistant } = useAssistant();

  const [activeTabIds, setActiveTabIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("user_desktop_nav_tabs");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Fallback default
      }
    }
    return DEFAULT_DESKTOP_NAV_TABS;
  });

  // Ascolta aggiornamenti locali in tempo reale
  useEffect(() => {
    const handleTabsUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ tabs: string[] }>;
      if (custom.detail?.tabs && Array.isArray(custom.detail.tabs)) {
        setActiveTabIds(custom.detail.tabs);
      }
    };

    window.addEventListener("desktop-nav-tabs-updated", handleTabsUpdated);
    return () => {
      window.removeEventListener("desktop-nav-tabs-updated", handleTabsUpdated);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserEmail(user.email || "");
        setUserName(user.displayName || user.email?.split("@")[0] || "Utente");

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            if (data.userProfileName) setUserName(data.userProfileName);
            if (data.userProfileCurrentPantryId) {
              setCurrentPantryId(data.userProfileCurrentPantryId);
              const pDoc = await getDoc(doc(db, "pantries", data.userProfileCurrentPantryId));
              if (pDoc.exists()) {
                setCurrentPantryName(pDoc.data()?.pantryName || "");
              }
            }
            if (data.userProfileDesktopNavTabs && Array.isArray(data.userProfileDesktopNavTabs) && data.userProfileDesktopNavTabs.length > 0) {
              setActiveTabIds(data.userProfileDesktopNavTabs);
              localStorage.setItem("user_desktop_nav_tabs", JSON.stringify(data.userProfileDesktopNavTabs));
            }
          }
        } catch (err) {
          console.warn("[DesktopSidebar] Errore recupero profilo:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Mappa delle schermate attive ordinate per desktop
  const navItems = activeTabIds
    .map((id) => ALL_APP_SCREENS.find((s) => s.id === id))
    .filter(Boolean) as AppNavScreen[];

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-screen p-5 shrink-0 select-none sticky top-0 h-screen justify-between z-30">
        {/* Top: Logo & Navigazione */}
        <div className="space-y-6">
          {/* Logo Brand */}
          <Link
            href="/inventario"
            className="flex items-center gap-3 px-2 py-1.5 group transition-transform active:scale-98"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:bg-emerald-700 transition-colors shrink-0">
              <Leaf className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                Pantry<span className="text-emerald-600 dark:text-emerald-500">AI</span>
              </span>
              {currentPantryName && (
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]">
                  {currentPantryName}
                </span>
              )}
            </div>
          </Link>

          {/* Voci di Navigazione Dinamiche */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              const Icon = ICON_MAP[item.iconName] || Refrigerator;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60 font-medium"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isActive ? "text-emerald-600 dark:text-emerald-400 scale-105" : "text-zinc-400"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Tasto AI Assistente Rapido & Profilo Utente */}
        <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          {/* Tasto Assistente AI Desktop (Toggle Split View affiancato) */}
          <button
            type="button"
            onClick={toggleAssistant}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all text-left group cursor-pointer ${
              isAssistantOpen
                ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 dark:border-emerald-700 shadow-xs ring-1 ring-emerald-500/30"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-emerald-50 hover:border-emerald-200 dark:bg-zinc-900/80 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800/60"
            }`}
            title={isAssistantOpen ? "Chiudi pannello affiancato Assistente AI" : "Apri Assistente AI affiancato (Split View)"}
          >
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform ${
                isAssistantOpen
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 flex items-center justify-between">
                <span>Assistente AI</span>
                {isAssistantOpen && (
                  <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded-md font-bold">
                    Split View
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 truncate">Chatbot & comandi vocali</div>
            </div>
          </button>

          {/* Badge Profilo Utente */}
          <Link
            href="/profilo"
            className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              {userName ? userName.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 transition-colors">
                {userName || "Utente"}
              </span>
              <span className="text-[10px] text-zinc-400 truncate">
                {userEmail || "PantryAI Member"}
              </span>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
