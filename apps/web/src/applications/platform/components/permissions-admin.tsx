import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, Metric, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";

// Permissions catalog + endpoint coverage (read-only). Sourced from the real SUPER_ADMIN
// endpoints GET /platform/permissions and GET /platform/permissions/endpoints. Field names
// are read defensively since the endpoint-audit shape may vary.

interface PermissionSummary {
  discovered: number;
  persisted: number;
  byApplication: Record<string, number>;
}

interface EndpointRow {
  method?: string;
  path?: string;
  route?: string;
  handler?: string;
  permission?: string | null;
}

interface EndpointsAudit {
  total: number;
  mapped: number;
  missing: number;
  endpoints: EndpointRow[];
}

function endpointLabel(e: EndpointRow): string {
  const route = e.route ?? e.path ?? e.handler ?? "";
  return e.method ? `${e.method.toUpperCase()} ${route}` : route;
}

export function PermissionsAdmin() {
  const summaryQuery = useQuery<PermissionSummary>({
    queryKey: ["platform", "permissions", "summary"],
    queryFn: () => api.get("/platform/permissions"),
  });

  const endpointsQuery = useQuery<EndpointsAudit>({
    queryKey: ["platform", "permissions", "endpoints"],
    queryFn: () => api.get("/platform/permissions/endpoints"),
  });

  const summary = summaryQuery.data;
  const audit = endpointsQuery.data;

  const byApplication = useMemo(
    () => Object.entries(summary?.byApplication ?? {}).sort((a, b) => b[1] - a[1]),
    [summary],
  );

  const endpoints = audit?.endpoints ?? [];

  return (
    <>
      <PageHeader
        title="Permissions"
        description="The permission catalog discovered from every application, and endpoint coverage."
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {summaryQuery.isLoading || endpointsQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Metric label="Discovered" value={summary?.discovered ?? 0} />
              <Metric label="Persisted" value={summary?.persisted ?? 0} />
              <Metric label="Endpoints" value={audit?.total ?? 0} />
              <Metric label="Mapped" value={audit?.mapped ?? 0} />
              <Metric label="Missing" value={audit?.missing ?? 0} />
            </>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader title="Permissions by application" subtitle="Permission keys contributed by each application manifest." />
          {summaryQuery.isLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : byApplication.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<KeyRound className="h-5 w-5" />}
                title="No permissions discovered"
                description="No application manifest contributed a permission catalog."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {byApplication.map(([app, count]) => (
                <li key={app} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-[13px] font-medium text-foreground">{app}</span>
                  <span className="text-[12px] tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardHeader title="Endpoint coverage" subtitle="Each API endpoint and the permission it declares (if any)." />
          {endpointsQuery.isLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : endpointsQuery.isError ? (
            <div className="p-6">
              <EmptyState
                icon={<KeyRound className="h-5 w-5" />}
                title="Couldn't load endpoint coverage"
                description="The endpoint-audit endpoint returned an error. Confirm platform super-admin access."
              />
            </div>
          ) : endpoints.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<KeyRound className="h-5 w-5" />}
                title="No endpoints reported"
                description="The endpoint audit returned no rows."
              />
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Endpoint</th>
                    <th className="px-5 py-2 font-medium">Permission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {endpoints.map((e, i) => (
                    <tr key={`${endpointLabel(e)}-${i}`}>
                      <td className="px-5 py-2 font-mono text-[11.5px] text-foreground">{endpointLabel(e)}</td>
                      <td className="px-5 py-2">
                        {e.permission ? (
                          <span className="font-mono text-[11.5px] text-muted-foreground">{e.permission}</span>
                        ) : (
                          <Badge tone="warning">missing</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
