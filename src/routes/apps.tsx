import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { flags } from "@/lib/flags";
import { useApplication } from "@/lib/application-context";
import {
  iconFor,
  CATEGORY_LABELS,
  ApplicationStatus,
  type ApplicationManifest,
} from "@/lib/app-registry";

export const Route = createFileRoute("/apps")({
  component: LauncherPage,
});

const STATUS_LABELS: Partial<Record<ApplicationStatus, string>> = {
  [ApplicationStatus.EXPERIMENTAL]: "Experimental",
  [ApplicationStatus.MAINTENANCE]: "Maintenance",
  [ApplicationStatus.COMING_SOON]: "Coming soon",
};

/**
 * The platform "home screen". Flag off -> redirect home; exactly one app -> auto-enter;
 * multiple -> the launcher grid, grouped by category and entirely registry-driven.
 */
function LauncherPage() {
  const navigate = useNavigate();
  const { applications, isLoading } = useApplication();

  useEffect(() => {
    if (!flags.platformShell) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!isLoading && applications.length === 1) {
      navigate({ to: applications[0].routePrefix, replace: true });
    }
  }, [isLoading, applications, navigate]);

  if (!flags.platformShell || isLoading || applications.length <= 1) return null;

  // Group launchable apps by category, preserving order.
  const groups: { category: string; label: string; apps: ApplicationManifest[] }[] = [];
  const byCategory = new Map<string, (typeof groups)[number]>();
  for (const app of [...applications].sort((a, b) => a.order - b.order)) {
    let group = byCategory.get(app.category);
    if (!group) {
      group = {
        category: app.category,
        label: CATEGORY_LABELS[app.category] ?? app.category,
        apps: [],
      };
      byCategory.set(app.category, group);
      groups.push(group);
    }
    group.apps.push(app);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-14 items-center gap-2 border-b border-border px-6">
        <img
          src="/grovyn_logo.png"
          alt="Grovyn"
          className="h-7 w-7 rounded-md object-contain bg-muted"
        />
        <span className="text-[13px] font-semibold tracking-tight">Grovyn Platform</span>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Your applications</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Choose an application to get started.
        </p>

        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.category}>
              <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.apps.map((app) => (
                  <LauncherCard key={app.key} app={app} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function LauncherCard({ app }: { app: ApplicationManifest }) {
  const Icon = iconFor(app.icon);
  const statusLabel = STATUS_LABELS[app.status];
  const comingSoon = app.status === ApplicationStatus.COMING_SOON;

  const inner = (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-semibold tracking-tight">{app.name}</span>
          {statusLabel ? (
            <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
              {statusLabel}
            </span>
          ) : null}
        </span>
        {app.description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
            {app.description}
          </span>
        ) : null}
      </span>
    </>
  );

  const base = "flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors";

  if (comingSoon) {
    return (
      <div className={`${base} cursor-not-allowed bg-surface/20 opacity-60`} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link to={app.routePrefix} className={`group ${base} bg-surface/40 hover:bg-accent/60`}>
      {inner}
    </Link>
  );
}
