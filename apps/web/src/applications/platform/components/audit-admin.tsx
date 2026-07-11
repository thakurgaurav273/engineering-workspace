import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader, PageBody, Card, Badge, EmptyState, Skeleton, Button } from "@grovyn/ui/primitives";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@grovyn/ui/components/select";
import { api, type Paginated } from "@/shared/lib/api";

// Platform audit trail. Paginated + action-filterable read of GET /platform/audit - records
// privileged platform-admin actions (app-access grants/revokes, feature-flag flips) captured
// by the backend AuditService.

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string | null;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  orgId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ALL = "__all__";

export function AuditAdmin() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>(ALL);

  const actionsQuery = useQuery<string[]>({
    queryKey: ["platform", "audit", "actions"],
    queryFn: () => api.get("/platform/audit/actions"),
  });

  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (action !== ALL) query.set("action", action);

  const { data, isLoading, isError } = useQuery<Paginated<AuditRow>>({
    queryKey: ["platform", "audit", page, action],
    queryFn: () => api.get(`/platform/audit?${query.toString()}`),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <PageHeader title="Audit" description="Platform-wide trail of privileged administrative actions." />
      <PageBody className="space-y-4">
        <div className="flex items-center gap-3">
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {(actionsQuery.data ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <EmptyState
                icon={<ScrollText className="h-5 w-5" />}
                title="Couldn't load the audit trail"
                description="The audit endpoint returned an error. Confirm platform super-admin access."
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ScrollText className="h-5 w-5" />}
                title="No audit events"
                description="No privileged actions have been recorded yet. Grant app access or flip a feature flag to see entries here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">When</th>
                    <th className="px-5 py-2 font-medium">Action</th>
                    <th className="px-5 py-2 font-medium">Actor</th>
                    <th className="px-5 py-2 font-medium">Target</th>
                    <th className="px-5 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-5 py-2 text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-2">
                        <Badge tone="info">{row.action}</Badge>
                      </td>
                      <td className="px-5 py-2 text-foreground">{row.actorEmail ?? row.actorId ?? "system"}</td>
                      <td className="px-5 py-2 text-muted-foreground">
                        {row.targetType ? `${row.targetType}:${row.targetId ?? "?"}` : "-"}
                      </td>
                      <td className="px-5 py-2 font-mono text-[11px] text-muted-foreground">
                        {Object.keys(row.metadata ?? {}).length ? JSON.stringify(row.metadata) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {!isLoading && !isError && rows.length > 0 && (
          <div className="flex items-center justify-end gap-3">
            <span className="text-[12px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </PageBody>
    </>
  );
}
