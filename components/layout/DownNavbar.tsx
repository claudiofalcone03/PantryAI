"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trash2,
  Refrigerator,
  ChefHat,
  ShoppingCart,
  Settings,
  CalendarDays,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ALL_APP_SCREENS,
  DEFAULT_NAV_TABS,
  type AppNavScreen,
} from "@/lib/firestore/userProfile";
import type { UserProfile } from "@/types/firestore/userProfileType";

const ICON_MAP = {
  Refrigerator,
  ShoppingCart,
  ChefHat,
  CalendarDays,
  Trash2,
  Settings,
};

export function DownNavbar() {
  const pathname = usePathname();
  const [activeTabIds, setActiveTabIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("user_nav_tabs");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Fallback default
      }
    }
    return DEFAULT_NAV_TABS;
  });

  // Ascolta aggiornamenti locali in tempo reale
  useEffect(() => {
    const handleTabsUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ tabs: string[] }>;
      if (custom.detail?.tabs && Array.isArray(custom.detail.tabs)) {
        setActiveTabIds(custom.detail.tabs);
      }
    };

    window.addEventListener("nav-tabs-updated", handleTabsUpdated);
    return () => {
      window.removeEventListener("nav-tabs-updated", handleTabsUpdated);
    };
  }, []);

  // Carica le preferenze dell'utente loggato da Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            if (data.userProfileNavTabs && Array.isArray(data.userProfileNavTabs) && data.userProfileNavTabs.length > 0) {
              setActiveTabIds(data.userProfileNavTabs);
              localStorage.setItem("user_nav_tabs", JSON.stringify(data.userProfileNavTabs));
            }
          }
        } catch (err) {
          console.warn("[DownNavbar] Avviso recupero preferenze navbar:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Costruisce la lista di schede ordinate
  const navItems = activeTabIds
    .map((id) => ALL_APP_SCREENS.find((s) => s.id === id))
    .filter(Boolean) as AppNavScreen[];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom,0px)] transition-all">
      <div className="flex items-center justify-around h-16 px-1 sm:px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.name === "Profilo" && pathname.includes("/impostazioni"));
          const Icon = ICON_MAP[item.iconName];

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200 min-w-0 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5.5 h-5.5 transition-all duration-200 ${
                    isActive ? "stroke-[2.5px] scale-110" : "stroke-[2px] scale-100"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] truncate w-full text-center transition-all duration-200 ${
                  isActive ? "opacity-100 font-bold" : "opacity-80 font-medium"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
