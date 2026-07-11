import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { PageHeader, PageBody, Card, CardHeader, Badge, Metric, EmptyState, Skeleton } from "@grovyn/ui/primitives";
import { api } from "@/shared/lib/api";

// Platform Settings (read-only system information). Composed from GET /platform/settings -
// versions, environment, storage status, entity counts and the effective feature-flag map.
// Flag editing lives on the Feature Flags page; this surface is informational.

interface PlatformSettings {
  environment: string;
  apiVersion: string;
  nodeVersion: string;
  storageConfigured: boolean;
  counts: {
    applications: number;
    organizations: number;
    users: number;
    featureFlags: number;
    enabledFlags: number;
  };
  featureFlags: Record<string, boolean>;
}

export function SettingsAdmin() {
  const { data, isLoading, isError } = useQuery<PlatformSettings>({
    queryKey: ["platform", "settings"],
    queryFn: () => api.get("/platform/settings"),
  });

  const flagEntries = Object.entries(data?.featureFlags ?? {}).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <>
      <PageHeader title="Platform Settings" description="Global configuration and system information for the Grovyn Platform." />
      <PageBody className="space-y-6">
        {isError ? (
          <Card className="p-6">
            <EmptyState
              icon={<SlidersHorizontal className="h-5 w-5" />}
              title="Couldn't load platform settings"
              description="The settings endpoint returned an error. Confirm platform super-admin access."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="mt-3 h-6 w-10" />
                  </div>
                ))
              ) : (
                <>
                  <Metric label="Applications" value={data?.counts.applications ?? 0} />
                  <Metric label="Organizations" value={data?.counts.organizations ?? 0} />
                  <Metric label="Users" value={data?.counts.users ?? 0} />
                  <Metric label="Feature flags" value={data?.counts.featureFlags ?? 0} />
                  <Metric label="Enabled flags" value={data?.counts.enabledFlags ?? 0} />
                </>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <CardHeader title="System" subtitle="Runtime and deployment information." />
              {isLoading ? (
                <div className="p-5 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
              ) : (
                <dl className="divide-y divide-border">
                  {[
                    ["Environment", data?.environment],
                    ["API version", data?.apiVersion],
                    ["Node version", data?.nodeVersion],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-5 py-3">
                      <dt className="text-[13px] text-muted-foreground">{label}</dt>
                      <dd className="font-mono text-[12.5px] text-foreground">{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="text-[13px] text-muted-foreground">Object storage</dt>
                    <dd>
                      <Badge tone={data?.storageConfigured ? "success" : "warning"}>
                        {data?.storageConfigured ? "Configured" : "Not configured"}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              )}
            </Card>

            <Card className="p-0 overflow-hidden">
              <CardHeader title="Feature flags" subtitle="Effective values. Edit on the Feature Flags page." />
              {isLoading ? (
                <div className="p-5 space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : flagEntries.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<SlidersHorizontal className="h-5 w-5" />}
                    title="No feature flags"
                    description="No flags are defined in the environment or referenced by an application."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {flagEntries.map(([key, enabled]) => (
                    <li key={key} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="font-mono text-[12.5px] text-foreground">{key}</span>
                      <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </PageBody>
    </>
  );
}
