import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import type { UserProfile, UserNotificationPreferences } from "../../types/firestore/userProfileType";

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  enabled: true,
  notifyOnExpiryDays: 2, // avviso con 2 giorni di anticipo
  notifyOpenedProducts: true,
  notifyLowStock: false,
  preferredHour: 9,
};

/**
 * Genera un token sicuro randomico per l'autenticazione MCP
 */
export function generateMcpToken(): string {
  // Genera stringa crittograficamente casuale nel formato: pantry_mcp_<random32chars>
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    const p1 = crypto.randomUUID().replace(/-/g, "");
    const p2 = Math.random().toString(36).substring(2, 10);
    return `pantry_mcp_${p1}${p2}`;
  }
  return `pantry_mcp_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
}

/**
 * Recupera il profilo completo di un utente
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * Genera o rigenera il token MCP per l'utente corrente
 */
export async function rotateUserMcpToken(userId: string): Promise<string> {
  const userRef = doc(db, "users", userId);
  const newToken = generateMcpToken();

  await setDoc(userRef, {
    mcpToken: newToken,
    mcpTokenCreatedAt: serverTimestamp(),
  }, { merge: true });

  return newToken;
}

/**
 * Revoca il token MCP dell'utente impostandolo a null
 */
export async function revokeUserMcpToken(userId: string): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    mcpToken: null,
    mcpTokenCreatedAt: null,
  });
}

/**
 * Registra un nuovo token FCM per l'utente su Firestore
 */
export async function registerFcmToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;
  const userRef = doc(db, "users", userId);
  await setDoc(
    userRef,
    {
      fcmTokens: arrayUnion(token),
    },
    { merge: true }
  );
}

/**
 * Rimuove un token FCM revocato o non più valido per l'utente
 */
export async function unregisterFcmToken(userId: string, token: string): Promise<void> {
  if (!userId || !token) return;
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    fcmTokens: arrayRemove(token),
  });
}

/**
 * Salva le preferenze di notifica dell'utente
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<UserNotificationPreferences>
): Promise<void> {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  await setDoc(
    userRef,
    {
      notificationPreferences: preferences,
    },
    { merge: true }
  );
}

export interface AppNavScreen {
  id: string;
  name: string;
  href: string;
  description: string;
  iconName: "Refrigerator" | "ShoppingCart" | "ChefHat" | "CalendarDays" | "Trash2" | "Settings";
}

export const ALL_APP_SCREENS: AppNavScreen[] = [
  {
    id: "inventario",
    name: "Dispensa",
    href: "/inventario",
    description: "Dispensa, scadenze e prodotti nel freezer",
    iconName: "Refrigerator",
  },
  {
    id: "spesa",
    name: "Spesa",
    href: "/lista-della-spesa",
    description: "Lista della spesa collaborativa e check-out",
    iconName: "ShoppingCart",
  },
  {
    id: "piano-settimanale",
    name: "Pasti",
    href: "/piano-settimanale",
    description: "Pianificazione pasti settimanale (Colazione, Pranzo, Merenda, Cena)",
    iconName: "CalendarDays",
  },
  {
    id: "ricettario",
    name: "Ricettario",
    href: "/ricettario",
    description: "Ricette salvate, idee anti-spreco e Chef AI",
    iconName: "ChefHat",
  },
  {
    id: "spreco",
    name: "Spreco",
    href: "/spreco",
    description: "Metriche, statistiche e storico degli sprechi",
    iconName: "Trash2",
  },
];

export const DEFAULT_NAV_TABS: string[] = ["inventario", "spesa", "piano-settimanale", "ricettario", "spreco"];
export const DEFAULT_DESKTOP_NAV_TABS: string[] = ["inventario", "spesa", "piano-settimanale", "ricettario", "spreco"];

/**
 * Salva le preferenze delle schermate di navigazione mobile su Firestore e localStorage
 */
export async function updateNavTabsPreferences(userId: string, tabs: string[]): Promise<void> {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { userProfileNavTabs: tabs }, { merge: true });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("user_nav_tabs", JSON.stringify(tabs));
      window.dispatchEvent(new CustomEvent("nav-tabs-updated", { detail: { tabs } }));
    } catch {
      // Ignora storage error
    }
  }
}

/**
 * Salva le preferenze delle schermate della sidebar desktop su Firestore e localStorage
 */
export async function updateDesktopNavTabsPreferences(userId: string, tabs: string[]): Promise<void> {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, { userProfileDesktopNavTabs: tabs }, { merge: true });
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("user_desktop_nav_tabs", JSON.stringify(tabs));
      window.dispatchEvent(new CustomEvent("desktop-nav-tabs-updated", { detail: { tabs } }));
    } catch {
      // Ignora storage error
    }
  }
}

/**
 * Salva simultaneamente le preferenze di navigazione sia Mobile che Desktop
 */
export async function updateBothNavTabsPreferences(
  userId: string,
  mobileTabs: string[],
  desktopTabs: string[]
): Promise<void> {
  if (!userId) return;
  const userRef = doc(db, "users", userId);
  await setDoc(
    userRef,
    {
      userProfileNavTabs: mobileTabs,
      userProfileDesktopNavTabs: desktopTabs,
    },
    { merge: true }
  );

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("user_nav_tabs", JSON.stringify(mobileTabs));
      localStorage.setItem("user_desktop_nav_tabs", JSON.stringify(desktopTabs));
      window.dispatchEvent(new CustomEvent("nav-tabs-updated", { detail: { tabs: mobileTabs } }));
      window.dispatchEvent(new CustomEvent("desktop-nav-tabs-updated", { detail: { tabs: desktopTabs } }));
    } catch {
      // Ignora storage error
    }
  }
}


