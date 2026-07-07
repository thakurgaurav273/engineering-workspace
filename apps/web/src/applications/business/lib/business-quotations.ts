import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { InvoiceLine, Paginated } from "@/applications/business/lib/business-invoices";

export type QuotationStatus =
  "DRAFT" | "ISSUED" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export interface Quotation {
  id: string;
  orgId: string;
  clientId: string;
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

export function useQuotationMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["business", "quotations"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
    if (id) qc.invalidateQueries({ queryKey: ["business", "quotations", "detail", id] });
  };
  return {
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
