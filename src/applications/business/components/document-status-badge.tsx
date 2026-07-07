// Shared status badge for business documents. Accepts any InvoiceStatus,
// QuotationStatus, or ProposalStatus value (a plain string), with a combined
// label + colour map.
const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  VOID: "Void",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  VIEWED: "Viewed",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

const CLASSES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-accent text-foreground",
  SENT: "bg-accent text-foreground",
  ACCEPTED: "bg-accent text-foreground",
  APPROVED: "bg-accent text-foreground",
  VIEWED: "bg-accent text-foreground",
  PAID: "bg-accent text-foreground",
  PARTIALLY_PAID: "border border-border text-muted-foreground",
  REJECTED: "border border-border text-muted-foreground",
  EXPIRED: "border border-border text-muted-foreground",
  CANCELLED: "border border-border text-muted-foreground",
  VOID: "border border-border text-muted-foreground",
  ARCHIVED: "border border-border text-muted-foreground",
};

export function BusinessDocumentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASSES[status] ?? "border border-border text-muted-foreground"}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
