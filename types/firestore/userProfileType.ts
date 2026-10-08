import type { Timestamp } from "firebase/firestore";

export interface UserNotificationPreferences {
  enabled: boolean;
  notifyOnExpiryDays: number; // quanti giorni prima avvisare (0 = giorno stesso, 1, 2, 3)
  notifyOpenedProducts: boolean; // se avvisare anche per prodotti aperti con shelf-life in scadenza
  notifyLowStock: boolean; // se avvisare per prodotti esauriti
  preferredHour?: number; // ora preferita di invio (default 9 = 09:00)
}

//Tipo profilo utente
export interface UserProfile {
  userId: string;
  userEmail: string;
  userProfileName?: string; //nickname dell'utente, se vuole inserirlo
  userProfilePhotoURL?: string;
  userProfileCreatedAt?: Timestamp;
  userProfilePantryIds?: string[] | null; // Array di ID delle dispense a cui l'utente appartiene, se è vuoto vuol dire che devo ancora accedere ancora ad almeno una dispensa
  userProfileCurrentPantryId?: string | null;
  mcpToken?: string | null; // Token di autenticazione personale per il server MCP Antigravity
  mcpTokenCreatedAt?: Timestamp | null;
  fcmTokens?: string[] | null; // Token FCM registrati dai dispositivi dell'utente
  notificationPreferences?: UserNotificationPreferences | null;
  userProfileNavTabs?: string[] | null; // Array ordinato di ID delle schermate nella navbar
}

