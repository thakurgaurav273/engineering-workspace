import { Avatar } from "@/components/primitives";
import { StatusBadge } from "@/components/primitives";
import { AdminDataTable, type AdminColumn } from "./admin-data-table";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";
import type { Status } from "@/lib/mock-data";

interface CheckInRow {
  id: string;
  status: Status;
  summary: string;
  blockers: string | null;
  date: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
}

const columns: AdminColumn<CheckInRow>[] = [
  {
    key: "user",
    header: "User",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Avatar initials={userInitials(row.user.firstName, row.user.lastName)} color={avatarColor(row.user.id)} size="sm" src={row.user.avatarUrl} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium">{fullName(row.user.firstName, row.user.lastName)}</div>
          <div className="truncate text-[11px] text-muted-foreground">{row.user.email}</div>
        </div>
      </div>
    ),
  },
  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  {
    key: "summary",
    header: "Summary",
    className: "max-w-[280px]",
    render: (row) => <div className="truncate text-[12.5px]" title={row.summary}>{row.summary}</div>,
  },
  { key: "date", header: "Date", render: (row) => <span className="text-[12px] font-mono-num">{fmtDate(row.date)}</span> },
  { key: "createdAt", header: "Created", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.createdAt)}</span> },
];

export function CheckInsTab() {
  return (
    <AdminDataTable<CheckInRow>
      resource="check-ins"
      entityLabel="check-in"
      entityLabelPlural="check-ins"
      columns={columns}
      searchPlaceholder="Search summary or blockers…"
    />
  );
}
