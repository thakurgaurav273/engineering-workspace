import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, Eye, Send, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import { PageHeader, PageBody, Card, Button } from "@grovyn/ui/primitives";
import { ConfirmDialog } from "@/applications/business/components/confirm-dialog";
import { BusinessDocumentStatusBadge } from "@/applications/business/components/document-status-badge";
import { IconButton } from "@/applications/business/components/icon-button";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import {
  useOfferLetters,
  useOfferLetterMutations,
  OFFER_LETTER_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  EMPLOYMENT_TYPES,
  type OfferLetter,
  type OfferLetterStatus,
  type EmploymentType,
} from "@/applications/business/lib/business-offer-letters";


const STATUSES: OfferLetterStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];
type Action = "send" | "delete" | "duplicate";

export function OfferLettersPage() {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OfferLetterStatus | "">("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<{ action: Action; o: OfferLetter } | null>(null);

  const { data, isLoading, isError, isFetching } = useOfferLetters(
    { page, limit: 20, search, status, employmentType, sort: "createdAt", order: "desc" },
    flags.platformShell && available,
  );
  const { send, duplicate, remove } = useOfferLetterMutations();
  const pending = send.isPending || duplicate.isPending || remove.isPending;

  if (!flags.platformShell || appsLoading || !available) return null;

  const offers = data?.data ?? [];

  const runConfirm = () => {
    if (!confirm) return;
    const { action, o } = confirm;
    const close = () => setConfirm(null);
    if (action === "send")
      send.mutate(o.id, {
        onSuccess: () => {
          toast.success("Offer letter sent");
          close();
        },
        onError: () => toast.error("Couldn't send"),
      });
    else if (action === "delete")
      remove.mutate(o.id, {
        onSuccess: () => {
          toast.success("Draft deleted");
          close();
        },
        onError: () => toast.error("Couldn't delete"),
      });
    else if (action === "duplicate")
      duplicate.mutate(o.id, {
        onSuccess: (created: OfferLetter) => {
          toast.success("Draft created");
          close();
          navigate.push(`/business/offer-letters/${created.id}`);
        },
        onError: () => toast.error("Couldn't duplicate"),
      });
  };

  return (
    <AppShell>
      <PageHeader
        title="Offer Letters"
        description="Business Operations"
        actions={
          canEdit ? (
            <Button onClick={() => navigate.push("/business/offer-letters/new")}>
              <Plus className="h-4 w-4" /> New offer letter
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
              placeholder="Search candidate, position or number…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as OfferLetterStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {OFFER_LETTER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={employmentType}
            onChange={(e) => {
              setEmploymentType(e.target.value as EmploymentType | "");
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px]"
          >
            <option value="">All types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_TYPE_LABELS[t]}
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
              Couldn't load offer letters.
            </div>
          ) : offers.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[14px] font-medium">No offer letters yet</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Create your first offer letter to get started.
              </p>
              {canEdit ? (
                <Button
                  className="mt-4"
                  onClick={() => navigate.push("/business/offer-letters/new")}
                >
                  <Plus className="h-4 w-4" /> New offer letter
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Candidate</th>
                    <th className="px-4 py-2.5 font-medium">Position</th>
                    <th className="px-4 py-2.5 font-medium">Number</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Offer date</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => {
                    const draft = o.status === "DRAFT";
                    return (
                      <tr
                        key={o.id}
                        className="border-b border-border last:border-0 hover:bg-accent/40"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/business/offer-letters/${o.id}`}
                            className="font-medium hover:underline"
                          >
                            {o.candidateName}
                          </Link>
                          <div className="text-[11.5px] text-muted-foreground">
                            {o.candidateEmail}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.position}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{o.number ?? "-"}</td>
                        <td className="px-4 py-2.5">
                          <BusinessDocumentStatusBadge status={o.status} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {o.offerDate?.slice(0, 10) ?? "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              title="View"
                              onClick={() =>
                                navigate.push(`/business/offer-letters/${o.id}`)
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </IconButton>
                            {canEdit && draft ? (
                              <IconButton
                                title="Send"
                                onClick={() => setConfirm({ action: "send", o })}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit ? (
                              <IconButton
                                title="Duplicate"
                                onClick={() => setConfirm({ action: "duplicate", o })}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </IconButton>
                            ) : null}
                            {canEdit && draft ? (
                              <IconButton
                                title="Delete"
                                onClick={() => setConfirm({ action: "delete", o })}
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
              {data.total} offer letter{data.total === 1 ? "" : "s"}
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
            ? "Send this offer letter?"
            : confirm?.action === "delete"
              ? "Delete this draft?"
              : "Duplicate this offer letter?"
        }
        description={
          confirm?.action === "send"
            ? "A permanent offer number will be reserved and it will be locked."
            : confirm?.action === "delete"
              ? "This draft will be permanently deleted."
              : "A new editable draft will be created."
        }
        confirmLabel={
          confirm?.action === "delete"
            ? "Delete"
            : confirm?.action === "send"
              ? "Send"
              : "Duplicate"
        }
        onConfirm={runConfirm}
      />
    </AppShell>
  );
}
