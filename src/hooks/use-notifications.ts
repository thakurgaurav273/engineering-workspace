import { createElement, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  notificationsApi,
  type Notification,
  type NotificationPreferences,
} from "@/lib/notifications";
import { getAccessToken, isAuthenticated } from "@/lib/auth";
import { onForegroundMessage, showBrowserNotification } from "@/lib/firebase";

const UNREAD_COUNT_KEY = ["notifications", "unread-count"];
const LIST_KEY = ["notifications", "list"];

export function useUnreadCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    enabled: isAuthenticated(),
    refetchInterval: 30000,
  });
}

export function useNotificationsList(params: { isRead?: boolean } = {}) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => notificationsApi.list({ limit: 20, ...params }),
    enabled: isAuthenticated(),
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => notificationsApi.getPreferences(),
    enabled: isAuthenticated(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

/** Best-effort realtime subscription - falls back silently to the 30s poll if it can't connect. */
export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const token = getAccessToken();
    if (!token) return;

    let socket: Socket;
    try {
      // Same VITE_API_URL used for REST calls - connects directly to the
      // backend origin when frontend/backend are on separate domains;
      // falls back to same-origin (Vite dev proxy) when unset.
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
      socket = io(`${apiUrl ?? ""}/notifications`, { auth: { token }, reconnectionAttempts: 3 });
      socketRef.current = socket;
    } catch {
      return;
    }

    socket.on("notification:new", (notification: Notification) => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      const avatarUrl = typeof notification.metadata?.avatarUrl === "string" ? notification.metadata.avatarUrl : undefined;
      toast(notification.title, {
        description: notification.body,
        icon: avatarUrl
          ? createElement("img", { src: avatarUrl, alt: "", className: "h-6 w-6 rounded-full object-cover" })
          : undefined,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);
}

/** Shows a real OS-level notification when FCM delivers a push while the tab is focused (the SW handles it when backgrounded). */
export function useForegroundPush() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated()) return;

    onForegroundMessage((payload) => {
      // Data-only payload (see backend firebase-push.provider.ts) - payload.notification
      // is never set for messages we send now.
      const title = payload.data?.title ?? "Grovyn One";
      const body = payload.data?.body ?? "";
      const actionUrl = payload.data?.actionUrl;
      showBrowserNotification(
        title,
        body,
        actionUrl ? () => navigate({ to: actionUrl }) : undefined,
        payload.data?.avatarUrl,
      );
    });
  }, [navigate]);
}
