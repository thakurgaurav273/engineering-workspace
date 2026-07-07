import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Send, Copy, Trash2, Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageBody, Card, Button } from "@/shared/components/primitives";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { OfferLetterEditor } from "@/applications/business/components/offer-letter-editor";
import { money } from "@/applications/business/lib/business-format";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import {
  useOfferLetter,
  useOfferLetterMutations,
  EMPLOYMENT_TYPE_LABELS,
  type OfferLetter,
} from "@/applications/business/lib/business-offer-letters";


type Action = "send" | "accept" | "reject" | "cancel" | "delete" | "duplicate";

const COPY: Record<Action, { title: string; description: string; confirmLabel: string }> = {
  send: {
    title: "Send this offer letter?",
    description: "A permanent offer number will be reserved and it will be locked.",
    confirmLabel: "Send",
  },
  accept: {
    title: "Mark as accepted?",
    description: "Records the candidate's acceptance of this offer.",
    confirmLabel: "Accept",
  },
  reject: {
    title: "Mark as rejected?",
    description: "Records that the candidate declined this offer.",
    confirmLabel: "Reject",
  },
  cancel: {
    title: "Cancel this offer letter?",
    description: "The offer stays visible but is marked cancelled.",
    confirmLabel: "Cancel offer",
  },
  delete: {
    title: "Delete this draft?",
    description: "This draft will be permanently deleted.",
    confirmLabel: "Delete",
  },
  duplicate: {
    title: "Duplicate this offer letter?",
    description: "A new editable draft will be created.",
    confirmLabel: "Duplicate",
  },
};

export function OfferLetterDetailPage({ id }: { id: string }) {
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
    data: offer,
    isLoading,
    isError,
  } = useOfferLetter(flags.platformShell && available ? id : undefined);
  const m = useOfferLetterMutations();

  if (!flags.platformShell || appsLoading || !available) return null;

  const isDraft = offer?.status === "DRAFT";
  const pending =
    m.send.isPending ||
    m.accept.isPending ||
    m.reject.isPending ||
    m.cancel.isPending ||
    m.duplicate.isPending ||
    m.remove.isPending;

  const runConfirm = () => {
    if (!offer || !confirm) return;
    const done = (msg: string, go?: boolean) => () => {
      toast.success(msg);
      setConfirm(null);
      if (go) navigate({ to: "/business/offer-letters" });
    };
    const err = (msg: string) => () => toast.error(msg);
    if (confirm === "send")
      m.send.mutate(offer.id, {
        onSuccess: done("Offer letter sent"),
        onError: err("Couldn't send"),
      });
    else if (confirm === "accept")
      m.accept.mutate(offer.id, {
        onSuccess: done("Marked accepted"),
        onError: err("Couldn't update"),
      });
    else if (confirm === "reject")
      m.reject.mutate(offer.id, {
        onSuccess: done("Marked rejected"),
        onError: err("Couldn't update"),
      });
    else if (confirm === "cancel")
      m.cancel.mutate(offer.id, {
        onSuccess: done("Offer cancelled"),
        onError: err("Couldn't cancel"),
      });
    else if (confirm === "delete")
      m.remove.mutate(offer.id, {
        onSuccess: done("Draft deleted", true),
        onError: err("Couldn't delete"),
      });
    else if (confirm === "duplicate")
      m.duplicate.mutate(offer.id, {
        onSuccess: (o: OfferLetter) => {
          toast.success("Draft created");
          setConfirm(null);
          navigate({ to: "/business/offer-letters/$id", params: { id: o.id } });
        },
        onError: err("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageBody>
        <Link
          to="/business/offer-letters"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Offer Letters
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !offer ? (
          <Card className="p-6 text-[13px] text-muted-foreground">Offer letter not found.</Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">
                  {offer.number ?? offer.candidateName}
                </h1>
                <BusinessDocumentStatusBadge status={offer.status} />
              </div>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  {isDraft ? (
                    <>
                      <Button onClick={() => setConfirm("send")}>
                        <Send className="h-3.5 w-3.5" /> Send
                      </Button>
                      <Button variant="outline" onClick={() => setConfirm("delete")}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </>
                  ) : (
                    <>
                      {offer.status === "SENT" ? (
                        <>
                          <Button onClick={() => setConfirm("accept")}>
                            <Check className="h-3.5 w-3.5" /> Accept
                          </Button>
                          <Button variant="outline" onClick={() => setConfirm("reject")}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      ) : null}
                      {offer.status === "SENT" || offer.status === "ACCEPTED" ? (
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

            {isDraft ? <OfferLetterEditor offer={offer} /> : <ReadOnlyOffer offer={offer} />}
          </>
        )}
      </PageBody>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        pending={pending}
        title={confirm ? COPY[confirm].title : ""}
        description={confirm ? COPY[confirm].description : ""}
        confirmLabel={confirm ? COPY[confirm].confirmLabel : "Confirm"}
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}

function ReadOnlyOffer({ offer }: { offer: OfferLetter }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Candidate
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Name" value={offer.candidateName} />
            <Meta label="Email" value={offer.candidateEmail} />
            <Meta label="Phone" value={offer.candidatePhone} />
            <Meta label="Address" value={offer.candidateAddress} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Role
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Position" value={offer.position} />
            <Meta label="Designation" value={offer.designation} />
            <Meta label="Department" value={offer.department} />
            <Meta label="Reporting manager" value={offer.reportingManager} />
            <Meta label="Employment type" value={EMPLOYMENT_TYPE_LABELS[offer.employmentType]} />
            <Meta label="Work location" value={offer.workLocation} />
            <Meta label="Start date" value={offer.startDate?.slice(0, 10)} />
          </div>
        </Card>
        {offer.termsAndConditions || offer.additionalNotes ? (
          <Card className="p-4 text-[13px] leading-relaxed">
            {offer.termsAndConditions ? (
              <div className="mb-2 whitespace-pre-wrap">
                <span className="text-muted-foreground">Terms & conditions: </span>
                {offer.termsAndConditions}
              </div>
            ) : null}
            {offer.additionalNotes ? (
              <div className="whitespace-pre-wrap">
                <span className="text-muted-foreground">Additional notes: </span>
                {offer.additionalNotes}
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Compensation
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Base salary" value={money(offer.baseSalary, offer.currency)} />
            <Meta
              label="Variable pay"
              value={offer.variablePay != null ? money(offer.variablePay, offer.currency) : null}
            />
            <Meta label="Benefits" value={offer.benefits} />
          </div>
          {offer.salaryBreakdown ? (
            <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-muted-foreground">
              {offer.salaryBreakdown}
            </p>
          ) : null}
        </Card>
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </div>
          <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
            <Meta label="Offer date" value={offer.offerDate?.slice(0, 10)} />
            <Meta label="Valid until" value={offer.validUntil?.slice(0, 10)} />
            <Meta label="Notice period" value={offer.noticePeriod} />
            <Meta label="Probation" value={offer.probationPeriod} />
          </div>
        </Card>
      </div>
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
