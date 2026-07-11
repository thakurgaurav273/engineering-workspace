import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, Metric, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api, type Paginated } from "@/shared/lib/api";

// Platform-wide health overview for SUPER_ADMIN: application catalog, install state,
// user/role/permission counts. Read-only - mirrors the diagnostics already exposed by
// /platform/applications, /platform/installations, /platform/permissions and /platform/roles.

interface AppNavItem {
  label: string;
  path: string;
  icon: string;
  exact?: boolean;
}

interface ApplicationManifest {
  key: string;
  name: string;
  description: string;
  category: string;
  status: string;
  version: string;
  order: number;
  navigation: AppNavItem[];
  permissions: string[];
}

interface Installation {
  orgId: string;
  applicationKey: string;
  state: "INSTALLED" | "DISABLED" | "MAINTENANCE" | "UNINSTALLED";
}

interface PermissionSummary {
  discovered: number;
  persisted: number;
  byApplication: Record<string, number>;
}

interface PlatformRoleRow {
  id: string;
  key: string;
  name: string;
  scope: string;
  isSystem: boolean;
}

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
  MAINTENANCE: "warning",
  EXPERIMENTAL: "info",
  COMING_SOON: "neutral",
};

export function PlatformDashboard() {
  const applicationsQuery = useQuery<ApplicationManifest[]>({
    queryKey: ["platform", "dashboard", "applications"],
    queryFn: () => api.get("/platform/applications"),
  });

  const installationsQuery = useQuery<Installation[]>({
    queryKey: ["platform", "dashboard", "installations"],
    queryFn: () => api.get("/platform/installations"),
  });

  const usersQuery = useQuery<Paginated<unknown>>({
    queryKey: ["platform", "dashboard", "users"],
    queryFn: () => api.get("/users?page=1&limit=1"),
  });

  const permissionsQuery = useQuery<PermissionSummary>({
    queryKey: ["platform", "dashboard", "permissions"],
    queryFn: () => api.get("/platform/permissions"),
  });

  const rolesQuery = useQuery<PlatformRoleRow[]>({
    queryKey: ["platform", "dashboard", "roles"],
    queryFn: () => api.get("/platform/roles"),
  });

  const applications = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);
  const installations = useMemo(() => installationsQuery.data ?? [], [installationsQuery.data]);

  const applicationCount = applicationsQuery.isError ? 0 : applications.length;
  const installedCount = installationsQuery.isError
    ? 0
    : installations.filter((i) => i.state === "INSTALLED").length;
  const userCount = usersQuery.isError ? 0 : (usersQuery.data?.total ?? 0);
  const roleCount = rolesQuery.isError ? 0 : (rolesQuery.data?.length ?? 0);
  const permissionCount = permissionsQuery.isError ? 0 : (permissionsQuery.data?.discovered ?? 0);

  const statsLoading =
    applicationsQuery.isLoading ||
    installationsQuery.isLoading ||
    usersQuery.isLoading ||
    permissionsQuery.isLoading ||
    rolesQuery.isLoading;

  return (
    <>
      <PageHeader title="Platform Dashboard" description="Platform-wide health at a glance." />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {statsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Metric label="Applications" value={applicationCount} />
              <Metric label="Installed" value={installedCount} />
              <Metric label="Users" value={userCount} />
              <Metric label="Roles" value={roleCount} />
              <Metric label="Permissions" value={permissionCount} />
            </>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader title="Applications" subtitle="Every registered application in the platform catalog." />
          {applicationsQuery.isLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : applications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<LayoutGrid className="h-5 w-5" />}
                title="No applications registered"
                description="Nothing is registered in the platform application catalog yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ul className="divide-y divide-border min-w-[480px]">
                {applications.map((app) => (
                  <li key={app.key} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground">{app.name}</div>
                      <div className="text-[12px] text-muted-foreground">{app.category}</div>
                    </div>
                    <Badge tone={STATUS_TONE[app.status] ?? "neutral"} className="shrink-0">
                      {app.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
