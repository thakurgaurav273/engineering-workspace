import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { Paginated, DocumentPreview } from "@/applications/business/lib/business-invoices";

// Proposals are NOT financial documents — no tax, no numbering, no totals. A
// proposal is a titled document of ordered rich-text (HTML) sections.
export type ProposalStatus = "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface ProposalSection {
  id?: string;
  title: string;
  content: string;
  sortOrder?: number;
}

export interface Proposal {
  id: string;
  orgId: string;
  clientId: string;
  clientName?: string | null;
  title: string;
  reference: string | null;
  summary: string | null;
  status: ProposalStatus;
  validUntil: string | null;
  clientSnapshot?: { name?: string } | null;
  sentAt: string | null;
  createdAt: string;
  sections?: ProposalSection[];
}

export interface ProposalListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProposalStatus | "";
  clientId?: string;
  sort?: "createdAt" | "title" | "validUntil";
  order?: "asc" | "desc";
}

function toQuery(p: ProposalListParams): string {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.limit) q.set("limit", String(p.limit));
  if (p.search) q.set("search", p.search);
  if (p.status) q.set("status", p.status);
  if (p.clientId) q.set("clientId", p.clientId);
  if (p.sort) q.set("sort", p.sort);
  if (p.order) q.set("order", p.order);
  return q.toString();
}

export function useProposals(params: ProposalListParams, enabled = true) {
  return useQuery<Paginated<Proposal>>({
    queryKey: ["business", "proposals", params],
    queryFn: () => api.get(`/business/proposals?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useProposal(id: string | undefined) {
  return useQuery<Proposal>({
    queryKey: ["business", "proposals", "detail", id],
    queryFn: () => api.get(`/business/proposals/${id}`),
    enabled: !!id,
  });
}

/** The exact rendered proposal + recipient/subject that Send would email. */
export function useProposalPreview(id: string | undefined, enabled: boolean) {
  return useQuery<DocumentPreview>({
    queryKey: ["business", "proposals", "preview", id],
    queryFn: () => api.get(`/business/proposals/${id}/preview`),
    enabled: !!id && enabled,
  });
}

/** Fetches the proposal PDF (auth-guarded binary) and opens it in a new tab. */
export async function openProposalPdf(id: string): Promise<void> {
  const { getStoredAuth } = await import("@/platform/auth/auth");
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const res = await fetch(`${base}/business/proposals/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getStoredAuth()?.accessToken ?? ""}` },
  });
  if (!res.ok) throw new Error("Couldn't generate the PDF");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useProposalMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["business", "proposals"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
    if (id) qc.invalidateQueries({ queryKey: ["business", "proposals", "detail", id] });
  };
  return {
    create: useMutation({
      mutationFn: (body: unknown) => api.post<Proposal>("/business/proposals", body),
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        api.patch<Proposal>(`/business/proposals/${id}`, body),
      onSuccess: (_d, v) => invalidate(v.id),
    }),
    send: useMutation({
      mutationFn: (id: string) => api.post<Proposal>(`/business/proposals/${id}/send`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    archive: useMutation({
      mutationFn: (id: string) => api.post<Proposal>(`/business/proposals/${id}/archive`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    duplicate: useMutation({
      mutationFn: (id: string) => api.post<Proposal>(`/business/proposals/${id}/duplicate`, {}),
      onSuccess: () => invalidate(),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/business/proposals/${id}`),
      onSuccess: () => invalidate(),
    }),
  };
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};
