import { useNavigate } from "@tanstack/react-router";
import { BusinessDocumentEditor } from "./business-document-editor";
import { useQuotationMutations, type Quotation } from "@/lib/business-quotations";

// Thin wrapper over the shared BusinessDocumentEditor — quotation-specific config only.
export function QuotationEditor({ quotation }: { quotation?: Quotation }) {
  const navigate = useNavigate();
  const { create, update } = useQuotationMutations();
  return (
    <BusinessDocumentEditor
      document={quotation}
      sectionLabel="Quotation information"
      dateLabel="Expiry date"
      dateField="expiryDate"
      dateRequired
      savedNoun="Quotation"
      createPending={create.isPending}
      updatePending={update.isPending}
      onCreate={(body, cb) => create.mutate(body, cb)}
      onUpdate={(id, body, cb) => update.mutate({ id, body }, cb)}
      onSaved={(id) => navigate({ to: "/business/quotations/$id", params: { id } })}
    />
  );
}
