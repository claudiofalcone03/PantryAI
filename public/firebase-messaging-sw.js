/**
 * PantryAI - Firebase Cloud Messaging Service Worker Fallback
 * Utilizzato da Firebase Web SDK se la registrazione custom non è specificata.
 */

/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Inizializza l'app Firebase nel Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyD-Lr1yJei3P_AT1uE5sTDNK9EL0bnTgU4",
  authDomain: "pantryai-cee9e.firebaseapp.com",
  projectId: "pantryai-cee9e",
  storageBucket: "pantryai-cee9e.firebasestorage.app",
  messagingSenderId: "681399674727",
  appId: "1:681399674727:web:abf4a3c408c293c8eaf1c2",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || "PantryAI";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Hai una notifica per la tua dispensa.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    data: {
      url: payload.data?.url || "/inventario",
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/inventario";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client && url) {
            client.navigate(url);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
