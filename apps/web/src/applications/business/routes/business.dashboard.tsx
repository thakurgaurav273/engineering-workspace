import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Metric } from "@grovyn/ui/primitives";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { money } from "@/applications/business/lib/business-format";
import { flags } from "@/shared/lib/flags";
import { useApplication } from "@/platform/registry/application-context";
import { useDashboard } from "@/applications/business/lib/business-dashboard";


export function DashboardPage() {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const { data, isLoading, isError } = useDashboard(flags.platformShell && available);

  if (!flags.platformShell || appsLoading || !available) return null;

  const cur = data?.currency ?? "INR";
  const maxRevenue = Math.max(1, ...(data?.monthlyRevenue.map((m) => m.amount) ?? [0]));

  return (
    <AppShell>
      <PageHeader title="Dashboard" description="Business Operations" />
      <PageBody>
        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !data ? (
          <Card className="p-6 text-[13px] text-muted-foreground">
            Couldn't load the dashboard.
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric
                label="Collected"
                value={money(data.totals.collected, cur)}
                hint="Payments received to date"
              />
              <Metric
                label="Outstanding"
                value={money(data.totals.outstanding, cur)}
                deltaTone="warning"
                hint="Awaiting payment on open invoices"
              />
              <Metric
                label="Invoiced"
                value={money(data.totals.invoiced, cur)}
                deltaTone="neutral"
                hint="Total value of issued invoices"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <CountCard href="/business/invoices" label="Invoices" value={data.counts.invoices} />
              <CountCard
                href="/business/quotations"
                label="Quotations"
                value={data.counts.quotations}
              />
              <CountCard href="/business/proposals" label="Proposals" value={data.counts.proposals} />
              <CountCard
                href="/business/offer-letters"
                label="Offer letters"
                value={data.counts.offerLetters}
              />
              <CountCard
                href="/business/clients"
                label="Active clients"
                value={data.counts.clients}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Revenue - last 6 months
                </div>
                {/* Columns must stretch to the full h-40: the bars' % heights resolve against them. */}
                <div className="flex h-40 gap-3">
                  {data.monthlyRevenue.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t bg-primary/80"
                          style={{ height: `${Math.max(2, (m.amount / maxRevenue) * 100)}%` }}
                          title={money(m.amount, cur)}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{m.month}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Invoices by status
                </div>
                <div className="space-y-1.5">
                  {Object.entries(data.counts.invoicesByStatus).length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No invoices yet.</p>
                  ) : (
                    Object.entries(data.counts.invoicesByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <BusinessDocumentStatusBadge status={status} />
                        <span className="font-mono-num text-[13px] font-medium">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent invoices
              </div>
              {data.recentInvoices.length === 0 ? (
                <div className="py-10 text-center text-[13px] text-muted-foreground">
                  No issued invoices yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Number</th>
                        <th className="px-4 py-2.5 font-medium">Client</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 text-right font-medium">Total</th>
                        <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentInvoices.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border last:border-0 hover:bg-accent/40"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/business/invoices/${r.id}`}
                              className="font-medium hover:underline"
                            >
                              {r.number ?? "-"}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {r.clientName ?? "-"}
                          </td>
                          <td className="px-4 py-2.5">
                            <BusinessDocumentStatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {r.issueDate?.slice(0, 10) ?? "-"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-num">
                            {money(r.grandTotal, r.currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-num">
                            {money(r.amountPaid, r.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}

function CountCard({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-mono-num text-[22px] font-semibold leading-none">{value}</div>
    </Link>
  );
}
