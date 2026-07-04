import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Check,
  X,
  ClipboardCheck,
  Target,
  FileText,
  Sparkles,
  Trophy,
  Megaphone,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/transforms";
import { Avatar } from "@/components/primitives";
import type { Notification, NotificationType } from "@/lib/notifications";
import {
  useUnreadCount,
  useNotificationsList,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from "@/hooks/use-notifications";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  CHECK_IN_CREATED: ClipboardCheck,
  CHECK_IN_REMINDER: ClipboardCheck,
  GOAL_ASSIGNED: Target,
  GOAL_UPDATED: Target,
  RECOGNITION_RECEIVED: Sparkles,
  REVIEW_REQUESTED: FileText,
  REVIEW_COMPLETED: FileText,
  LINEAR_ISSUE_ASSIGNED: Trophy,
  LINEAR_ISSUE_UPDATED: Trophy,
  SYSTEM: Megaphone,
  WORKSPACE_ITEM_ASSIGNED: ListTodo,
  WORKSPACE_ITEM_REMINDER: ListTodo,
  WORKSPACE_ITEM_COMMENT: MessageSquare,
};

function NotificationAvatar({ n }: { n: Notification }) {
  const avatarUrl = typeof n.metadata?.avatarUrl === "string" ? n.metadata.avatarUrl : undefined;
  if (avatarUrl) return <Avatar src={avatarUrl} initials="" color="bg-muted" size="sm" />;
  const Icon = TYPE_ICON[n.type] ?? Bell;
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: unread } = useUnreadCount();
  const { data: list, isLoading } = useNotificationsList();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const remove = useDeleteNotification();

  const count = unread?.count ?? 0;
  const notifications = list?.data ?? [];

  const handleSelect = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.actionUrl) navigate({ to: n.actionUrl });
  };

  return (
    <div className="relative">
      <button
        className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent text-muted-foreground relative"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-[3px] grid place-items-center rounded-full bg-destructive text-white text-[9px] font-semibold leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <span className="text-[13px] font-semibold">Notifications</span>
              {count > 0 && (
                <button
                  className="text-[11.5px] text-muted-foreground hover:text-foreground"
                  onClick={() => markAllRead.mutate()}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading && (
                <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                  Loading…
                </div>
              )}
              {!isLoading && notifications.length === 0 && (
                <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                  No notifications yet
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group flex items-start gap-2 px-3 py-2.5 border-b border-border last:border-b-0 cursor-pointer hover:bg-accent/60 transition-colors",
                    !n.isRead && "bg-accent/30",
                  )}
                  onClick={() => handleSelect(n)}
                >
                  {!n.isRead && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                  )}
                  <NotificationAvatar n={n} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium truncate">{n.title}</div>
                    <div className="text-[11.5px] text-muted-foreground line-clamp-2">{n.body}</div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!n.isRead && (
                      <button
                        className="grid h-5 w-5 place-items-center rounded hover:bg-accent text-muted-foreground"
                        title="Mark as read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead.mutate(n.id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      className="grid h-5 w-5 place-items-center rounded hover:bg-accent text-muted-foreground"
                      title="Dismiss"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(n.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
