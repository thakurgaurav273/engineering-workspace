import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type BusinessDocumentType =
  | "INVOICE"
  | "QUOTATION"
  | "OFFER_LETTER"
  | "PROPOSAL"
  | "PURCHASE_ORDER"
  | "RECEIPT"
  | "CREDIT_NOTE"
  | "DELIVERY_NOTE";

export type NumberResetMode = "NEVER" | "YEARLY" | "MONTHLY";

export interface DocNumberingConfig {
  documentType: BusinessDocumentType;
  prefix: string;
  suffix: string;
  separator: string;
  startNumber: number;
  currentNumber: number;
  padding: number;
  resetMode: NumberResetMode;
  useFinancialYear: boolean;
  periodKey: string;
  preview: string;
}

export const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  INVOICE: "Invoice",
  QUOTATION: "Quotation",
  OFFER_LETTER: "Offer Letter",
  PROPOSAL: "Proposal",
  PURCHASE_ORDER: "Purchase Order",
  RECEIPT: "Receipt",
  CREDIT_NOTE: "Credit Note",
  DELIVERY_NOTE: "Delivery Note",
};

export function useDocNumbering(enabled: boolean) {
  return useQuery<DocNumberingConfig[]>({
    queryKey: ["business", "document-numbering"],
    queryFn: () => api.get("/business/document-numbering"),
    enabled,
  });
}

export function useUpdateDocNumbering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      body,
    }: {
      type: BusinessDocumentType;
      body: Partial<DocNumberingConfig>;
    }) => api.patch(`/business/document-numbering/${type}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business", "document-numbering"] }),
  });
}

// --- Client-side preview mirror (matches the backend util). Cosmetic only; the server
// remains the single source of truth for actually-reserved numbers. ---

function fyStart(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}
function yearToken(c: Pick<DocNumberingConfig, "useFinancialYear">, d: Date): string {
  if (c.useFinancialYear) {
    const y = fyStart(d);
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  }
  return String(d.getFullYear());
}
function periodKey(c: DocNumberingConfig, d: Date): string {
  if (c.resetMode === "NEVER") return "";
  const b = c.useFinancialYear ? String(fyStart(d)) : String(d.getFullYear());
  return c.resetMode === "MONTHLY" ? `${b}-${String(d.getMonth() + 1).padStart(2, "0")}` : b;
}

export function previewNumber(c: DocNumberingConfig): string {
  const d = new Date();
  const reset = c.resetMode !== "NEVER" && c.periodKey !== periodKey(c, d);
  const seq = reset || c.currentNumber < c.startNumber ? c.startNumber : c.currentNumber + 1;

  const parts: string[] = [];
  if (c.prefix) parts.push(c.prefix);
  if (c.resetMode !== "NEVER" || c.useFinancialYear) parts.push(yearToken(c, d));
  if (c.resetMode === "MONTHLY") parts.push(String(d.getMonth() + 1).padStart(2, "0"));
  parts.push(String(seq).padStart(Math.max(1, c.padding), "0"));
  let out = parts.join(c.separator);
  if (c.suffix) out += c.separator + c.suffix;
  return out;
}
