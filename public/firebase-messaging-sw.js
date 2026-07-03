// Firebase Cloud Messaging service worker.
//
// Service workers can't read Vite's import.meta.env, so this config is
// hardcoded to match the VITE_FIREBASE_* values in the root .env. If you
// rotate the Firebase web app config, update both places.
// Take over from any previously-installed version of this worker immediately,
// instead of waiting for all tabs to close — avoids a stale SW (e.g. one
// registered before real Firebase config existed) silently continuing to
// handle push events with outdated/invalid config.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBjSyYJkbUiaWgL9dY-KEbeeEvGhMa-uAA",
  authDomain: "grovyn-one.firebaseapp.com",
  projectId: "grovyn-one",
  storageBucket: "grovyn-one.firebasestorage.app",
  messagingSenderId: "17340347060",
  appId: "1:17340347060:web:e37e67a402946545a99de1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Grovyn One";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, { body, icon: "/grovyn_logo.png" });
});
