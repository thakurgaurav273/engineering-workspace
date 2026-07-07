import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2, Ban, Copy, Trash2, Eye, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageBody, Card, Button } from "@grovyn/ui/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@grovyn/ui/components/dialog";
import { Totals } from "@/applications/business/components/business-document-editor";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { QuotationEditor } from "@/applications/business/components/quotation-editor";
import { money } from "@/applications/business/lib/business-format";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import {
  useQuotation,
  useQuotationMutations,
  useQuotationPreview,
  openQuotationPdf,
  type Quotation,
  type QuotationStatus,
} from "@/applications/business/lib/business-quotations";


type Action = "issue" | "cancel" | "delete" | "duplicate" | "send";

export function QuotationDetailPage({ id }: { id: string }) {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const enabled = flags.platformShell && available;
  const {
    data: quotation,
    isLoading,
    isError,
  } = useQuotation(enabled ? id : undefined);
  const { issue, cancel, duplicate, remove, send } = useQuotationMutations();
  const preview = useQuotationPreview(id, enabled && previewOpen);

  if (!flags.platformShell || appsLoading || !available) return null;

  const isDraft = quotation?.status === "DRAFT";
  const cancellable =
    quotation && (["ISSUED", "SENT", "ACCEPTED"] as QuotationStatus[]).includes(quotation.status);
  const pending =
    issue.isPending || cancel.isPending || duplicate.isPending || remove.isPending || send.isPending;

  const runConfirm = () => {
    if (!quotation) return;
    if (confirm === "send")
      send.mutate(quotation.id, {
        onSuccess: () => {
          toast.success("Quotation emailed to the client");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't send"),
      });
    else if (confirm === "issue")
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
          navigate.push("/business/quotations");
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (confirm === "duplicate")
      duplicate.mutate(quotation.id, {
        onSuccess: (q: Quotation) => {
          toast.success("Draft created");
          setConfirm(null);
          navigate.push(`/business/quotations/${q.id}`);
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageBody>
        <Link
          href="/business/quotations"
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
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    openQuotationPdf(id).catch(() => toast.error("Couldn't generate the PDF"))
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
                {canEdit ? (
                  <>
                    <Button variant="secondary" onClick={() => setConfirm("send")}>
                      <Send className="h-3.5 w-3.5" /> Send
                    </Button>
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
                  </>
                ) : null}
              </div>
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
          confirm === "send"
            ? "Send this quotation?"
            : confirm === "issue"
              ? "Issue this quotation?"
              : confirm === "cancel"
                ? "Cancel this quotation?"
                : confirm === "delete"
                  ? "Delete this draft?"
                  : "Duplicate this quotation?"
        }
        description={
          confirm === "send"
            ? "The quotation will be emailed to the client."
            : confirm === "issue"
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
                : confirm === "send"
                  ? "Send"
                  : "Duplicate"
        }
        onConfirm={runConfirm}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview — exactly what the client receives</DialogTitle>
          </DialogHeader>
          {preview.isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : preview.isError || !preview.data ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">
              Couldn’t render the preview.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">To:</span> {preview.data.to}
                  <span className="mx-2 text-border">·</span>
                  <span className="text-muted-foreground">Subject:</span> {preview.data.subject}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    openQuotationPdf(id).catch(() => toast.error("Couldn't generate the PDF"))
                  }
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
              </div>
              <iframe
                title="Quotation preview"
                srcDoc={preview.data.html}
                className="h-[60vh] w-full rounded-md border border-border bg-white"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
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
