import {
  BusinessDocumentType,
  Invoice,
  InvoiceLine,
  InvoiceSection,
  OfferLetter,
  Proposal,
  ProposalSection,
  Quotation,
  QuotationLine,
  QuotationSection,
} from '@prisma/client';
import { stripActiveContent } from './template-engine';

/**
 * What a template can print, per document type. Unlike a free-form schema, the data always
 * comes from our own records, so each type has a fixed variable tree (shown in the editor's
 * Variables panel) and a context builder that turns a record into exactly that shape.
 * Money fields are plain numbers - templates format them with `| money`.
 */

export type VarType = 'text' | 'number' | 'money' | 'date' | 'html' | 'image' | 'boolean' | 'object' | 'list';

export interface VarSpec {
  key: string;
  label: string;
  type: VarType;
  description?: string;
  /** Object fields, or the fields of each item for lists. */
  children?: VarSpec[];
}

export const TEMPLATED_TYPES = ['INVOICE', 'QUOTATION', 'PROPOSAL', 'OFFER_LETTER'] as const;
export type TemplatedType = (typeof TEMPLATED_TYPES)[number];

export function isTemplatedType(type: BusinessDocumentType | string): type is TemplatedType {
  return (TEMPLATED_TYPES as readonly string[]).includes(type);
}

const v = (key: string, label: string, type: VarType, description?: string, children?: VarSpec[]): VarSpec => ({
  key,
  label,
  type,
  ...(description && { description }),
  ...(children && { children }),
});

// ---------------------------------------------------------------- shared blocks

const DOCUMENT = v('document', 'Document', 'object', 'Facts about the document being rendered.', [
  v('title', 'Title', 'text', 'e.g. "Tax Invoice", "Quotation".'),
  v('number', 'Number', 'text', 'Empty until the document is issued/sent.'),
  v('date', 'Date', 'date'),
  v('currency', 'Currency', 'text', 'ISO code; `| money` uses it by default.'),
  v('status', 'Status', 'text'),
  v('generated_at', 'Generated at', 'date'),
]);

const COMPANY = v('company', 'Your company', 'object', 'From Business → Company.', [
  v('name', 'Display name', 'text'),
  v('legal_name', 'Legal name', 'text'),
  v('logo_url', 'Logo URL', 'image', 'Use as <img src="{{ company.logo_url }}">.'),
  v('address', 'Address (one line)', 'text'),
  v('address_line1', 'Address line 1', 'text'),
  v('address_line2', 'Address line 2', 'text'),
  v('city', 'City', 'text'),
  v('state', 'State', 'text'),
  v('postal_code', 'Postal code', 'text'),
  v('country', 'Country', 'text'),
  v('gstin', 'GSTIN', 'text'),
  v('pan', 'PAN', 'text'),
  v('cin', 'CIN', 'text'),
  v('email', 'Email', 'text'),
  v('phone', 'Phone', 'text'),
  v('website', 'Website', 'text'),
  v('footer_notes', 'Invoice footer notes', 'text'),
  v('bank', 'Bank details', 'object', undefined, [
    v('name', 'Bank name', 'text'),
    v('account_name', 'Account name', 'text'),
    v('account_number', 'Account number', 'text'),
    v('ifsc', 'IFSC', 'text'),
    v('upi', 'UPI ID', 'text'),
  ]),
  v('signatory', 'Authorised signatory', 'object', undefined, [
    v('name', 'Name', 'text'),
    v('designation', 'Designation', 'text'),
  ]),
]);

const CLIENT = v('client', 'Client', 'object', 'The client as of issue (live while a draft).', [
  v('name', 'Name', 'text'),
  v('company_name', 'Company name', 'text'),
  v('email', 'Email', 'text'),
  v('gstin', 'GSTIN', 'text'),
  v('billing_state', 'Billing state', 'text'),
  v('billing_country', 'Billing country', 'text'),
]);

const LINES = v('lines', 'Line items', 'list', 'Loop with {% for line in lines %} … {% endfor %}.', [
  v('index', 'Row number', 'number', '1, 2, 3…'),
  v('description', 'Description', 'text'),
  v('notes', 'Notes', 'text'),
  v('quantity', 'Quantity', 'number'),
  v('unit', 'Unit', 'text'),
  v('unit_price', 'Unit price', 'money'),
  v('discount', 'Discount', 'number'),
  v('discount_label', 'Discount (formatted)', 'text', '"10%", a fixed amount, or "-".'),
  v('tax_rate', 'Tax rate %', 'number'),
  v('taxable', 'Taxable amount', 'money'),
  v('tax', 'Tax amount', 'money'),
  v('amount', 'Line total', 'money'),
]);

const COLUMNS = v('columns', 'Optional columns', 'object', 'Whether any line uses it - hide the column when not.', [
  v('quantity', 'Quantity used', 'boolean', 'Some line has a quantity other than 1.'),
  v('unit', 'Unit used', 'boolean', 'Some line has a unit.'),
  v('discount', 'Discount used', 'boolean', 'Some line has a discount.'),
]);

const TAXES = v('taxes', 'Tax breakdown', 'list', 'One row per tax (CGST, SGST, IGST…).', [
  v('name', 'Name', 'text'),
  v('rate', 'Rate %', 'number'),
  v('amount', 'Amount', 'money'),
]);

const SECTIONS = v('sections', 'Sections', 'list', 'Rich-text sections - print content with | html.', [
  v('title', 'Title', 'text'),
  v('content', 'Content', 'html'),
]);

const totals = (extra: VarSpec[] = []) => [
  v('subtotal', 'Subtotal', 'money'),
  v('discount_total', 'Discount', 'money'),
  v('taxable_total', 'Taxable total', 'money'),
  v('tax_total', 'Tax total', 'money'),
  v('round_off', 'Round off', 'money'),
  v('grand_total', 'Grand total', 'money'),
  ...extra,
  v('notes', 'Notes', 'text'),
  v('terms', 'Terms', 'text'),
  v('price_mode', 'Price mode', 'text', 'EXCLUSIVE or INCLUSIVE of tax.'),
];

export const TEMPLATE_VARIABLES: Record<TemplatedType, VarSpec[]> = {
  INVOICE: [
    DOCUMENT,
    COMPANY,
    CLIENT,
    v('invoice', 'Invoice', 'object', undefined, [
      v('type', 'Type', 'text', 'STANDARD, PROFORMA, TAX…'),
      v('type_label', 'Type label', 'text', '"Proforma Invoice"…'),
      v('issue_date', 'Issue date', 'date'),
      v('due_date', 'Due date', 'date'),
      ...totals([v('amount_paid', 'Amount paid', 'money'), v('balance_due', 'Balance due', 'money')]),
    ]),
    LINES,
    COLUMNS,
    TAXES,
    SECTIONS,
  ],
  QUOTATION: [
    DOCUMENT,
    COMPANY,
    CLIENT,
    v('quotation', 'Quotation', 'object', undefined, [
      v('issue_date', 'Issue date', 'date'),
      v('expiry_date', 'Valid until', 'date'),
      ...totals(),
    ]),
    LINES,
    COLUMNS,
    TAXES,
    SECTIONS,
  ],
  PROPOSAL: [
    DOCUMENT,
    COMPANY,
    CLIENT,
    v('proposal', 'Proposal', 'object', undefined, [
      v('title', 'Title', 'text'),
      v('reference', 'Reference', 'text'),
      v('summary', 'Summary', 'text'),
      v('valid_until', 'Valid until', 'date'),
    ]),
    SECTIONS,
  ],
  OFFER_LETTER: [
    DOCUMENT,
    COMPANY,
    v('offer', 'Offer', 'object', undefined, [
      v('is_internship', 'Is internship', 'boolean'),
      v('employment_type', 'Employment type', 'text', '"Full-time", "Internship"…'),
      v('position', 'Position', 'text'),
      v('designation', 'Designation', 'text'),
      v('department', 'Department', 'text'),
      v('reporting_manager', 'Reporting manager', 'text'),
      v('work_location', 'Work location', 'text'),
      v('start_date', 'Start date', 'date'),
      v('valid_until', 'Accept by', 'date'),
      v('base_salary', 'Base salary', 'money'),
      v('variable_pay', 'Variable pay', 'money'),
      v('notice_period', 'Notice period', 'text'),
      v('probation_period', 'Probation period', 'text'),
      v('body', 'Letter body', 'html', 'The clauses edited on the offer - print with | html.'),
      v('signature_url', 'Signature image', 'image'),
      v('signatory_name', 'Signatory name', 'text'),
      v('signatory_designation', 'Signatory designation', 'text'),
    ]),
    v('candidate', 'Candidate', 'object', undefined, [
      v('name', 'Name', 'text'),
      v('email', 'Email', 'text'),
      v('phone', 'Phone', 'text'),
      v('address', 'Address', 'text'),
    ]),
  ],
};

// ---------------------------------------------------------------- context builders

type Json = Record<string, unknown> | null | undefined;
const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));

function companyContext(snapshot: unknown) {
  const c = (snapshot ?? {}) as Record<string, unknown>;
  const address = ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country']
    .map((k) => str(c[k]).trim())
    .filter(Boolean)
    .join(', ');
  return {
    name: str(c.displayName) || str(c.legalName) || 'Our Company',
    legal_name: str(c.legalName),
    logo_url: str(c.logoUrl),
    address,
    address_line1: str(c.addressLine1),
    address_line2: str(c.addressLine2),
    city: str(c.city),
    state: str(c.state),
    postal_code: str(c.postalCode),
    country: str(c.country),
    gstin: str(c.gstin),
    pan: str(c.pan),
    cin: str(c.cin),
    email: str(c.contactEmail),
    phone: str(c.contactPhone),
    website: str(c.website),
    footer_notes: str(c.invoiceFooterNotes),
    bank: {
      name: str(c.bankName),
      account_name: str(c.bankAccountName),
      account_number: str(c.bankAccountNumber),
      ifsc: str(c.bankIfsc),
      upi: str(c.upiId),
    },
    signatory: {
      name: str(c.authorizedSignatoryName),
      designation: str(c.authorizedSignatoryDesignation),
    },
  };
}

function clientContext(snapshot: unknown, fallbackName?: string | null) {
  const c = (snapshot ?? {}) as Record<string, unknown>;
  return {
    name: str(c.name) || str(c.companyName) || str(fallbackName),
    company_name: str(c.companyName),
    email: str(c.email),
    gstin: str(c.gstin),
    billing_state: str(c.billingState),
    billing_country: str(c.billingCountry),
  };
}

type LineRow = InvoiceLine | QuotationLine;

function linesContext(lines: LineRow[]) {
  return [...lines]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l, i) => {
      const taxes = (Array.isArray(l.taxes) ? l.taxes : []) as { rate?: number }[];
      return {
        index: i + 1,
        description: l.description,
        notes: str(l.notes),
        quantity: l.quantity ?? 1,
        unit: str(l.unit),
        unit_price: l.unitPrice ?? 0,
        discount: l.discount ?? 0,
        discount_label: l.discount ? `${l.discount}${l.discountType === 'FIXED' ? '' : '%'}` : '-',
        tax_rate: taxes.reduce((sum, t) => sum + (Number(t.rate) || 0), 0),
        taxable: l.lineTaxable ?? 0,
        tax: l.lineTax ?? 0,
        amount: l.lineTotal ?? 0,
      };
    });
}

/** Qty/unit/discount mean nothing on e.g. fixed-price development work, so show them only when used. */
function columnsContext(lines: LineRow[]) {
  return {
    quantity: lines.some((l) => (l.quantity ?? 1) !== 1),
    unit: lines.some((l) => !!str(l.unit)),
    discount: lines.some((l) => !!l.discount),
  };
}

function taxesContext(breakdown: unknown, taxTotal: number) {
  const rows = (Array.isArray(breakdown) ? breakdown : []) as { name?: string; rate?: number; amount?: number }[];
  if (!rows.length && taxTotal) return [{ name: 'Tax', rate: 0, amount: taxTotal }];
  return rows.map((t) => ({ name: str(t.name) || 'Tax', rate: Number(t.rate) || 0, amount: Number(t.amount) || 0 }));
}

function sectionsContext(sections: { title: string; content: string | null; sortOrder: number }[]) {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ title: s.title, content: stripActiveContent(s.content) }));
}

const INVOICE_TYPE_LABEL: Record<string, string> = {
  STANDARD: 'Invoice',
  PROFORMA: 'Proforma Invoice',
  TAX: 'Tax Invoice',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE: 'Debit Note',
  RECURRING: 'Invoice',
  ADVANCE: 'Advance Invoice',
  FINAL_SETTLEMENT: 'Final Settlement Invoice',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

type MoneyFields = Pick<
  Invoice,
  'subtotal' | 'discountTotal' | 'taxableTotal' | 'taxTotal' | 'roundOff' | 'grandTotal' | 'notes' | 'terms' | 'priceMode'
>;

function money(record: MoneyFields) {
  return {
    subtotal: record.subtotal ?? 0,
    discount_total: record.discountTotal ?? 0,
    taxable_total: record.taxableTotal ?? 0,
    tax_total: record.taxTotal ?? 0,
    round_off: record.roundOff ?? 0,
    grand_total: record.grandTotal ?? 0,
    notes: str(record.notes),
    terms: str(record.terms),
    price_mode: str(record.priceMode),
  };
}

export type InvoiceRecord = Invoice & { lines: InvoiceLine[]; sections: InvoiceSection[] };
export type QuotationRecord = Quotation & { lines: QuotationLine[]; sections: QuotationSection[] };
export type ProposalRecord = Proposal & { sections: ProposalSection[] };

export function invoiceContext(invoice: InvoiceRecord) {
  const amountPaid = invoice.amountPaid ?? 0;
  const typeLabel = INVOICE_TYPE_LABEL[invoice.invoiceType] ?? 'Invoice';
  return {
    document: {
      title: typeLabel,
      number: str(invoice.number),
      date: invoice.issueDate ?? invoice.createdAt,
      currency: invoice.currency || 'INR',
      status: invoice.status,
      generated_at: new Date(),
    },
    company: companyContext(invoice.companySnapshot),
    client: clientContext(invoice.clientSnapshot as Json, invoice.clientName),
    invoice: {
      type: invoice.invoiceType,
      type_label: typeLabel,
      issue_date: invoice.issueDate,
      due_date: invoice.dueDate,
      ...money(invoice),
      amount_paid: amountPaid,
      balance_due: (invoice.grandTotal ?? 0) - amountPaid,
    },
    lines: linesContext(invoice.lines ?? []),
    columns: columnsContext(invoice.lines ?? []),
    taxes: taxesContext(invoice.taxBreakdown, invoice.taxTotal ?? 0),
    sections: sectionsContext(invoice.sections ?? []),
  };
}

export function quotationContext(quotation: QuotationRecord) {
  return {
    document: {
      title: 'Quotation',
      number: str(quotation.number),
      date: quotation.issueDate ?? quotation.createdAt,
      currency: quotation.currency || 'INR',
      status: quotation.status,
      generated_at: new Date(),
    },
    company: companyContext(quotation.companySnapshot),
    client: clientContext(quotation.clientSnapshot as Json, quotation.clientName),
    quotation: {
      issue_date: quotation.issueDate,
      expiry_date: quotation.expiryDate,
      ...money(quotation),
    },
    lines: linesContext(quotation.lines ?? []),
    columns: columnsContext(quotation.lines ?? []),
    taxes: taxesContext(quotation.taxBreakdown, quotation.taxTotal ?? 0),
    sections: sectionsContext(quotation.sections ?? []),
  };
}

export function proposalContext(proposal: ProposalRecord) {
  return {
    document: {
      title: 'Proposal',
      number: str(proposal.reference),
      date: proposal.createdAt,
      currency: 'INR',
      status: proposal.status,
      generated_at: new Date(),
    },
    company: companyContext(proposal.companySnapshot),
    client: clientContext(proposal.clientSnapshot as Json, proposal.clientName),
    proposal: {
      title: proposal.title,
      reference: str(proposal.reference),
      summary: str(proposal.summary),
      valid_until: proposal.validUntil,
    },
    sections: sectionsContext(proposal.sections ?? []),
  };
}

export function offerLetterContext(offer: OfferLetter, body: string) {
  const isInternship = offer.employmentType === 'INTERNSHIP';
  return {
    document: {
      title: isInternship ? 'Internship Offer Letter' : 'Offer Letter',
      number: str(offer.number),
      date: offer.offerDate ?? offer.createdAt,
      currency: offer.currency || 'INR',
      status: offer.status,
      generated_at: new Date(),
    },
    company: companyContext(offer.companySnapshot),
    offer: {
      is_internship: isInternship,
      employment_type: EMPLOYMENT_LABEL[offer.employmentType] ?? str(offer.employmentType),
      position: offer.position,
      designation: str(offer.designation),
      department: str(offer.department),
      reporting_manager: str(offer.reportingManager),
      work_location: str(offer.workLocation),
      start_date: offer.startDate,
      valid_until: offer.validUntil,
      base_salary: offer.baseSalary ?? 0,
      variable_pay: offer.variablePay ?? 0,
      notice_period: str(offer.noticePeriod),
      probation_period: str(offer.probationPeriod),
      body: stripActiveContent(body),
      signature_url: str(offer.signatureUrl),
      signatory_name: str(offer.signatoryName),
      signatory_designation: str(offer.signatoryDesignation),
    },
    candidate: {
      name: offer.candidateName,
      email: str(offer.candidateEmail),
      phone: str(offer.candidatePhone),
      address: str(offer.candidateAddress),
    },
  };
}

// ---------------------------------------------------------------- sample data

const SAMPLE_COMPANY = {
  displayName: 'Nimbus Labs',
  legalName: 'Nimbus Labs Private Limited',
  logoUrl: '',
  addressLine1: '4th Floor, Prestige Tech Park',
  addressLine2: 'Outer Ring Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560103',
  country: 'India',
  gstin: '29ABCDE1234F1Z5',
  pan: 'ABCDE1234F',
  cin: 'U72900KA2020PTC123456',
  contactEmail: 'billing@nimbuslabs.example',
  contactPhone: '+91 80 4000 1234',
  website: 'nimbuslabs.example',
  invoiceFooterNotes: 'Thank you for your business.',
  bankName: 'HDFC Bank',
  bankAccountName: 'Nimbus Labs Private Limited',
  bankAccountNumber: '50200012345678',
  bankIfsc: 'HDFC0001234',
  upiId: 'nimbuslabs@hdfcbank',
  authorizedSignatoryName: 'Aditi Rao',
  authorizedSignatoryDesignation: 'Director',
};

const SAMPLE_CLIENT = {
  name: 'Acme Retail',
  companyName: 'Acme Retail Pvt Ltd',
  email: 'accounts@acmeretail.example',
  gstin: '29AAACA1234B1Z9',
  billingState: 'Karnataka',
  billingCountry: 'India',
};

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

function sampleLines(): InvoiceLine[] {
  const rows = [
    { description: 'Mobile app - design & build (phase 1)', quantity: 1, unit: 'milestone', unitPrice: 350000, notes: 'iOS + Android, includes QA' },
    { description: 'Cloud hosting (monthly)', quantity: 3, unit: 'month', unitPrice: 12000, notes: '' },
    { description: 'Support retainer', quantity: 10, unit: 'hour', unitPrice: 2500, notes: '' },
  ];
  return rows.map((r, i) => {
    const taxable = r.quantity * r.unitPrice;
    return {
      id: `l${i}`,
      invoiceId: 'sample',
      description: r.description,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unitPrice,
      discount: 0,
      discountType: 'PERCENT',
      taxes: [{ type: 'GST', rate: 18 }],
      notes: r.notes,
      lineTaxable: taxable,
      lineTax: taxable * 0.18,
      lineTotal: taxable * 1.18,
      sortOrder: i,
    } as InvoiceLine;
  });
}

const SAMPLE_SECTIONS = [
  { title: 'Scope', content: '<p>Design and delivery of the customer mobile app, as agreed in the kickoff.</p><ul><li>Onboarding and login</li><li>Catalogue and checkout</li></ul>', sortOrder: 0 },
  { title: 'Payment schedule', content: '<p>50% on signing, 50% on delivery.</p>', sortOrder: 1 },
];

/** Realistic data for previews when no real document is picked. */
export function sampleContext(type: TemplatedType): Record<string, unknown> {
  const lines = sampleLines();
  const subtotal = lines.reduce((s, l) => s + l.lineTaxable, 0);
  const tax = subtotal * 0.18;
  const common = {
    status: 'DRAFT',
    currency: 'INR',
    companySnapshot: SAMPLE_COMPANY,
    clientSnapshot: SAMPLE_CLIENT,
    clientName: null,
    createdAt: new Date(),
    sections: SAMPLE_SECTIONS,
    lines,
    subtotal,
    discountTotal: 0,
    taxableTotal: subtotal,
    taxTotal: tax,
    roundOff: 0,
    grandTotal: subtotal + tax,
    taxBreakdown: [
      { name: 'CGST', rate: 9, amount: tax / 2 },
      { name: 'SGST', rate: 9, amount: tax / 2 },
    ],
    notes: 'Please quote the invoice number with your payment.',
    terms: 'Payment due within 15 days.\nLate payments attract 1.5% interest per month.',
    priceMode: 'EXCLUSIVE',
  };
  switch (type) {
    case 'INVOICE':
      return invoiceContext({
        ...common,
        number: 'INV-2026-0042',
        invoiceType: 'TAX',
        issueDate: day(0),
        dueDate: day(15),
        amountPaid: 0,
      } as unknown as InvoiceRecord);
    case 'QUOTATION':
      return quotationContext({
        ...common,
        number: 'QT-2026-0017',
        issueDate: day(0),
        expiryDate: day(30),
      } as unknown as QuotationRecord);
    case 'PROPOSAL':
      return proposalContext({
        ...common,
        title: 'Customer mobile app',
        reference: 'PR-2026-0008',
        summary: 'A phased plan to launch the Acme Retail shopping app in 12 weeks.',
        validUntil: day(30),
      } as unknown as ProposalRecord);
    case 'OFFER_LETTER':
      return offerLetterContext(
        {
          number: 'OL-2026-0011',
          status: 'DRAFT',
          offerDate: day(0),
          validUntil: day(7),
          createdAt: new Date(),
          companySnapshot: SAMPLE_COMPANY,
          employmentType: 'FULL_TIME',
          position: 'Senior Backend Engineer',
          designation: 'Senior Engineer II',
          department: 'Engineering',
          reportingManager: 'Rohan Mehta',
          workLocation: 'Bengaluru (hybrid)',
          startDate: day(30),
          baseSalary: 3200000,
          variablePay: 300000,
          currency: 'INR',
          noticePeriod: '60 days',
          probationPeriod: '3 months',
          candidateName: 'Karan Shah',
          candidateEmail: 'karan@example.com',
          candidatePhone: '+91 98765 43210',
          candidateAddress: '12, MG Road\nPune 411001',
          signatoryName: 'Aditi Rao',
          signatoryDesignation: 'Director',
          signatureUrl: '',
        } as unknown as OfferLetter,
        '<p>Dear Karan,</p><p>We are delighted to offer you the position of <strong>Senior Backend Engineer</strong> at Nimbus Labs, starting on the date above.</p><p>Your annual compensation is set out below and in the attached annexure.</p>',
      );
  }
}
