import { Avatar, Badge, Progress } from "@/shared/components/primitives";
import { AdminDataTable, type AdminColumn } from "./admin-data-table";
import { avatarColor, userInitials, fullName, fmtDate } from "@/shared/lib/transforms";

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  status: "active" | "completed" | "archived";
  dueDate: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string | null };
}

const statusTone: Record<GoalRow["status"], "info" | "success" | "neutral"> = {
  active: "info",
  completed: "success",
  archived: "neutral",
};

const columns: AdminColumn<GoalRow>[] = [
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
  {
    key: "title",
    header: "Title",
    className: "max-w-[240px]",
    render: (row) => <div className="truncate text-[12.5px] font-medium" title={row.title}>{row.title}</div>,
  },
  { key: "status", header: "Status", render: (row) => <Badge tone={statusTone[row.status]} className="capitalize">{row.status}</Badge> },
  {
    key: "progress",
    header: "Progress",
    render: (row) => (
      <div className="w-24">
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mb-1">
          <span className="font-mono-num">{row.progress}%</span>
        </div>
        <Progress value={row.progress} />
      </div>
    ),
  },
  { key: "dueDate", header: "Due", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.dueDate)}</span> },
  { key: "createdAt", header: "Created", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.createdAt)}</span> },
];

export function GoalsTab() {
  return (
    <AdminDataTable<GoalRow>
      resource="goals"
      entityLabel="goal"
      entityLabelPlural="goals"
      columns={columns}
      searchPlaceholder="Search title or description…"
    />
  );
}
