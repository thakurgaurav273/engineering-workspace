import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Plus, Search, Loader2, Eye, CheckCircle2, Ban, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@/shared/components/primitives";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { IconButton } from "@/applications/business/components/icon-button";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { useClients } from "@/applications/business/lib/business-clients";
import {
  useInvoices,
  useInvoiceMutations,
  money,
  STATUS_LABELS,
  type Invoice,
  type InvoiceStatus,
} from "@/applications/business/lib/business-invoices";


const STATUSES: InvoiceStatus[] = [
  "DRAFT",
  "ISSUED",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
  "VOID",
];
type Action = "issue" | "cancel" | "delete" | "duplicate";

export function InvoicesPage() {
  const navigate = useNavigate();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!appsLoading && !available) navigate({ to: "/", replace: true });
  }, [appsLoading, available, navigate]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ action: Action; inv: Invoice } | null>(null);

  const { data: clientsPage } = useClients({ limit: 100 }, flags.platformShell && available);
  const { data, isLoading, isError, isFetching } = useInvoices(
    {
      page,
      limit: 20,
      search,
      status,
      clientId,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sort: "createdAt",
      order: "desc",
    },
    flags.platformShell && available,
  );
  const { issue, cancel, duplicate, remove } = useInvoiceMutations();
  const pending = issue.isPending || cancel.isPending || duplicate.isPending || remove.isPending;

  if (!flags.platformShell || appsLoading || !available) return null;

  const invoices = data?.data ?? [];

  const runConfirm = () => {
    if (!confirm) return;
    const { action, inv } = confirm;
    const close = () => setConfirm(null);
    if (action === "issue")
      issue.mutate(inv.id, {
        onSuccess: () => {
          toast.success("Invoice issued");
          close();
        },
        onError: () => toast.error("Couldn't issue"),
      });
    else if (action === "cancel")
      cancel.mutate(inv.id, {
        onSuccess: () => {
          toast.success("Invoice cancelled");
          close();
        },
        onError: () => toast.error("Couldn't cancel"),
      });
    else if (action === "delete")
      remove.mutate(inv.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          close();
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (action === "duplicate")
      duplicate.mutate(inv.id, {
        onSuccess: (created: Invoice) => {
          toast.success("Draft created");
          close();
          navigate({ to: "/business/invoices/$id", params: { id: created.id } });
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageHeader
        title="Invoices"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => navigate({ to: "/business/invoices/new" })}>
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search number…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InvoiceStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All clients</option>
            {clientsPage?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2 py-2 text-[13px]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2 py-2 text-[13px]"
          />
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Couldn't load invoices.
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No invoices yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Create your first invoice to get started.
              </p>
              {canEdit ? (
                <Button className="mt-4" onClick={() => navigate({ to: "/business/invoices/new" })}>
                  <Plus className="h-4 w-4" /> New invoice
                </Button>
              ) : null}
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
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const draft = inv.status === "DRAFT";
                    const cancellable = (
                      ["ISSUED", "SENT", "PARTIALLY_PAID"] as InvoiceStatus[]
                    ).includes(inv.status);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            to="/business/invoices/$id"
                            params={{ id: inv.id }}
                            className="font-medium hover:underline"
                          >
                            {inv.number ?? "Draft"}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {inv.clientSnapshot?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {(inv.issueDate ?? inv.createdAt)?.slice(0, 10)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-num">
                          {money(inv.grandTotal, inv.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              title="View"
                              onClick={() =>
                                navigate({ to: "/business/invoices/$id", params: { id: inv.id } })
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </IconButton>
                            {canEdit && draft ? (
                              <IconButton
                                title="Issue"
                                onClick={() => setConfirm({ action: "issue", inv })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && cancellable ? (
                              <IconButton
                                title="Cancel"
                                onClick={() => setConfirm({ action: "cancel", inv })}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && !draft ? (
                              <IconButton
                                title="Duplicate"
                                onClick={() => setConfirm({ action: "duplicate", inv })}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && draft ? (
                              <IconButton
                                title="Delete"
                                onClick={() => setConfirm({ action: "delete", inv })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && data.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>
              {data.total} invoice{data.total === 1 ? "" : "s"}
              {isFetching ? " · updating…" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </PageBody>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        pending={pending}
        title={
          confirm?.action === "issue"
            ? "Issue this invoice?"
            : confirm?.action === "cancel"
              ? "Cancel this invoice?"
              : confirm?.action === "delete"
                ? "Delete this draft?"
                : "Duplicate this invoice?"
        }
        description={
          confirm?.action === "issue"
            ? "A permanent invoice number will be reserved and the invoice locked."
            : confirm?.action === "cancel"
              ? "The invoice stays visible but is marked cancelled."
              : confirm?.action === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created."
        }
        confirmLabel={
          confirm?.action === "delete"
            ? "Delete"
            : confirm?.action === "cancel"
              ? "Cancel invoice"
              : confirm?.action === "issue"
                ? "Issue"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <BusinessDocumentStatusBadge status={status} />;
}
