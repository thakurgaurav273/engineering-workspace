import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, CheckCircle2, Ban, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageBody, Card, Button } from "@/components/primitives";
import { Totals } from "@/components/business/business-document-editor";
import { BusinessDocumentStatusBadge } from "@/components/business/document-status-badge";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { QuotationEditor } from "@/components/business/quotation-editor";
import { money } from "@/lib/business-format";
import { flags } from "@/lib/flags";
import { getStoredAuth } from "@/lib/auth";
import { useApplication } from "@/lib/application-context";
import {
  useQuotation,
  useQuotationMutations,
  type Quotation,
  type QuotationStatus,
} from "@/lib/business-quotations";

export const Route = createFileRoute("/business/quotations/$id")({
  component: QuotationDetailPage,
});

type Action = "issue" | "cancel" | "delete" | "duplicate";

function QuotationDetailPage() {
  const { id } = Route.useParams();
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
    data: quotation,
    isLoading,
    isError,
  } = useQuotation(flags.platformShell && available ? id : undefined);
  const { issue, cancel, duplicate, remove } = useQuotationMutations();

  if (!flags.platformShell || appsLoading || !available) return null;

  const isDraft = quotation?.status === "DRAFT";
  const cancellable =
    quotation && (["ISSUED", "SENT", "ACCEPTED"] as QuotationStatus[]).includes(quotation.status);
  const pending = issue.isPending || cancel.isPending || duplicate.isPending || remove.isPending;

  const runConfirm = () => {
    if (!quotation) return;
    if (confirm === "issue")
      issue.mutate(quotation.id, {
        onSuccess: () => {
          toast.success("Quotation issued");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't issue"),
      });
    else if (confirm === "cancel")
      cancel.mutate(quotation.id, {
        onSuccess: () => {
          toast.success("Quotation cancelled");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't cancel"),
      });
    else if (confirm === "delete")
      remove.mutate(quotation.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          navigate({ to: "/business/quotations" });
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (confirm === "duplicate")
      duplicate.mutate(quotation.id, {
        onSuccess: (q: Quotation) => {
          toast.success("Draft created");
          setConfirm(null);
          navigate({ to: "/business/quotations/$id", params: { id: q.id } });
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageBody>
        <Link
          to="/business/quotations"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quotations
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !quotation ? (
          <Card className="p-6 text-[13px] text-muted-foreground">Quotation not found.</Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">
                  {quotation.number ?? "Draft quotation"}
                </h1>
                <BusinessDocumentStatusBadge status={quotation.status} />
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

            {isDraft ? (
              <QuotationEditor quotation={quotation} />
            ) : (
              <ReadOnlyQuotation quotation={quotation} />
            )}
          </>
        )}
      </PageBody>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        pending={pending}
        title={
          confirm === "issue"
            ? "Issue this quotation?"
            : confirm === "cancel"
              ? "Cancel this quotation?"
              : confirm === "delete"
                ? "Delete this draft?"
                : "Duplicate this quotation?"
        }
        description={
          confirm === "issue"
            ? "A permanent quotation number will be reserved. It can no longer be edited."
            : confirm === "cancel"
              ? "The quotation stays visible but is marked cancelled."
              : confirm === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created from this quotation."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete"
            : confirm === "cancel"
              ? "Cancel quotation"
              : confirm === "issue"
                ? "Issue"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}

function ReadOnlyQuotation({ quotation }: { quotation: Quotation }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Client" value={quotation.clientSnapshot?.name} />
            <Meta label="Currency" value={quotation.currency} />
            <Meta label="Issue date" value={quotation.issueDate?.slice(0, 10)} />
            <Meta label="Expiry date" value={quotation.expiryDate?.slice(0, 10)} />
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
                {(quotation.lines ?? []).map((l, i) => (
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
                      {money(l.unitPrice, quotation.currency)}
                    </td>
                    <td className="px-4 py-2">
                      {l.taxes?.[0]?.rate != null ? `GST ${l.taxes[0].rate}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-num">
                      {money(l.lineTotal ?? 0, quotation.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {quotation.notes || quotation.terms ? (
          <Card className="p-4 text-[13px]">
            {quotation.notes ? (
              <div className="mb-2">
                <span className="text-muted-foreground">Notes: </span>
                {quotation.notes}
              </div>
            ) : null}
            {quotation.terms ? (
              <div>
                <span className="text-muted-foreground">Terms: </span>
                {quotation.terms}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      <Card className="p-4 h-fit">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Totals
        </div>
        <Totals data={{ ...quotation, taxBreakdown: quotation.taxBreakdown ?? [] }} />
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
