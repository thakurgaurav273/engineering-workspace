import { api, type Paginated } from "./api";
import { requestPushToken } from "./firebase";
import { storePushToken } from "./auth";

export type NotificationType =
  | "CHECK_IN_CREATED"
  | "CHECK_IN_REMINDER"
  | "GOAL_ASSIGNED"
  | "GOAL_UPDATED"
  | "RECOGNITION_RECEIVED"
  | "REVIEW_REQUESTED"
  | "REVIEW_COMPLETED"
  | "LINEAR_ISSUE_ASSIGNED"
  | "LINEAR_ISSUE_UPDATED"
  | "SYSTEM"
  | "WORKSPACE_ITEM_ASSIGNED"
  | "WORKSPACE_ITEM_REMINDER";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPreferences {
  checkIns: boolean;
  reviews: boolean;
  recognition: boolean;
  goals: boolean;
  linearActivity: boolean;
  systemAnnouncements: boolean;
}

export const notificationsApi = {
  list: (params: { page?: number; limit?: number; isRead?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.isRead !== undefined) qs.set("isRead", String(params.isRead));
    const query = qs.toString();
    return api.get<Paginated<Notification>>(`/notifications${query ? `?${query}` : ""}`);
  },
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ message: string }>("/notifications/read-all"),
  remove: (id: string) => api.delete<{ message: string }>(`/notifications/${id}`),
  getPreferences: () => api.get<NotificationPreferences>("/notifications/preferences"),
  updatePreferences: (body: Partial<NotificationPreferences>) =>
    api.patch<NotificationPreferences>("/notifications/preferences", body),
  registerDevice: (body: {
    token: string;
    platform: "WEB" | "ANDROID" | "IOS";
    browser?: string;
    deviceName?: string;
  }) => api.post("/notifications/devices", body),
  unregisterDevice: (token: string) =>
    api.delete(`/notifications/devices/${encodeURIComponent(token)}`),
};

/** Fire-and-forget: requests push permission and registers this device. Never throws — safe to call unawaited right after login. */
export async function registerCurrentDevice(): Promise<void> {
  const token = await requestPushToken();
  if (!token) return;
  try {
    await notificationsApi.registerDevice({ token, platform: "WEB", browser: navigator.userAgent });
    storePushToken(token);
  } catch (err) {
    // best-effort — must never block the login flow
    console.warn("[push] failed to register device:", err);
  }
}
