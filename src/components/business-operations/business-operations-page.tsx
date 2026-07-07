import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card } from "@/components/primitives";
import { flags } from "@/lib/flags";
import { useApplication } from "@/lib/application-context";
import { BUSINESS_OPERATIONS_PAGES } from "@/lib/business-operations-pages";

/**
 * Placeholder for a Business Operations page. Inert unless the platform-shell flag is on
 * and Business Operations is available in the registry (the `business-operations` feature
 * flag is enabled); otherwise it redirects home. Renders inside the normal AppShell so it
 * picks up the Business Operations sidebar from the manifest — no hardcoded navigation.
 */
export function BusinessOperationsPage({ pageKey }: { pageKey: string }) {
  const navigate = useNavigate();
  const { applications, isLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const meta = BUSINESS_OPERATIONS_PAGES[pageKey];

  useEffect(() => {
    if (!flags.platformShell) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!isLoading && !available) {
      navigate({ to: "/", replace: true });
    }
  }, [isLoading, available, navigate]);

  if (!flags.platformShell || isLoading || !available) return null;

  const title = meta?.title ?? "Business Operations";
  const description = meta?.description ?? "";

  return (
    <AppShell>
      <PageHeader title={title} description="Business Operations" />
      <PageBody>
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-muted-foreground">
              <Construction className="h-4 w-4" />
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
                This page is part of Business Operations (Application&nbsp;#2). The routing and
                navigation are in place; the business logic is migrated in a later phase.
              </p>
            </div>
          </div>
        </Card>
      </PageBody>
    </AppShell>
  );
}
