import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Construction } from "lucide-react";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card } from "@grovyn/ui/primitives";
import { flags } from "@/shared/lib/flags";
import { useApplication } from "@/platform/registry/application-context";
import { ADMIN_PAGES } from "@/applications/platform/lib/admin-pages";

/**
 * Guarded placeholder for a Platform Administration page. Access is gated by the registry:
 * only a SUPER_ADMIN receives the `platform-admin` app, so a non-super-admin (Owner) is
 * redirected home. Also inert unless the platform-shell flag is on. Renders inside the
 * normal AppShell, so it picks up the Platform Administration sidebar from the manifest.
 */
export function AdminPage({ pageKey }: { pageKey: string }) {
  const navigate = useRouter();
  const { applications, isLoading } = useApplication();
  const allowed = applications.some((a) => a.key === "platform-admin");
  const meta = ADMIN_PAGES[pageKey];

  useEffect(() => {
    if (!flags.platformShell) {
      navigate.replace("/");
      return;
    }
    if (!isLoading && !allowed) {
      navigate.replace("/");
    }
  }, [isLoading, allowed, navigate]);

  if (!flags.platformShell || isLoading || !allowed) return null;

  const title = meta?.title ?? "Platform Administration";
  const description = meta?.description ?? "";

  return (
    <AppShell>
      <PageHeader title={title} description="Platform Administration" />
      <PageBody>
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-muted-foreground">
              <Construction className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                  Planned
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {description}
              </p>
              <p className="mt-3 text-[12px] text-muted-foreground/80">
                This page is part of Platform Administration (Application&nbsp;#0). The routing and
                navigation are in place; the screen itself is built in a later milestone.
              </p>
            </div>
          </div>
        </Card>
      </PageBody>
    </AppShell>
  );
}
