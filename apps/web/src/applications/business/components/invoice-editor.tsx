import { BusinessDocumentEditor, Totals } from "./business-document-editor";
import { useRouter } from "next/navigation";
import {
  useInvoiceMutations,
  INVOICE_TYPES,
  INVOICE_TYPE_LABELS,
  type Invoice,
} from "@/applications/business/lib/business-invoices";

// Thin wrapper over the shared BusinessDocumentEditor — invoice-specific config only.
export { Totals };

export function InvoiceEditor({ invoice }: { invoice?: Invoice }) {
  const navigate = useRouter();
  const { create, update } = useInvoiceMutations();
  return (
    <BusinessDocumentEditor
      document={invoice}
      sectionLabel="Invoice information"
      dateLabel="Due date"
      dateField="dueDate"
      typeField={{
        key: "invoiceType",
        label: "Invoice type",
        defaultValue: "STANDARD",
        current: invoice?.invoiceType,
        options: INVOICE_TYPES.map((t) => ({ value: t, label: INVOICE_TYPE_LABELS[t] })),
      }}
      savedNoun="Invoice"
      createPending={create.isPending}
      updatePending={update.isPending}
      onCreate={(body, cb) => create.mutate(body, cb)}
      onUpdate={(id, body, cb) => update.mutate({ id, body }, cb)}
      onSaved={(id) => navigate.push(`/business/invoices/${id}`)}
    />
  );
}
