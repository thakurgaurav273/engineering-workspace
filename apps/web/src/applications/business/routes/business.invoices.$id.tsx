import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, CheckCircle2, Ban, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageBody, Card, Button } from "@/shared/components/primitives";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { InvoiceEditor, Totals } from "@/applications/business/components/invoice-editor";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import {
  useInvoice,
  useInvoiceMutations,
  money,
  STATUS_LABELS,
  type Invoice,
  type InvoiceStatus,
} from "@/applications/business/lib/business-invoices";


type Action = "issue" | "cancel" | "delete" | "duplicate";

export function InvoiceDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const [confirm, setConfirm] = useState<Action | null>(null);

  useEffect(() => {
    if (!flags.platformShell) navigate({ to: "/", replace: true });
    else if (!appsLoading && !available) navigate({ to: "/", replace: true });
  }, [appsLoading, available, navigate]);

  const {
    data: invoice,
    isLoading,
    isError,
  } = useInvoice(flags.platformShell && available ? id : undefined);
  const { issue, cancel, duplicate, remove } = useInvoiceMutations();

  if (!flags.platformShell || appsLoading || !available) return null;

  const isDraft = invoice?.status === "DRAFT";
  const cancellable =
    invoice && (["ISSUED", "SENT", "PARTIALLY_PAID"] as InvoiceStatus[]).includes(invoice.status);
  const pending = issue.isPending || cancel.isPending || duplicate.isPending || remove.isPending;

  const runConfirm = () => {
    if (!invoice) return;
    if (confirm === "issue")
      issue.mutate(invoice.id, {
        onSuccess: () => {
          toast.success("Invoice issued");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't issue"),
      });
    else if (confirm === "cancel")
      cancel.mutate(invoice.id, {
        onSuccess: () => {
          toast.success("Invoice cancelled");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't cancel"),
      });
    else if (confirm === "delete")
      remove.mutate(invoice.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          navigate({ to: "/business/invoices" });
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (confirm === "duplicate")
      duplicate.mutate(invoice.id, {
        onSuccess: (inv: Invoice) => {
          toast.success("Draft created");
          setConfirm(null);
          navigate({ to: "/business/invoices/$id", params: { id: inv.id } });
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageBody>
        <Link
          to="/business/invoices"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Invoices
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !invoice ? (
          <Card className="p-6 text-[13px] text-muted-foreground">Invoice not found.</Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">
                  {invoice.number ?? "Draft invoice"}
                </h1>
                <StatusBadge status={invoice.status} />
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  {isDraft ? (
                    <>
                      <Button onClick={() => setConfirm("issue")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Issue
                      </Button>
                      <Button variant="outline" onClick={() => setConfirm("delete")}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      {cancellable ? (
                        <Button variant="outline" onClick={() => setConfirm("cancel")}>
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => setConfirm("duplicate")}>
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {isDraft ? <InvoiceEditor invoice={invoice} /> : <ReadOnlyInvoice invoice={invoice} />}
          </>
        )}
      </PageBody>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        pending={pending}
        title={
          confirm === "issue"
            ? "Issue this invoice?"
            : confirm === "cancel"
              ? "Cancel this invoice?"
              : confirm === "delete"
                ? "Delete this draft?"
                : "Duplicate this invoice?"
        }
        description={
          confirm === "issue"
            ? "A permanent invoice number will be reserved. The invoice can no longer be edited."
            : confirm === "cancel"
              ? "The invoice stays visible but is marked cancelled."
              : confirm === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created from this invoice."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete"
            : confirm === "cancel"
              ? "Cancel invoice"
              : confirm === "issue"
                ? "Issue"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}

function ReadOnlyInvoice({ invoice }: { invoice: Invoice }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Client" value={invoice.clientSnapshot?.name} />
            <Meta label="Currency" value={invoice.currency} />
            <Meta label="Issue date" value={invoice.issueDate?.slice(0, 10)} />
            <Meta label="Due date" value={invoice.dueDate?.slice(0, 10)} />
          </div>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Qty</th>
                  <th className="px-4 py-2 font-medium">Unit price</th>
                  <th className="px-4 py-2 font-medium">Tax</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lines ?? []).map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      {l.description}
                      {l.notes ? (
                        <div className="text-[11.5px] text-muted-foreground">{l.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      {l.quantity} {l.unit ?? ""}
                    </td>
                    <td className="px-4 py-2 font-mono-num">
                      {money(l.unitPrice, invoice.currency)}
                    </td>
                    <td className="px-4 py-2">
                      {l.taxes?.[0]?.rate != null ? `GST ${l.taxes[0].rate}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-num">
                      {money(l.lineTotal ?? 0, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {invoice.notes || invoice.terms ? (
          <Card className="p-4 text-[13px]">
            {invoice.notes ? (
              <div className="mb-2">
                <span className="text-muted-foreground">Notes: </span>
                {invoice.notes}
              </div>
            ) : null}
            {invoice.terms ? (
              <div>
                <span className="text-muted-foreground">Terms: </span>
                {invoice.terms}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      <Card className="p-4 h-fit">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Totals
        </div>
        <Totals data={{ ...invoice, taxBreakdown: invoice.taxBreakdown ?? [] }} />
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    ISSUED: "bg-accent text-foreground",
    SENT: "bg-accent text-foreground",
    PARTIALLY_PAID: "border border-border text-muted-foreground",
    PAID: "bg-accent text-foreground",
    CANCELLED: "border border-border text-muted-foreground",
    VOID: "border border-border text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
