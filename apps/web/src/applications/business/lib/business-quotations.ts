import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type {
  InvoiceLine,
  Paginated,
  DocumentPreview,
} from "@/applications/business/lib/business-invoices";

export type QuotationStatus =
  "DRAFT" | "ISSUED" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface QuotationSection {
  id?: string;
  title: string;
  content: string;
  sortOrder?: number;
}

export interface Quotation {
  id: string;
  templateId?: string | null;
  orgId: string;
  clientId: string;
  clientName?: string | null;
  number: string | null;
  status: QuotationStatus;
  currency: string;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  terms: string | null;
  priceMode: string;
  clientSnapshot?: { name?: string } | null;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  taxBreakdown?: { name: string; rate: number; amount: number }[] | null;
  createdAt: string;
  lines?: InvoiceLine[];
  sections?: QuotationSection[];
}

export interface QuotationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: QuotationStatus | "";
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "createdAt" | "issueDate" | "grandTotal";
  order?: "asc" | "desc";
}

function toQuery(p: QuotationListParams): string {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.limit) q.set("limit", String(p.limit));
  if (p.search) q.set("search", p.search);
  if (p.status) q.set("status", p.status);
  if (p.clientId) q.set("clientId", p.clientId);
  if (p.dateFrom) q.set("dateFrom", p.dateFrom);
  if (p.dateTo) q.set("dateTo", p.dateTo);
  if (p.sort) q.set("sort", p.sort);
  if (p.order) q.set("order", p.order);
  return q.toString();
}

export function useQuotations(params: QuotationListParams, enabled = true) {
  return useQuery<Paginated<Quotation>>({
    queryKey: ["business", "quotations", params],
    queryFn: () => api.get(`/business/quotations?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery<Quotation>({
    queryKey: ["business", "quotations", "detail", id],
    queryFn: () => api.get(`/business/quotations/${id}`),
    enabled: !!id,
  });
}

/** The exact rendered quotation + recipient/subject that Send would email. */
export function useQuotationPreview(id: string | undefined, enabled: boolean) {
  return useQuery<DocumentPreview>({
    queryKey: ["business", "quotations", "preview", id],
    queryFn: () => api.get(`/business/quotations/${id}/preview`),
    enabled: !!id && enabled,
  });
}

/** Fetches the quotation PDF (auth-guarded binary) and opens it in a new tab. */
export async function openQuotationPdf(id: string): Promise<void> {
  const { getStoredAuth } = await import("@/platform/auth/auth");
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const res = await fetch(`${base}/business/quotations/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getStoredAuth()?.accessToken ?? ""}` },
  });
  if (!res.ok) throw new Error("Couldn't generate the PDF");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useQuotationMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["business", "quotations"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
    if (id) qc.invalidateQueries({ queryKey: ["business", "quotations", "detail", id] });
  };
  return {
    send: useMutation({
      mutationFn: (id: string) => api.post<Quotation>(`/business/quotations/${id}/send`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    create: useMutation({
      mutationFn: (body: unknown) => api.post<Quotation>("/business/quotations", body),
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        api.patch<Quotation>(`/business/quotations/${id}`, body),
      onSuccess: (_d, v) => invalidate(v.id),
    }),
    issue: useMutation({
      mutationFn: (id: string) => api.post<Quotation>(`/business/quotations/${id}/issue`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    cancel: useMutation({
      mutationFn: (id: string) => api.post<Quotation>(`/business/quotations/${id}/cancel`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    duplicate: useMutation({
      mutationFn: (id: string) => api.post<Quotation>(`/business/quotations/${id}/duplicate`, {}),
      onSuccess: () => invalidate(),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/business/quotations/${id}`),
      onSuccess: () => invalidate(),
    }),
  };
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
