import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type InvoiceStatus =
  "DRAFT" | "ISSUED" | "SENT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "VOID";

export interface TaxSelection {
  type: "NONE" | "GST" | "CGST" | "SGST" | "IGST" | "VAT" | "CUSTOM";
  rate?: number;
  amount?: number;
  mode?: "PERCENT" | "FIXED";
  name?: string;
  reverseCharge?: boolean;
}

export interface InvoiceLine {
  id?: string;
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  discount?: number;
  discountType?: "PERCENT" | "FIXED";
  taxes?: TaxSelection[];
  notes?: string | null;
  lineTaxable?: number;
  lineTax?: number;
  lineTotal?: number;
}

export interface Invoice {
  id: string;
  orgId: string;
  clientId: string;
  number: string | null;
  status: InvoiceStatus;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
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
  amountPaid: number;
  createdAt: string;
  lines?: InvoiceLine[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TaxSummary {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxBreakdown: { name: string; rate: number; amount: number }[];
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  effectiveRate: number;
  lines: { taxable: number; taxAmount: number; total: number }[];
}

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus | "";
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "createdAt" | "issueDate" | "grandTotal";
  order?: "asc" | "desc";
}

function toQuery(p: InvoiceListParams): string {
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

export function useInvoices(params: InvoiceListParams, enabled = true) {
  return useQuery<Paginated<Invoice>>({
    queryKey: ["business", "invoices", params],
    queryFn: () => api.get(`/business/invoices?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery<Invoice>({
    queryKey: ["business", "invoices", "detail", id],
    queryFn: () => api.get(`/business/invoices/${id}`),
    enabled: !!id,
  });
}

export interface CompanyProfile {
  legalName: string;
  displayName?: string | null;
  state?: string | null;
}

export function useCompany(enabled = true) {
  return useQuery<CompanyProfile | null>({
    queryKey: ["business", "company"],
    queryFn: () => api.get("/business/company"),
    enabled,
  });
}

/** Live totals from the backend Tax Engine — the single source of truth. */
export function useInvoiceTotals(payload: unknown, enabled: boolean) {
  return useQuery<TaxSummary>({
    queryKey: ["business", "tax", "invoice-preview", payload],
    queryFn: () => api.post("/business/tax/calculate", payload),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useInvoiceMutations() {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: ["business", "invoices"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
    if (id) qc.invalidateQueries({ queryKey: ["business", "invoices", "detail", id] });
  };
  return {
    create: useMutation({
      mutationFn: (body: unknown) => api.post<Invoice>("/business/invoices", body),
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        api.patch<Invoice>(`/business/invoices/${id}`, body),
      onSuccess: (_d, v) => invalidate(v.id),
    }),
    issue: useMutation({
      mutationFn: (id: string) => api.post<Invoice>(`/business/invoices/${id}/issue`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    cancel: useMutation({
      mutationFn: (id: string) => api.post<Invoice>(`/business/invoices/${id}/cancel`, {}),
      onSuccess: (_d, id) => invalidate(id),
    }),
    duplicate: useMutation({
      mutationFn: (id: string) => api.post<Invoice>(`/business/invoices/${id}/duplicate`, {}),
      onSuccess: () => invalidate(),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/business/invoices/${id}`),
      onSuccess: () => invalidate(),
    }),
  };
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  VOID: "Void",
};

// Re-exported so existing `import { money } from "@/lib/business-invoices"` keeps working.
export { money } from "@/lib/business-format";
