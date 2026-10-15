import { createElement, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import type { Paginated } from "@/shared/lib/api";
import {
  notificationsApi,
  type Notification,
  type NotificationPreferences,
} from "@/shared/lib/notifications";
import { getAccessToken, isAuthenticated } from "@/platform/auth/auth";
import { onForegroundMessage, showBrowserNotification } from "@/shared/lib/firebase";
import { brand } from "@/shared/lib/brand";

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

type ListSnapshot = [readonly unknown[], Paginated<Notification> | undefined][];

/** Cancel in-flight refetches and snapshot the list + unread-count caches so an optimistic
 *  update can be rolled back if the mutation fails. */
async function snapshotNotifications(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: LIST_KEY }),
    queryClient.cancelQueries({ queryKey: UNREAD_COUNT_KEY }),
  ]);
  return {
    prevLists: queryClient.getQueriesData<Paginated<Notification>>({
      queryKey: LIST_KEY,
    }) as ListSnapshot,
    prevCount: queryClient.getQueryData<{ count: number }>(UNREAD_COUNT_KEY),
  };
}

function rollbackNotifications(
  queryClient: ReturnType<typeof useQueryClient>,
  ctx: { prevLists: ListSnapshot; prevCount?: { count: number } } | undefined,
) {
  ctx?.prevLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
  if (ctx?.prevCount) queryClient.setQueryData(UNREAD_COUNT_KEY, ctx.prevCount);
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: async (id) => {
      const ctx = await snapshotNotifications(queryClient);
      // Only the item being marked flips to read; count drops only if it was actually unread.
      const wasUnread = ctx.prevLists.some(([, data]) =>
        data?.data.some((n) => n.id === id && !n.isRead),
      );
      queryClient.setQueriesData<Paginated<Notification>>({ queryKey: LIST_KEY }, (old) =>
        old
          ? { ...old, data: old.data.map((n) => (n.id === id ? { ...n, isRead: true } : n)) }
          : old,
      );
      if (wasUnread && ctx.prevCount) {
        queryClient.setQueryData(UNREAD_COUNT_KEY, { count: Math.max(0, ctx.prevCount.count - 1) });
      }
      return ctx;
    },
    onError: (_err, _id, ctx) => {
      rollbackNotifications(queryClient, ctx);
      toast.error("Couldn't mark notification as read");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onMutate: async () => {
      const ctx = await snapshotNotifications(queryClient);
      queryClient.setQueriesData<Paginated<Notification>>({ queryKey: LIST_KEY }, (old) =>
        old ? { ...old, data: old.data.map((n) => ({ ...n, isRead: true })) } : old,
      );
      queryClient.setQueryData(UNREAD_COUNT_KEY, { count: 0 });
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      rollbackNotifications(queryClient, ctx);
      toast.error("Couldn't mark all as read");
    },
    onSettled: () => {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL as string | undefined;
      socket = io(`${apiUrl ?? ""}/notifications`, { auth: { token }, reconnectionAttempts: 3 });
      socketRef.current = socket;
    } catch {
      return;
    }

    socket.on("notification:new", (notification: Notification) => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      const avatarUrl =
        typeof notification.metadata?.avatarUrl === "string"
          ? notification.metadata.avatarUrl
          : undefined;
      toast(notification.title, {
        description: notification.body,
        icon: avatarUrl
          ? createElement("img", {
              src: avatarUrl,
              alt: "",
              className: "h-6 w-6 rounded-full object-cover",
            })
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
  const navigate = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) return;

    onForegroundMessage((payload) => {
      // Data-only payload (see backend firebase-push.provider.ts) - payload.notification
      // is never set for messages we send now.
      const title = payload.data?.title ?? brand.name;
      const body = payload.data?.body ?? "";
      const actionUrl = payload.data?.actionUrl;
      showBrowserNotification(
        title,
        body,
        actionUrl ? () => navigate.push(actionUrl) : undefined,
        payload.data?.avatarUrl,
      );
    });
  }, [navigate]);
}
