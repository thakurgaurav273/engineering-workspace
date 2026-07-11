import { useMemo } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Skeleton,
  Metric,
  Button,
} from "@grovyn/ui/primitives";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@grovyn/ui/components/table";
import { api } from "@/shared/lib/api";

// Platform Administration "Monitoring": per-application health, for a platform SUPER_ADMIN.
// GET /platform/applications is the catalog; GET /platform/applications/{key}/health and
// .../capabilities are fetched per app (in parallel, via useQueries) once the catalog has
// loaded. A failed health/capabilities fetch degrades that one row to "unknown" rather than
// crashing the page - mirrors the pattern in applications-admin.tsx.

interface ApplicationSummary {
  key: string;
  name: string;
  category: string;
  status: string;
  version: string;
}

interface ApplicationHealth {
  status: "ok" | "degraded" | "down";
  application: string;
  details?: Record<string, unknown>;
}

interface ApplicationCapabilities {
  key: string;
  version: string;
  status: string;
  navigation: unknown[];
  permissions: string[];
  dependencies: string[];
  events: string[];
  aiTools: string[];
}

type HealthState = "ok" | "degraded" | "down" | "unknown";

const APPLICATIONS_KEY = ["platform", "monitoring", "applications"] as const;

const DECLARED_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  ACTIVE: "success",
  DISABLED: "neutral",
  MAINTENANCE: "warning",
  EXPERIMENTAL: "info",
  COMING_SOON: "neutral",
};

const HEALTH_DOT: Record<HealthState, string> = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
  unknown: "bg-muted-foreground/40",
};

const HEALTH_TEXT: Record<HealthState, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  degraded: "text-amber-700 dark:text-amber-400",
  down: "text-rose-700 dark:text-rose-400",
  unknown: "text-muted-foreground",
};

const HEALTH_LABEL: Record<HealthState, string> = {
  ok: "Ok",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

export function MonitoringAdmin() {
  const queryClient = useQueryClient();

  const { data: apps, isLoading: appsLoading } = useQuery<ApplicationSummary[]>({
    queryKey: APPLICATIONS_KEY,
    queryFn: () => api.get("/platform/applications"),
  });

  const sortedApps = useMemo(
    () => [...(apps ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [apps],
  );

  // One health check + one capabilities check per app, fetched in parallel once the catalog
  // has loaded. Each is independent: a failed fetch degrades only that app's row.
  const healthQueries = useQueries({
    queries: sortedApps.map((app) => ({
      queryKey: ["platform", "monitoring", "health", app.key],
      queryFn: () => api.get<ApplicationHealth>(`/platform/applications/${app.key}/health`),
      retry: false,
      staleTime: 30 * 1000,
    })),
  });

  const capabilityQueries = useQueries({
    queries: sortedApps.map((app) => ({
      queryKey: ["platform", "monitoring", "capabilities", app.key],
      queryFn: () =>
        api.get<ApplicationCapabilities>(`/platform/applications/${app.key}/capabilities`),
      retry: false,
      staleTime: 30 * 1000,
    })),
  });

  const rows = sortedApps.map((app, index) => {
    const health = healthQueries[index];
    const healthState: HealthState = health?.isError
      ? "unknown"
      : (health?.data?.status ?? "unknown");
    const capabilities = capabilityQueries[index];
    return {
      app,
      healthState,
      healthLoading: health?.isLoading ?? false,
      capabilities: capabilities?.isError ? null : (capabilities?.data ?? null),
    };
  });

  const okCount = rows.filter((r) => r.healthState === "ok").length;
  const degradedCount = rows.filter((r) => r.healthState === "degraded").length;
  const downCount = rows.filter((r) => r.healthState === "down").length;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["platform", "monitoring"] });
  }

  return (
    <>
      <PageHeader
        title="Monitoring"
        description="Health and capabilities of every registered application."
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={appsLoading}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {appsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <Metric label="Applications" value={sortedApps.length} />
              <Metric label="Ok" value={okCount} />
              <Metric label="Degraded" value={degradedCount} />
              <Metric label="Down" value={downCount} />
            </>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader
            title="Applications"
            subtitle="Declared status from the catalog alongside live health from each app's health endpoint."
          />
          {appsLoading ? (
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : sortedApps.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="No applications registered"
                description="Nothing is registered in the platform application catalog yet."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Application</TableHead>
                    <TableHead>Declared status</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Capabilities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ app, healthState, healthLoading, capabilities }) => (
                    <TableRow key={app.key}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{app.name}</span>
                          <span className="text-[12px] text-muted-foreground">{app.key}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone={DECLARED_STATUS_TONE[app.status] ?? "neutral"}>
                          {app.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {healthLoading ? (
                          <Skeleton className="h-3.5 w-16" />
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${HEALTH_TEXT[healthState]}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[healthState]}`} />
                            {HEALTH_LABEL[healthState]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">
                        {app.version}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">
                        {capabilities
                          ? `${capabilities.permissions.length} perms · ${capabilities.events.length} events · ${capabilities.aiTools.length} AI tools`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </PageBody>
    </>
  );
}
