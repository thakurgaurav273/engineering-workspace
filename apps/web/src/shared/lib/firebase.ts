import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";
import { brand } from "@/shared/lib/brand";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string | undefined;

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

/** Requests notification permission and retrieves an FCM token. Never throws - returns null on any failure or when Firebase isn't configured. */
export async function requestPushToken(): Promise<string | null> {
  if (!firebaseConfigured || !messaging || typeof window === "undefined") return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Service workers can't read env, so the platform branding for background
    // notifications travels as query params on the worker's URL.
    const swParams = new URLSearchParams({ name: brand.name, icon: brand.logoUrl });
    await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams}`);
    // .register() resolves once the registration exists, not once it's active -
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

/** Shows a real OS-level notification. Firefox/Safari require the tab to have Notification permission already granted - never throws. */
export function showBrowserNotification(title: string, body: string, onClick?: () => void, icon?: string): void {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, icon: icon || brand.logoUrl || undefined });
    if (onClick) notification.onclick = onClick;
  } catch {
    // ignore - never let a notification failure affect the app
  }
}
