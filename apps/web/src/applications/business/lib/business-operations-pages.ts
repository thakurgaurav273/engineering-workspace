// Metadata for the Business Operations placeholder pages. Nav (labels/paths/icons) comes
// from the backend manifest; this supplies the human explanation of what each page will
// become. Keyed by the path segment after `/business` ("dashboard" is also the app root).

export interface BusinessOperationsPageMeta {
  title: string;
  description: string;
}

export const BUSINESS_OPERATIONS_PAGES: Record<string, BusinessOperationsPageMeta> = {
  dashboard: {
    title: "Business Operations Dashboard",
    description:
      "Revenue, collections, outstanding balances and recent activity across all business documents.",
  },
  clients: {
    title: "Clients",
    description:
      "Client directory with billing profiles, tax identifiers, payment terms and document history.",
  },
  quotations: {
    title: "Quotations",
    description: "Draft, send and track quotations — convertible into invoices.",
  },
  invoices: {
    title: "Invoices",
    description: "Create and manage invoices with multi-currency, GST/tax and payment tracking.",
  },
  payments: {
    title: "Payments",
    description: "Record and reconcile payments against invoices; track outstanding amounts.",
  },
  proposals: {
    title: "Proposals",
    description: "Author, version and send project proposals.",
  },
  "offer-letters": {
    title: "Offer Letters",
    description: "Generate, send and track candidate offer letters.",
  },
  company: {
    title: "Company Profile",
    description: "Company details, bank information, signatories and document numbering.",
  },
  settings: {
    title: "Business Operations Settings",
    description: "Configuration for the Business Operations application.",
  },
};
