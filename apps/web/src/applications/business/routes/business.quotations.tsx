import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, Eye, CheckCircle2, Ban, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@grovyn/ui/primitives";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { IconButton } from "@/applications/business/components/icon-button";
import { money } from "@/applications/business/lib/business-format";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { useClients } from "@/applications/business/lib/business-clients";
import {
  useQuotations,
  useQuotationMutations,
  QUOTATION_STATUS_LABELS,
  type Quotation,
  type QuotationStatus,
} from "@/applications/business/lib/business-quotations";


const STATUSES: QuotationStatus[] = [
  "DRAFT",
  "ISSUED",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];
type Action = "issue" | "cancel" | "delete" | "duplicate";

export function QuotationsPage() {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/");
  }, [appsLoading, available, navigate]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ action: Action; q: Quotation } | null>(null);

  const { data: clientsPage } = useClients({ limit: 100 }, flags.platformShell && available);
  const { data, isLoading, isError, isFetching } = useQuotations(
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
  const { issue, cancel, duplicate, remove } = useQuotationMutations();
  const pending = issue.isPending || cancel.isPending || duplicate.isPending || remove.isPending;

  if (!flags.platformShell || appsLoading || !available) return null;

  const quotations = data?.data ?? [];

  const runConfirm = () => {
    if (!confirm) return;
    const { action, q } = confirm;
    const close = () => setConfirm(null);
    if (action === "issue")
      issue.mutate(q.id, {
        onSuccess: () => {
          toast.success("Quotation issued");
          close();
        },
        onError: () => toast.error("Couldn't issue"),
      });
    else if (action === "cancel")
      cancel.mutate(q.id, {
        onSuccess: () => {
          toast.success("Quotation cancelled");
          close();
        },
        onError: () => toast.error("Couldn't cancel"),
      });
    else if (action === "delete")
      remove.mutate(q.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          close();
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (action === "duplicate")
      duplicate.mutate(q.id, {
        onSuccess: (created: Quotation) => {
          toast.success("Draft created");
          close();
          navigate.push(`/business/quotations/${created.id}`);
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageHeader
        title="Quotations"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => navigate.push("/business/quotations/new")}>
              <Plus className="h-4 w-4" /> New quotation
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
              setStatus(e.target.value as QuotationStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTATION_STATUS_LABELS[s]}
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
              Couldn't load quotations.
            </div>
          ) : quotations.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No quotations yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Create your first quotation to get started.
              </p>
              {canEdit ? (
                <Button
                  className="mt-4"
                  onClick={() => navigate.push("/business/quotations/new")}
                >
                  <Plus className="h-4 w-4" /> New quotation
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
                  {quotations.map((q) => {
                    const draft = q.status === "DRAFT";
                    const cancellable = (
                      ["ISSUED", "SENT", "ACCEPTED"] as QuotationStatus[]
                    ).includes(q.status);
                    return (
                      <tr
                        key={q.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/business/quotations/${q.id}`}
                            className="font-medium hover:underline"
                          >
                            {q.number ?? "Draft"}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {q.clientSnapshot?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <BusinessDocumentStatusBadge status={q.status} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {(q.issueDate ?? q.createdAt)?.slice(0, 10)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-num">
                          {money(q.grandTotal, q.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              title="View"
                              onClick={() =>
                                navigate.push(`/business/quotations/${q.id}`)
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </IconButton>
                            {canEdit && draft ? (
                              <IconButton
                                title="Issue"
                                onClick={() => setConfirm({ action: "issue", q })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && cancellable ? (
                              <IconButton
                                title="Cancel"
                                onClick={() => setConfirm({ action: "cancel", q })}
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && !draft ? (
                              <IconButton
                                title="Duplicate"
                                onClick={() => setConfirm({ action: "duplicate", q })}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && draft ? (
                              <IconButton
                                title="Delete"
                                onClick={() => setConfirm({ action: "delete", q })}
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
              {data.total} quotation{data.total === 1 ? "" : "s"}
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
            ? "Issue this quotation?"
            : confirm?.action === "cancel"
              ? "Cancel this quotation?"
              : confirm?.action === "delete"
                ? "Delete this draft?"
                : "Duplicate this quotation?"
        }
        description={
          confirm?.action === "issue"
            ? "A permanent quotation number will be reserved and it will be locked."
            : confirm?.action === "cancel"
              ? "The quotation stays visible but is marked cancelled."
              : confirm?.action === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created."
        }
        confirmLabel={
          confirm?.action === "delete"
            ? "Delete"
            : confirm?.action === "cancel"
              ? "Cancel quotation"
              : confirm?.action === "issue"
                ? "Issue"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}
