import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && vapidKey);

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

if (firebaseConfigured && typeof window !== "undefined") {
  try {
    app = initializeApp(config);
    messaging = getMessaging(app);
  } catch {
    app = null;
    messaging = null;
  }
}

/** Requests notification permission and retrieves an FCM token. Never throws — returns null on any failure or when Firebase isn't configured. */
export async function requestPushToken(): Promise<string | null> {
  if (!firebaseConfigured || !messaging || typeof window === "undefined") return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    // .register() resolves once the registration exists, not once it's active —
    // PushManager.subscribe() (called internally by getToken()) requires an
    // active worker, so wait for `ready` to avoid a race on first install.
    const registration = await navigator.serviceWorker.ready;
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch {
    return null;
  }
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void): void {
  if (!messaging) return;
  onMessage(messaging, callback);
}

/** Shows a real OS-level notification. Firefox/Safari require the tab to have Notification permission already granted — never throws. */
export function showBrowserNotification(title: string, body: string, onClick?: () => void): void {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, icon: "/grovyn_logo.png" });
    if (onClick) notification.onclick = onClick;
  } catch {
    // ignore — never let a notification failure affect the app
  }
}
