import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Copy, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageBody, Card, Button } from "@grovyn/ui/primitives";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { ProposalEditor } from "@/applications/business/components/proposal-editor";
import { sanitizeHtml } from "@grovyn/utils";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { useProposal, useProposalMutations, type Proposal } from "@/applications/business/lib/business-proposals";


type Action = "send" | "archive" | "delete" | "duplicate";

export function ProposalDetailPage({ id }: { id: string }) {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const [confirm, setConfirm] = useState<Action | null>(null);

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const {
    data: proposal,
    isLoading,
    isError,
  } = useProposal(flags.platformShell && available ? id : undefined);
  const { send, archive, duplicate, remove } = useProposalMutations();

  if (!flags.platformShell || appsLoading || !available) return null;

  const isDraft = proposal?.status === "DRAFT";
  const archivable = proposal && proposal.status !== "DRAFT" && proposal.status !== "ARCHIVED";
  const pending = send.isPending || archive.isPending || duplicate.isPending || remove.isPending;

  const runConfirm = () => {
    if (!proposal) return;
    if (confirm === "send")
      send.mutate(proposal.id, {
        onSuccess: () => {
          toast.success("Proposal sent");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't send"),
      });
    else if (confirm === "archive")
      archive.mutate(proposal.id, {
        onSuccess: () => {
          toast.success("Proposal archived");
          setConfirm(null);
        },
        onError: () => toast.error("Couldn't archive"),
      });
    else if (confirm === "delete")
      remove.mutate(proposal.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          navigate.push("/business/proposals");
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (confirm === "duplicate")
      duplicate.mutate(proposal.id, {
        onSuccess: (p: Proposal) => {
          toast.success("Draft created");
          setConfirm(null);
          navigate.push(`/business/proposals/${p.id}`);
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageBody>
        <Link
          href="/business/proposals"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Proposals
        </Link>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError || !proposal ? (
          <Card className="p-6 text-[13px] text-muted-foreground">Proposal not found.</Card>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold tracking-tight">{proposal.title}</h1>
                <BusinessDocumentStatusBadge status={proposal.status} />
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
                      {archivable ? (
                        <Button variant="outline" onClick={() => setConfirm("archive")}>
                          <Archive className="h-3.5 w-3.5" /> Archive
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
              <ProposalEditor proposal={proposal} />
            ) : (
              <ReadOnlyProposal proposal={proposal} />
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
            ? "Send this proposal?"
            : confirm === "archive"
              ? "Archive this proposal?"
              : confirm === "delete"
                ? "Delete this draft?"
                : "Duplicate this proposal?"
        }
        description={
          confirm === "send"
            ? "The proposal will be locked and can no longer be edited."
            : confirm === "archive"
              ? "The proposal stays visible but is marked archived."
              : confirm === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created from this proposal."
        }
        confirmLabel={
          confirm === "delete"
            ? "Delete"
            : confirm === "archive"
              ? "Archive"
              : confirm === "send"
                ? "Send"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}

function ReadOnlyProposal({ proposal }: { proposal: Proposal }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {proposal.summary ? (
          <Card className="p-4 text-[13px] leading-relaxed">{proposal.summary}</Card>
        ) : null}
        {(proposal.sections ?? []).map((s, i) => (
          <Card key={s.id ?? i} className="p-4">
            <h2 className="mb-2 text-[14px] font-semibold">{s.title}</h2>
            <div
              className="prose-sm text-[13px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(s.content) }}
            />
          </Card>
        ))}
        {(proposal.sections ?? []).length === 0 ? (
          <Card className="p-6 text-[13px] text-muted-foreground">
            This proposal has no sections.
          </Card>
        ) : null}
      </div>
      <Card className="p-4 h-fit">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-[13px]">
          <Meta label="Client" value={proposal.clientSnapshot?.name} />
          <Meta label="Reference" value={proposal.reference} />
          <Meta label="Valid until" value={proposal.validUntil?.slice(0, 10)} />
          <Meta label="Sent" value={proposal.sentAt?.slice(0, 10)} />
        </div>
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
