import { Avatar, Badge } from "@/components/primitives";
import { AdminDataTable, type AdminColumn } from "./admin-data-table";
import { avatarColor, userInitials, fullName, fmtDate } from "@/lib/transforms";

interface ReviewUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

interface ReviewRow {
  id: string;
  type: "self" | "manager";
  weekStart: string;
  rating: number | null;
  status: "draft" | "submitted";
  createdAt: string;
  reviewee: ReviewUser;
  reviewer: ReviewUser;
}

function UserCell({ user }: { user: ReviewUser }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar initials={userInitials(user.firstName, user.lastName)} color={avatarColor(user.id)} size="sm" src={user.avatarUrl} />
      <div className="min-w-0 truncate text-[12.5px]">{fullName(user.firstName, user.lastName)}</div>
    </div>
  );
}

const columns: AdminColumn<ReviewRow>[] = [
  { key: "reviewee", header: "Reviewee", render: (row) => <UserCell user={row.reviewee} /> },
  { key: "reviewer", header: "Reviewer", render: (row) => <UserCell user={row.reviewer} /> },
  { key: "type", header: "Type", render: (row) => <Badge className="capitalize">{row.type}</Badge> },
  { key: "weekStart", header: "Week", render: (row) => <span className="text-[12px] font-mono-num">{fmtDate(row.weekStart)}</span> },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge tone={row.status === "submitted" ? "success" : "warning"} className="capitalize">{row.status}</Badge>,
  },
  { key: "rating", header: "Rating", render: (row) => <span className="text-[12px] font-mono-num">{row.rating ?? "-"}</span> },
  { key: "createdAt", header: "Created", render: (row) => <span className="text-[12px] font-mono-num text-muted-foreground">{fmtDate(row.createdAt)}</span> },
];

export function ReviewsTab() {
  return (
    <AdminDataTable<ReviewRow>
      resource="reviews"
      entityLabel="review"
      entityLabelPlural="reviews"
      columns={columns}
      searchPlaceholder="Search wins, challenges, feedback…"
    />
  );
}
