import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging, AdminFieldValue } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, title, message } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId obbligatorio" }, { status: 400 });
    }

    // 1. Recupera il profilo utente e i suoi token FCM
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    const userData = userDoc.data();
    const tokens: string[] = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens.filter(Boolean) : [];

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: "Nessun dispositivo registrato per le notifiche push. Abilita prima le notifiche su questo dispositivo." },
        { status: 400 }
      );
    }

    // 2. Prepara il payload della notifica
    const notificationTitle = title || "Notifica di Prova PantryAI";
    const notificationBody = message || "Le notifiche push sul tuo dispositivo sono attive e funzionanti!";

    const messaging = adminMessaging;
    const multicastMessage = {
      tokens,
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        url: "/inventario",
        timestamp: Date.now().toString(),
      },
      webpush: {
        fcmOptions: {
          link: "/inventario",
        },
        notification: {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [100, 50, 100],
        },
      },
    };

    // 3. Invia a tutti i dispositivi registrati dell'utente
    const response = await messaging.sendEachForMulticast(multicastMessage);

    // 4. Pulizia automatica dei token non più validi
    const invalidTokens: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await adminDb.collection("users").doc(userId).update({
        fcmTokens: AdminFieldValue.arrayRemove(...invalidTokens),
      });
    }

    return NextResponse.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalDevices: tokens.length,
    });
  } catch (error: any) {
    console.error("[API Notifications Test] Errore invio notifica:", error);
    return NextResponse.json(
      { error: error?.message || "Errore interno durante l'invio della notifica." },
      { status: 500 }
    );
  }
}
