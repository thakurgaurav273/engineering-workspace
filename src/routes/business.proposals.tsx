import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Plus, Search, Loader2, Eye, Send, Copy, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, Button } from "@/components/primitives";
import { ConfirmDialog } from "@/components/business/confirm-dialog";
import { BusinessDocumentStatusBadge } from "@/components/business/document-status-badge";
import { IconButton } from "@/components/business/icon-button";
import { flags } from "@/lib/flags";
import { getStoredAuth } from "@/lib/auth";
import { useApplication } from "@/lib/application-context";
import { useClients } from "@/lib/business-clients";
import {
  useProposals,
  useProposalMutations,
  PROPOSAL_STATUS_LABELS,
  type Proposal,
  type ProposalStatus,
} from "@/lib/business-proposals";

export const Route = createFileRoute("/business/proposals")({
  component: ProposalsPage,
});

const STATUSES: ProposalStatus[] = ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "ARCHIVED"];
type Action = "send" | "delete" | "duplicate" | "archive";

function ProposalsPage() {
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
  const [status, setStatus] = useState<ProposalStatus | "">("");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ action: Action; p: Proposal } | null>(null);

  const { data: clientsPage } = useClients({ limit: 100 }, flags.platformShell && available);
  const { data, isLoading, isError, isFetching } = useProposals(
    { page, limit: 20, search, status, clientId, sort: "createdAt", order: "desc" },
    flags.platformShell && available,
  );
  const { send, archive, duplicate, remove } = useProposalMutations();
  const pending = send.isPending || archive.isPending || duplicate.isPending || remove.isPending;

  if (!flags.platformShell || appsLoading || !available) return null;

  const proposals = data?.data ?? [];

  const runConfirm = () => {
    if (!confirm) return;
    const { action, p } = confirm;
    const close = () => setConfirm(null);
    if (action === "send")
      send.mutate(p.id, {
        onSuccess: () => {
          toast.success("Proposal sent");
          close();
        },
        onError: () => toast.error("Couldn't send"),
      });
    else if (action === "archive")
      archive.mutate(p.id, {
        onSuccess: () => {
          toast.success("Proposal archived");
          close();
        },
        onError: () => toast.error("Couldn't archive"),
      });
    else if (action === "delete")
      remove.mutate(p.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          close();
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (action === "duplicate")
      duplicate.mutate(p.id, {
        onSuccess: (created: Proposal) => {
          toast.success("Draft created");
          close();
          navigate({ to: "/business/proposals/$id", params: { id: created.id } });
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageHeader
        title="Proposals"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => navigate({ to: "/business/proposals/new" })}>
              <Plus className="h-4 w-4" /> New proposal
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
              placeholder="Search title or reference…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ProposalStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROPOSAL_STATUS_LABELS[s]}
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
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Couldn't load proposals.
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No proposals yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Create your first proposal to get started.
              </p>
              {canEdit ? (
                <Button
                  className="mt-4"
                  onClick={() => navigate({ to: "/business/proposals/new" })}
                >
                  <Plus className="h-4 w-4" /> New proposal
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Valid until</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const draft = p.status === "DRAFT";
                    const archivable = p.status !== "DRAFT" && p.status !== "ARCHIVED";
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            to="/business/proposals/$id"
                            params={{ id: p.id }}
                            className="font-medium hover:underline"
                          >
                            {p.title}
                          </Link>
                          {p.reference ? (
                            <div className="text-[11.5px] text-muted-foreground">{p.reference}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.clientSnapshot?.name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <BusinessDocumentStatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {p.validUntil?.slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              title="View"
                              onClick={() =>
                                navigate({ to: "/business/proposals/$id", params: { id: p.id } })
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </IconButton>
                            {canEdit && draft ? (
                              <IconButton
                                title="Send"
                                onClick={() => setConfirm({ action: "send", p })}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit ? (
                              <IconButton
                                title="Duplicate"
                                onClick={() => setConfirm({ action: "duplicate", p })}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && archivable ? (
                              <IconButton
                                title="Archive"
                                onClick={() => setConfirm({ action: "archive", p })}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && draft ? (
                              <IconButton
                                title="Delete"
                                onClick={() => setConfirm({ action: "delete", p })}
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
              {data.total} proposal{data.total === 1 ? "" : "s"}
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
          confirm?.action === "send"
            ? "Send this proposal?"
            : confirm?.action === "archive"
              ? "Archive this proposal?"
              : confirm?.action === "delete"
                ? "Delete this draft?"
                : "Duplicate this proposal?"
        }
        description={
          confirm?.action === "send"
            ? "The proposal will be locked and can no longer be edited."
            : confirm?.action === "archive"
              ? "The proposal stays visible but is marked archived."
              : confirm?.action === "delete"
                ? "This draft will be permanently deleted."
                : "A new editable draft will be created."
        }
        confirmLabel={
          confirm?.action === "delete"
            ? "Delete"
            : confirm?.action === "archive"
              ? "Archive"
              : confirm?.action === "send"
                ? "Send"
                : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}
