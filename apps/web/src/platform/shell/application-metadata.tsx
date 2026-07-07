import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { api } from "@/shared/lib/api";
import { flags } from "@/shared/lib/flags";
import { iconFor, type ApplicationManifest } from "@/platform/registry/app-registry";

interface ApplicationHealth {
  status: string;
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

/**
 * Per-application metadata: overview, health, version, capabilities. The foundation for
 * future platform diagnostics. Reads the SDK's metadata endpoints; no app-specific code.
 */
export function ApplicationMetadata({ appKey }: { appKey: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
  }, [navigate]);

  const overview = useQuery<ApplicationManifest>({
    queryKey: ["platform", "applications", appKey],
    queryFn: () => api.get(`/platform/applications/${appKey}`),
    enabled: flags.platformShell,
  });
  const health = useQuery<ApplicationHealth>({
    queryKey: ["platform", "applications", appKey, "health"],
    queryFn: () => api.get(`/platform/applications/${appKey}/health`),
    enabled: flags.platformShell,
  });
  const capabilities = useQuery<ApplicationCapabilities>({
    queryKey: ["platform", "applications", appKey, "capabilities"],
    queryFn: () => api.get(`/platform/applications/${appKey}/capabilities`),
    enabled: flags.platformShell,
  });

  if (!flags.platformShell) return null;

  const app = overview.data;
  const Icon = iconFor(app?.icon ?? "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 border-b border-border px-6">
        <Link
          to="/apps"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[13px] font-semibold tracking-tight">Application details</span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10 space-y-4">
        {overview.isError ? (
          <div className="rounded-xl border border-border bg-surface/40 p-6 text-[13px] text-muted-foreground">
            Application not found, or you don't have access to it.
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight">{app?.name ?? appKey}</h1>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{app?.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetaTile label="Version" value={app?.version ?? "—"} />
              <MetaTile label="Status" value={app?.status ?? "—"} />
              <MetaTile
                label="Health"
                value={health.data?.status ?? (health.isLoading ? "…" : "—")}
              />
              <MetaTile label="Owner" value={app?.owner ?? "—"} />
            </div>

            <MetaSection title="Overview">
              <MetaRow label="Key" value={app?.key} />
              <MetaRow label="Category" value={app?.category} />
              <MetaRow label="Route prefix" value={app?.routePrefix} />
              <MetaRow
                label="Requires super admin"
                value={app ? String(!!app.requiresSuperAdmin) : undefined}
              />
            </MetaSection>

            <MetaSection title="Capabilities">
              <MetaRow
                label="Navigation items"
                value={String(capabilities.data?.navigation.length ?? 0)}
              />
              <MetaRow
                label="Permissions"
                value={String(capabilities.data?.permissions.length ?? 0)}
              />
              <MetaRow
                label="Dependencies"
                value={String(capabilities.data?.dependencies.length ?? 0)}
              />
              <MetaRow label="Events" value={String(capabilities.data?.events.length ?? 0)} />
              <MetaRow label="AI tools" value={String(capabilities.data?.aiTools.length ?? 0)} />
            </MetaSection>
          </>
        )}
      </main>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function MetaSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="mb-2 text-[12px] font-semibold tracking-tight">{title}</div>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
