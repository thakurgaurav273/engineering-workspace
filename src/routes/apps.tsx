import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { flags } from "@/lib/flags";
import { useApplication } from "@/lib/application-context";
import { iconFor } from "@/lib/app-registry";

export const Route = createFileRoute("/apps")({
  component: LauncherPage,
});

/**
 * The platform "home screen". Behaviour:
 *  - flag off            -> inert, redirect home (no behaviour change to the app)
 *  - exactly one app     -> auto-enter it (no launcher shown)
 *  - multiple apps       -> the launcher grid, entirely registry-driven
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

  // Nothing to choose: single app auto-enters, flag-off redirects, loading is a blink.
  if (!flags.platformShell || isLoading || applications.length <= 1) return null;

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

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => {
            const Icon = iconFor(app.nav[0]?.icon ?? "");
            return (
              <Link
                key={app.key}
                to={app.routePrefix}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:bg-accent/60"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold tracking-tight">{app.name}</span>
                  {app.description ? (
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                      {app.description}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
