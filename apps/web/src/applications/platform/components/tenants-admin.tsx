import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, Metric, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";
import { brand } from "@/shared/lib/brand";
import { OrgDetailDialog } from "@/applications/platform/components/org-detail-dialog";

// Tenants (SUPER_ADMIN). This platform has no separate tenant layer above organizations - an
// organization IS the tenant: the top-level account and isolation boundary. This lists every
// tenant/account (GET /platform/organizations) with its membership and installed-app footprint.

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  memberCount: number;
  userCount: number;
  appCount: number;
}

export function TenantsAdmin() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery<TenantRow[]>({
    queryKey: ["platform", "organizations"],
    queryFn: () => api.get("/platform/organizations"),
  });

  const tenants = data ?? [];
  const totals = useMemo(
    () => ({
      tenants: tenants.length,
      members: tenants.reduce((s, t) => s + t.memberCount, 0),
      apps: tenants.reduce((s, t) => s + t.appCount, 0),
    }),
    [tenants],
  );

  return (
    <>
      <PageHeader
        title="Tenants"
        description={`Every tenant on the platform - the top-level account and isolation boundary. In ${brand.name}, each organization is a tenant.`}
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Metric label="Tenants" value={totals.tenants} />
              <Metric label="Members" value={totals.members} />
              <Metric label="App installs" value={totals.apps} />
            </>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader title="Tenants" subtitle="All top-level accounts on the platform." />
          {isLoading ? (
            <div className="p-5 space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <EmptyState icon={<Building className="h-5 w-5" />} title="Couldn't load tenants" description="The endpoint returned an error. Confirm platform super-admin access." />
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Building className="h-5 w-5" />} title="No tenants" description="No tenants exist on the platform yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Tenant</th>
                    <th className="px-5 py-2 font-medium text-right">Members</th>
                    <th className="px-5 py-2 font-medium text-right">Apps</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className="cursor-pointer transition-colors hover:bg-accent/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-muted-foreground">
                            <Building className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{t.name}</div>
                            <div className="text-[12px] text-muted-foreground">@{t.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.memberCount}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{t.appCount}</td>
                      <td className="px-5 py-3">
                        <Badge tone={t.status === "SUSPENDED" ? "warning" : "success"}>
                          {t.status === "SUSPENDED" ? "Suspended" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </PageBody>
      <OrgDetailDialog orgId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
