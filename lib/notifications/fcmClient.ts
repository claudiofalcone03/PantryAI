import { app } from "../firebase";
import { registerFcmToken, unregisterFcmToken } from "../firestore/userProfile";

let messagingInstance: any = null;

/**
 * Verifica se il browser corrente supporta le notifiche push e FCM
 */
export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

  try {
    const { isSupported } = await import("firebase/messaging");
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Ottiene lo stato corrente dei permessi delle notifiche del browser
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

/**
 * Richiede il permesso all'utente e registra il token FCM su Firestore
 */
export async function requestAndRegisterFcmToken(userId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const supported = await isPushNotificationSupported();
  if (!supported) {
    throw new Error("Le notifiche push non sono supportate da questo browser o dispositivo.");
  }

  // 1. Richiedi permesso al browser
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permesso notifiche non concesso dall'utente.");
  }

  // 2. Ottieni la registrazione attiva del Service Worker
  let swReg: ServiceWorkerRegistration | undefined;
  try {
    swReg = await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn("[FCM] Service Worker ready non disponibile, fallback su registrazione predefinita:", err);
  }

  // 3. Inizializza messaging
  const { getMessaging, getToken } = await import("firebase/messaging");
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }

  // VAPID Key da env o configurazione
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  try {
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      // 4. Salva il token nel profilo utente su Firestore
      await registerFcmToken(userId, token);
      localStorage.setItem("pantry_fcm_token", token);
      return token;
    }
    return null;
  } catch (error: any) {
    console.error("[FCM] Errore nel recupero del token push:", error);
    throw new Error(
      error?.message || "Impossibile recuperare il token FCM. Verifica che la VAPID key sia configurata."
    );
  }
}

/**
 * Disabilita le notifiche push rimuovendo il token FCM corrente
 */
export async function disablePushNotifications(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  const token = localStorage.getItem("pantry_fcm_token");
  if (token && userId) {
    try {
      await unregisterFcmToken(userId, token);
    } catch (e) {
      console.warn("[FCM] Errore deregistrazione token:", e);
    }
  }

  try {
    if (messagingInstance) {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(messagingInstance);
    }
  } catch (e) {
    console.warn("[FCM] Errore cancellazione token locale:", e);
  }

  localStorage.removeItem("pantry_fcm_token");
}

/**
 * Sottoscrive un listener per le notifiche ricevute con l'app aperta in primo piano (foreground)
 */
export async function listenToForegroundNotifications(
  onNotificationReceived: (payload: { title: string; body: string; data?: any }) => void
): Promise<(() => void) | null> {
  const supported = await isPushNotificationSupported();
  if (!supported) return null;

  try {
    const { getMessaging, onMessage } = await import("firebase/messaging");
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    const unsubscribe = onMessage(messagingInstance, (payload: any) => {
      const title = payload.notification?.title || payload.data?.title || "Notifica da PantryAI";
      const body = payload.notification?.body || payload.data?.body || "";
      onNotificationReceived({ title, body, data: payload.data });
    });

    return unsubscribe;
  } catch (err) {
    console.warn("[FCM] Impossibile avviare listener foreground:", err);
    return null;
  }
}
