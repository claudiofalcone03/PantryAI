import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache icone e manifest
    {
      matcher: ({ url }) => url.pathname.startsWith("/icons/") || url.pathname.endsWith(".webmanifest") || url.pathname.endsWith(".json"),
      handler: new StaleWhileRevalidate({
        cacheName: "pantry-static-manifest",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 giorni
          }),
        ],
      }),
    },
    // Cache immagini esterne Open Food Facts
    {
      matcher: ({ url }) => url.hostname.includes("openfoodfacts.org") || url.hostname.includes("googleusercontent.com"),
      handler: new CacheFirst({
        cacheName: "pantry-external-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 120,
            maxAgeSeconds: 60 * 60 * 24 * 14, // 14 giorni
          }),
        ],
      }),
    },
    // Caching predefinito di Serwist per le route Next.js
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// ===============================================================
// WEB PUSH NOTIFICATIONS & BACKGROUND HANDLERS
// ===============================================================

// Ascolto eventi Push in background
self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notification = payload.notification || payload.data || {};
    const title = notification.title || "PantryAI";
    const body = notification.body || "Hai una notifica per la tua dispensa.";
    const clickUrl = payload.data?.url || notification.click_action || "/inventario";

    const options = {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        url: clickUrl,
        timestamp: Date.now(),
      },
      actions: [
        { action: "open", title: "Controlla Dispensa" },
        { action: "close", title: "Chiudi" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Fallback se il payload è semplice testo
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("PantryAI", {
        body: text,
        icon: "/icons/icon-192x192.png",
        data: { url: "/inventario" },
      })
    );
  }
});

// Gestione click sulla notifica
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/inventario";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any[]) => {
      // Se c'è già una finestra aperta dell'app, focalizzala
      for (const client of clientList) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

