import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export type PaymentMethod =
  "BANK_TRANSFER" | "UPI" | "CARD" | "CASH" | "CHEQUE" | "STRIPE" | "RAZORPAY" | "OTHER";

export interface Payment {
  id: string;
  orgId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  invoice?: {
    number: string | null;
    currency: string;
    clientSnapshot?: { name?: string } | null;
  } | null;
}

// List response mirrors the paginated envelope + a summed totalAmount from the API.
export interface PaymentsPage {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: number;
}

export interface PaymentListParams {
  page?: number;
  limit?: number;
  search?: string;
  invoiceId?: string;
  clientId?: string;
  method?: PaymentMethod | "";
  dateFrom?: string;
  dateTo?: string;
  sort?: "paymentDate" | "amount" | "createdAt";
  order?: "asc" | "desc";
}

function toQuery(p: PaymentListParams): string {
  const q = new URLSearchParams();
  if (p.page) q.set("page", String(p.page));
  if (p.limit) q.set("limit", String(p.limit));
  if (p.search) q.set("search", p.search);
  if (p.invoiceId) q.set("invoiceId", p.invoiceId);
  if (p.clientId) q.set("clientId", p.clientId);
  if (p.method) q.set("method", p.method);
  if (p.dateFrom) q.set("dateFrom", p.dateFrom);
  if (p.dateTo) q.set("dateTo", p.dateTo);
  if (p.sort) q.set("sort", p.sort);
  if (p.order) q.set("order", p.order);
  return q.toString();
}

export function usePayments(params: PaymentListParams, enabled = true) {
  return useQuery<PaymentsPage>({
    queryKey: ["business", "payments", params],
    queryFn: () => api.get(`/business/payments?${toQuery(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePaymentMutations() {
  const qc = useQueryClient();
  // Recording/removing a payment mutates the parent invoice's status + amountPaid,
  // so invalidate invoices too.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["business", "payments"] });
    qc.invalidateQueries({ queryKey: ["business", "invoices"] });
    qc.invalidateQueries({ queryKey: ["business", "dashboard"] });
  };
  return {
    create: useMutation({
      mutationFn: (body: unknown) => api.post<Payment>("/business/payments", body),
      onSuccess: () => invalidate(),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/business/payments/${id}`),
      onSuccess: () => invalidate(),
    }),
  };
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  STRIPE: "Stripe",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
