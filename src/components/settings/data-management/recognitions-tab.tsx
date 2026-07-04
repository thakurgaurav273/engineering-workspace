import { Avatar } from "@/components/primitives";
import { AdminDataTable, type AdminColumn } from "./admin-data-table";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";

interface RecognitionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

interface RecognitionRow {
  id: string;
  title: string;
  note: string | null;
  createdAt: string;
  author: RecognitionUser;
  recipient: RecognitionUser;
}

function UserCell({ user }: { user: RecognitionUser }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar initials={userInitials(user.firstName, user.lastName)} color={avatarColor(user.id)} size="sm" src={user.avatarUrl} />
      <div className="min-w-0 truncate text-[12.5px]">{fullName(user.firstName, user.lastName)}</div>
    </div>
  );
}

const columns: AdminColumn<RecognitionRow>[] = [
  { key: "author", header: "From", render: (row) => <UserCell user={row.author} /> },
  { key: "recipient", header: "To", render: (row) => <UserCell user={row.recipient} /> },
  {
    key: "title",
    header: "Title",
    className: "max-w-[220px]",
    render: (row) => <div className="truncate text-[12.5px] font-medium" title={row.title}>{row.title}</div>,
  },
  {
    key: "note",
    header: "Note",
    className: "max-w-[240px]",
    render: (row) => <div className="truncate text-[12px] text-muted-foreground" title={row.note ?? ""}>{row.note || "-"}</div>,
  },
  { key: "createdAt", header: "Created", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.createdAt)}</span> },
];

export function RecognitionsTab() {
  return (
    <AdminDataTable<RecognitionRow>
      resource="recognitions"
      entityLabel="recognition"
      entityLabelPlural="recognitions"
      columns={columns}
      searchPlaceholder="Search title or note…"
    />
  );
}
