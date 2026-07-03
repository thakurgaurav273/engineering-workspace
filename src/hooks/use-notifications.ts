import { useEffect, useRef } from "react";
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

/** Best-effort realtime subscription — falls back silently to the 30s poll if it can't connect. */
export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const token = getAccessToken();
    if (!token) return;

    let socket: Socket;
    try {
      socket = io("/notifications", { auth: { token }, reconnectionAttempts: 3 });
      socketRef.current = socket;
    } catch {
      return;
    }

    socket.on("notification:new", (notification: Notification) => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      toast(notification.title, { description: notification.body });
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
      const title = payload.notification?.title ?? "Grovyn One";
      const body = payload.notification?.body ?? "";
      const actionUrl = payload.data?.actionUrl;
      showBrowserNotification(
        title,
        body,
        actionUrl ? () => navigate({ to: actionUrl }) : undefined,
      );
    });
  }, [navigate]);
}
