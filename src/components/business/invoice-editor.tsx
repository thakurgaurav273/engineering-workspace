import { useNavigate } from "@tanstack/react-router";
import { BusinessDocumentEditor, Totals } from "./business-document-editor";
import { useInvoiceMutations, type Invoice } from "@/lib/business-invoices";

// Thin wrapper over the shared BusinessDocumentEditor — invoice-specific config only.
export { Totals };

export function InvoiceEditor({ invoice }: { invoice?: Invoice }) {
  const navigate = useNavigate();
  const { create, update } = useInvoiceMutations();
  return (
    <BusinessDocumentEditor
      document={invoice}
      sectionLabel="Invoice information"
      dateLabel="Due date"
      dateField="dueDate"
      savedNoun="Invoice"
      createPending={create.isPending}
      updatePending={update.isPending}
      onCreate={(body, cb) => create.mutate(body, cb)}
      onUpdate={(id, body, cb) => update.mutate({ id, body }, cb)}
      onSaved={(id) => navigate({ to: "/business/invoices/$id", params: { id } })}
    />
  );
}
