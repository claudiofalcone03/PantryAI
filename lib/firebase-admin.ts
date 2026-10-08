import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

/**
 * Inizializza Firebase Admin SDK come Singleton.
 * Supporta sia ambiente locale sia produzione serverless (Vercel).
 * 
 * Se sono fornite credenziali dedicate di Service Account (FIREBASE_SERVICE_ACCOUNT_KEY o
 * FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL), usa quelle.
 * Altrimenti in fallback usa il projectId con Google Application Default Credentials
 * o credenziali di default per lettura Firestore.
 */
function getFirebaseAdminApp(): App {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    return currentApps[0]!;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "pantryai-cee9e";

  // Scenario 1: JSON completo del service account in unica variabile stringa
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (e) {
      console.error("[Firebase Admin] Errore nel parsing di FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // Scenario 2: Variabili separate (adatte alla dashboard di Vercel)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Sostituisce eventuali \n raw salvati nelle env di Vercel
    privateKey = privateKey.replace(/\\n/g, "\n");
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  // Scenario 3: Default application credentials o projectId in ambiente Google Cloud / ADC
  return initializeApp({
    projectId,
  });
}

export const adminApp: App = getFirebaseAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
export const adminMessaging: Messaging = getMessaging(adminApp);
export { FieldValue as AdminFieldValue, Timestamp as AdminTimestamp };

