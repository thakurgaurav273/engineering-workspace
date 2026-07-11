import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { AppWindow, ShieldCheck } from "lucide-react";
import { PageHeader, PageBody, Card, Badge, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";
import {
  iconFor,
  CATEGORY_LABELS,
  ApplicationStatus,
  type ApplicationManifest,
} from "@/platform/registry/app-registry";

// Read-only catalog of every registered application plus its live health, for a platform
// SUPER_ADMIN. Mirrors GET /platform/applications, GET /platform/installations, and
// GET /platform/applications/{key}/health. No install/uninstall controls here - this is a
// catalog + health view, not the installation-management screen.

interface Installation {
  orgId: string;
  applicationKey: string;
  state: string;
}

interface ApplicationHealth {
  status: "ok" | "degraded" | "down";
  application: string;
  details?: unknown;
}

type HealthState = "ok" | "degraded" | "down" | "unknown";

const STATUS_TONE: Record<ApplicationStatus, "neutral" | "info" | "success" | "warning"> = {
  [ApplicationStatus.ACTIVE]: "success",
  [ApplicationStatus.EXPERIMENTAL]: "warning",
  [ApplicationStatus.MAINTENANCE]: "info",
  [ApplicationStatus.COMING_SOON]: "neutral",
  [ApplicationStatus.DISABLED]: "neutral",
};

const HEALTH_DOT: Record<HealthState, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
  unknown: "bg-muted-foreground/40",
};

const HEALTH_LABEL: Record<HealthState, string> = {
  ok: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

const APPLICATIONS_KEY = ["platform", "applications"] as const;
const INSTALLATIONS_KEY = ["platform", "installations"] as const;

export function ApplicationsAdmin() {
  const { data: apps, isLoading: appsLoading } = useQuery<ApplicationManifest[]>({
    queryKey: APPLICATIONS_KEY,
    queryFn: () => api.get("/platform/applications"),
  });

  const { data: installations } = useQuery<Installation[]>({
    queryKey: INSTALLATIONS_KEY,
    queryFn: () => api.get("/platform/installations"),
  });

  const sortedApps = useMemo(
    () => [...(apps ?? [])].sort((a, b) => a.order - b.order),
    [apps],
  );

  // Count only INSTALLED orgs per app key - UNINSTALLED/DISABLED rows still exist in the
  // table (they record intent to leave/pause an app) but shouldn't count as "installed".
  const installedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inst of installations ?? []) {
      if (inst.state !== "INSTALLED") continue;
      counts.set(inst.applicationKey, (counts.get(inst.applicationKey) ?? 0) + 1);
    }
    return counts;
  }, [installations]);

  // One health check per app, fetched in parallel once the catalog has loaded. A failed
  // fetch (network error, 404, etc.) degrades to "unknown" rather than crashing the page.
  const healthQueries = useQueries({
    queries: sortedApps.map((app) => ({
      queryKey: ["platform", "applications", app.key, "health"],
      queryFn: () => api.get<ApplicationHealth>(`/platform/applications/${app.key}/health`),
      retry: false,
      staleTime: 60 * 1000,
    })),
  });

  return (
    <>
      <PageHeader
        title="Applications"
        description="The application registry and where each app is installed."
      />
      <PageBody>
        {appsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </Card>
            ))}
          </div>
        ) : sortedApps.length === 0 ? (
          <EmptyState
            icon={<AppWindow className="h-5 w-5" />}
            title="No applications registered"
            description="No applications are currently registered in the platform catalog."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedApps.map((app, index) => {
              const Icon = iconFor(app.icon);
              const tone = STATUS_TONE[app.status] ?? "neutral";
              const health = healthQueries[index];
              const healthState: HealthState = health?.isError
                ? "unknown"
                : (health?.data?.status ?? "unknown");
              const installedIn = installedCounts.get(app.key) ?? 0;

              return (
                <Card key={app.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-muted-foreground">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span
                      className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground"
                      title={`Health: ${HEALTH_LABEL[healthState]}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[healthState]}`} />
                      {HEALTH_LABEL[healthState]}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <h3 className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                      {app.name}
                    </h3>
                    <Badge tone={tone}>{app.status}</Badge>
                  </div>

                  {app.description ? (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {app.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono-num">
                      v{app.version}
                    </span>
                    <span>{CATEGORY_LABELS[app.category] ?? app.category}</span>
                    <span className="truncate">{app.owner}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        {app.navigation.length}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">Nav items</div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        {app.permissions.length}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">Permissions</div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">
                        {installedIn}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">Orgs installed</div>
                    </div>
                  </div>

                  {app.requiresSuperAdmin ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Requires super-admin
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
