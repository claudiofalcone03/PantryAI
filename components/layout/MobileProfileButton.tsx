"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/firestore/userProfileType";

export function MobileProfileButton() {
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        let name = user.displayName || "Utente";
        let photo = user.photoURL || null;

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            if (data.userProfileName) name = data.userProfileName;
            if (data.userProfilePhotoURL) photo = data.userProfilePhotoURL;
          }
        } catch {
          // Fallback a dati auth base
        }

        setUserName(name);
        setPhotoURL(photo);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Link
      href="/profilo"
      title={`Profilo di ${userName || "Utente"}`}
      aria-label="Profilo e Impostazioni"
      className="relative w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer shadow-2xs"
    >
      {photoURL ? (
        <Image
          src={photoURL}
          alt={userName || "Profilo"}
          fill
          sizes="32px"
          className="object-cover"
        />
      ) : (
        <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
      )}
    </Link>
  );
}
