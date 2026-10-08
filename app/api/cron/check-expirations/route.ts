import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging, AdminFieldValue } from "@/lib/firebase-admin";

/**
 * Endpoint per cron job (es. Vercel Cron, GitHub Actions o chiamata periodica)
 * Controlla gli alimenti in scadenza per ogni utente con notifiche abilitate
 * e invia notifiche push personalizzate ai loro dispositivi.
 */
export async function GET(req: NextRequest) {
  // Verifica di sicurezza (se CRON_SECRET è configurato)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const usersSnap = await adminDb.collection("users").get();
    const messaging = adminMessaging;
    const now = new Date();
    const results: Array<{ userId: string; email: string; sent: boolean; reason?: string }> = [];

    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      const userId = uDoc.id;
      const tokens: string[] = Array.isArray(uData.fcmTokens) ? uData.fcmTokens.filter(Boolean) : [];
      const prefs = uData.notificationPreferences || {
        enabled: true,
        notifyOnExpiryDays: 2,
        notifyOpenedProducts: true,
      };

      if (!prefs.enabled || tokens.length === 0) {
        continue;
      }

      const pantryIds: string[] = Array.isArray(uData.userProfilePantryIds)
        ? uData.userProfilePantryIds.filter(Boolean)
        : [];

      if (pantryIds.length === 0) continue;

      // Cerca prodotti delle dispense dell'utente
      const maxDays = prefs.notifyOnExpiryDays ?? 2;
      const thresholdDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

      const expiringItems: string[] = [];
      const invalidTokensForUser: string[] = [];

      for (const pId of pantryIds) {
        const prodSnap = await adminDb
          .collection("products")
          .where("productPantryId", "==", pId)
          .get();

        prodSnap.forEach((pDoc: any) => {
          const p = pDoc.data();
          const qty = p.productQuantity ?? 1;
          if (qty <= 0) return; // ignora terminati

          const expTs =
            prefs.notifyOpenedProducts && p.productOpenedExpiryAt
              ? p.productOpenedExpiryAt
              : p.expiryDateProduct;

          if (expTs && expTs.toDate) {
            const expDate = expTs.toDate();
            if (expDate <= thresholdDate) {
              const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const label = daysLeft <= 0 ? `${p.productName} (Oggi!)` : `${p.productName} (tra ${daysLeft}g)`;
              if (!expiringItems.includes(label)) {
                expiringItems.push(label);
              }
            }
          }
        });
      }

      if (expiringItems.length > 0) {
        const title = `⚠️ ${expiringItems.length} alimenti in scadenza!`;
        const body = `Controlla la dispensa: ${expiringItems.slice(0, 3).join(", ")}${
          expiringItems.length > 3 ? ` e altri ${expiringItems.length - 3}` : ""
        }.`;

        try {
          const resp = await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title,
              body,
            },
            data: {
              url: "/inventario?filtro=scadenza",
              timestamp: Date.now().toString(),
            },
            webpush: {
              fcmOptions: { link: "/inventario?filtro=scadenza" },
              notification: {
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                vibrate: [200, 100, 200],
              },
            },
          });

          // Pulizia token non validi
          resp.responses.forEach((r: any, idx: number) => {
            if (!r.success) {
              const code = r.error?.code;
              if (
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token"
              ) {
                invalidTokensForUser.push(tokens[idx]);
              }
            }
          });

          if (invalidTokensForUser.length > 0) {
            await adminDb.collection("users").doc(userId).update({
              fcmTokens: AdminFieldValue.arrayRemove(...invalidTokensForUser),
            });
          }

          results.push({ userId, email: uData.userEmail, sent: true });
        } catch (err: any) {
          results.push({ userId, email: uData.userEmail, sent: false, reason: err.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedUsers: results.length,
      timestamp: now.toISOString(),
      details: results,
    });
  } catch (error: any) {
    console.error("[CRON check-expirations] Errore esecuzione:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
