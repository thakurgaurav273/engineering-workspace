import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export interface DashboardSummary {
  currency: string;
  totals: { collected: number; outstanding: number; invoiced: number };
  counts: {
    invoices: number;
    quotations: number;
    proposals: number;
    offerLetters: number;
    clients: number;
    invoicesByStatus: Record<string, number>;
  };
  monthlyRevenue: { month: string; amount: number }[];
  recentInvoices: {
    id: string;
    number: string | null;
    status: string;
    grandTotal: number;
    amountPaid: number;
    currency: string;
    issueDate: string | null;
    clientName: string | null;
  }[];
}

export function useDashboard(enabled = true) {
  return useQuery<DashboardSummary>({
    queryKey: ["business", "dashboard"],
    queryFn: () => api.get("/business/dashboard"),
    enabled,
  });
}
