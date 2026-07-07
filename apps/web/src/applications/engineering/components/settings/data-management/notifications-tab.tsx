import { Avatar, Badge } from "@/shared/components/primitives";
import { AdminDataTable, type AdminColumn } from "./admin-data-table";
import { avatarColor, userInitials, fullName, fmtDate } from "@/shared/lib/transforms";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
}

const columns: AdminColumn<NotificationRow>[] = [
  {
    key: "user",
    header: "User",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Avatar initials={userInitials(row.user.firstName, row.user.lastName)} color={avatarColor(row.user.id)} size="sm" src={row.user.avatarUrl} />
        <div className="min-w-0 truncate text-[12.5px]">{fullName(row.user.firstName, row.user.lastName)}</div>
      </div>
    ),
  },
  { key: "type", header: "Type", render: (row) => <Badge>{row.type.replaceAll("_", " ").toLowerCase()}</Badge> },
  {
    key: "title",
    header: "Title",
    className: "max-w-[200px]",
    render: (row) => <div className="truncate text-[12.5px] font-medium" title={row.title}>{row.title}</div>,
  },
  {
    key: "body",
    header: "Body",
    className: "max-w-[260px]",
    render: (row) => <div className="truncate text-[12px] text-muted-foreground" title={row.body}>{row.body}</div>,
  },
  { key: "isRead", header: "Read", render: (row) => <Badge tone={row.isRead ? "success" : "warning"}>{row.isRead ? "Read" : "Unread"}</Badge> },
  { key: "createdAt", header: "Created", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.createdAt)}</span> },
];

export function NotificationsTab() {
  return (
    <AdminDataTable<NotificationRow>
      resource="notifications"
      entityLabel="notification"
      entityLabelPlural="notifications"
      columns={columns}
      searchPlaceholder="Search title or body…"
    />
  );
}
