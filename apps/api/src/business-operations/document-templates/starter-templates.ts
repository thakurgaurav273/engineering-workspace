import { TemplatedType } from './template-variables';

/**
 * Built-in starter layouts - the teal letterhead documents the app has always produced,
 * rewritten as Liquid templates (now with logo, bank details and amount in words). They are
 * what an org renders until it publishes its own default, and what "New template" copies.
 * Each is a complete standalone document: templates can't include each other.
 */

export interface StarterTemplate {
  key: string;
  name: string;
  description: string;
  documentType: TemplatedType;
  html: string;
}

const STYLE = `
  <style>
    @page { size: A4; margin: 12mm 12mm 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #334155; }
    h1, h2, h3, p, ul, ol, table, tr { page-break-inside: avoid; }
    /* @page margins only apply to the PDF; give on-screen previews and emails the same breathing room. */
    @media screen { body { padding: 12mm; max-width: 210mm; margin: 0 auto; background: #fff; } }
    .ink { color: #0f172a; }
    .muted { color: #64748b; }
    .label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
    .letterhead { border-bottom: 4px solid #0f766e; padding-bottom: 14px; display: flex; justify-content: space-between; gap: 16px; }
    .letterhead .company { max-width: 46%; }
    .letterhead .logo { max-height: 44px; max-width: 160px; margin-bottom: 6px; display: block; }
    .letterhead .name { font-size: 20px; font-weight: 800; letter-spacing: -.02em; color: #0f172a; }
    .letterhead .meta { font-size: 11px; color: #64748b; margin-top: 2px; }
    .letterhead .title { font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: .02em; text-align: center; align-self: flex-start; }
    .letterhead .ref { text-align: right; white-space: nowrap; }
    .pill { display: inline-block; background: #f1f5f9; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #0f172a; }
    .dated { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .14em; margin-top: 8px; }
    .party { margin-top: 22px; display: flex; justify-content: space-between; gap: 24px; }
    .party .who { font-size: 12.5px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.items th { background: #f1f5f9; padding: 8px 6px; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; text-align: right; }
    table.items td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; text-align: right; vertical-align: top; }
    table.items th.left, table.items td.left { text-align: left; }
    table.items td.desc { color: #0f172a; }
    table.items .note { font-size: 10.5px; color: #64748b; margin-top: 2px; }
    table.totals { margin-left: auto; margin-top: 14px; border-collapse: collapse; }
    table.totals td { padding: 4px 0; font-size: 12px; text-align: right; }
    table.totals td + td { padding-left: 28px; white-space: nowrap; }
    table.totals tr.strong td { font-weight: 700; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    .words { text-align: right; font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic; }
    .section { margin-top: 22px; }
    .section h3 { margin: 0; font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
    .section .body { margin-top: 6px; font-size: 12.5px; line-height: 1.55; }
    .block { margin-top: 18px; }
    .block .text { margin-top: 4px; }
    .columns { display: flex; gap: 24px; margin-top: 24px; }
    .columns > div { flex: 1; }
    .sign { margin-top: 30px; text-align: right; }
    .sign img { max-height: 56px; max-width: 220px; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #64748b; text-align: center; }
  </style>`;

function head(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!-- Page numbers in the footer: bottom-left | bottom-center | bottom-right (remove to hide). -->
  <meta name="page-numbers" content="bottom-right">${STYLE}
</head>`;
}

const LETTERHEAD = `
  <div class="letterhead">
    <div class="company">
      {% if company.logo_url != "" %}<img class="logo" src="{{ company.logo_url }}" alt="">{% endif %}
      <div class="name">{{ company.name }}</div>
      {% if company.address != "" %}<div class="meta">{{ company.address }}</div>{% endif %}
      {% if company.website != "" %}<div class="meta">{{ company.website }}</div>{% endif %}
      {% if company.gstin != "" %}<div class="meta">GSTIN: {{ company.gstin }}</div>{% endif %}
    </div>
    <div class="title">{{ document.title }}</div>
    <div class="ref">
      <span class="pill">#{{ document.number | default: "Draft" }}</span>
      <div class="dated">Dated {{ document.date | date_format }}</div>
    </div>
  </div>`;

const BILL_TO = `
    <div>
      <div class="label">Bill to</div>
      <div class="who">{{ client.name | default: "-" }}</div>
      {% if client.company_name != "" and client.company_name != client.name %}<div>{{ client.company_name }}</div>{% endif %}
      {% if client.email != "" %}<div>{{ client.email }}</div>{% endif %}
      {% if client.gstin != "" %}<div class="muted">GSTIN: {{ client.gstin }}</div>{% endif %}
    </div>`;

const ITEMS = `
  <table class="items">
    <thead>
      <tr>
        <th class="left">#</th>
        <th class="left">Description</th>
        {% if columns.quantity %}<th>Qty</th>{% endif %}
        {% if columns.unit %}<th class="left">Unit</th>{% endif %}
        <th>{% if columns.quantity %}Unit price{% else %}Price{% endif %}</th>
        {% if columns.discount %}<th>Disc</th>{% endif %}
        <th>Tax</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {% for line in lines %}
      <tr>
        <td class="left muted">{{ line.index }}</td>
        <td class="left desc">{{ line.description }}{% if line.notes != "" %}<div class="note">{{ line.notes | multiline }}</div>{% endif %}</td>
        {% if columns.quantity %}<td>{{ line.quantity }}</td>{% endif %}
        {% if columns.unit %}<td class="left">{{ line.unit }}</td>{% endif %}
        <td>{{ line.unit_price | money }}</td>
        {% if columns.discount %}<td>{{ line.discount_label }}</td>{% endif %}
        <td>{{ line.tax | money }}</td>
        <td class="ink"><strong>{{ line.amount | money }}</strong></td>
      </tr>
      {% else %}
      <tr><td colspan="8" class="left muted">No line items.</td></tr>
      {% endfor %}
    </tbody>
  </table>`;

const totalsBlock = (record: string, extra = '') => `
  <table class="totals">
    <tr><td>Subtotal</td><td>{{ ${record}.subtotal | money }}</td></tr>
    {% if ${record}.discount_total != 0 %}<tr><td>Discount</td><td>- {{ ${record}.discount_total | money }}</td></tr>{% endif %}
    {% for tax in taxes %}<tr><td>{{ tax.name }}{% if tax.rate != 0 %} ({{ tax.rate }}%){% endif %}</td><td>{{ tax.amount | money }}</td></tr>{% endfor %}
    {% if ${record}.round_off != 0 %}<tr><td>Round off</td><td>{{ ${record}.round_off | money }}</td></tr>{% endif %}
    <tr class="strong"><td>Grand total</td><td>{{ ${record}.grand_total | money }}</td></tr>${extra}
  </table>
  <div class="words">{{ ${record}.grand_total | amount_in_words }}</div>`;

const SECTIONS = `
  {% for section in sections %}
  <div class="section">
    <h3>{{ section.title }}</h3>
    <div class="body">{{ section.content | html }}</div>
  </div>
  {% endfor %}`;

const notesAndTerms = (record: string) => `
  {% if ${record}.notes != "" %}<div class="block"><div class="label">Notes</div><div class="text">{{ ${record}.notes | multiline }}</div></div>{% endif %}
  {% if ${record}.terms != "" %}<div class="block"><div class="label">Terms</div><div class="text">{{ ${record}.terms | multiline }}</div></div>{% endif %}`;

const PAYMENT_AND_SIGN = `
  <div class="columns">
    <div>
      {% if company.bank.account_number != "" %}
      <div class="label">Pay to</div>
      <div class="text">
        {{ company.bank.account_name | default: company.legal_name }}<br>
        {{ company.bank.name }} · A/c {{ company.bank.account_number }}<br>
        IFSC {{ company.bank.ifsc }}{% if company.bank.upi != "" %} · UPI {{ company.bank.upi }}{% endif %}
      </div>
      {% endif %}
    </div>
    <div class="sign">
      <div class="muted">For {{ company.legal_name | default: company.name }}</div>
      <div style="height: 40px"></div>
      {% if company.signatory.name != "" %}<div class="ink"><strong>{{ company.signatory.name }}</strong></div>{% endif %}
      <div class="muted">{{ company.signatory.designation | default: "Authorised signatory" }}</div>
    </div>
  </div>
  {% if company.footer_notes != "" %}<div class="footer">{{ company.footer_notes }}</div>{% endif %}`;

const INVOICE_HTML = `${head('{{ document.title }} {{ document.number }}')}
<body>${LETTERHEAD}
  <div class="party">${BILL_TO}
    <div style="text-align: right">
      {% if invoice.due_date %}<div class="label">Due date</div><div class="who">{{ invoice.due_date | date_format }}</div>{% endif %}
    </div>
  </div>
${ITEMS}
${totalsBlock(
  'invoice',
  `
    {% if invoice.amount_paid != 0 %}
    <tr><td>Amount paid</td><td>- {{ invoice.amount_paid | money }}</td></tr>
    <tr class="strong"><td>Balance due</td><td>{{ invoice.balance_due | money }}</td></tr>
    {% endif %}`,
)}
${SECTIONS}
${notesAndTerms('invoice')}
${PAYMENT_AND_SIGN}
</body>
</html>
`;

const QUOTATION_HTML = `${head('Quotation {{ document.number }}')}
<body>${LETTERHEAD}
  <div class="party">${BILL_TO.replace('Bill to', 'Prepared for')}
    <div style="text-align: right">
      {% if quotation.expiry_date %}<div class="label">Valid until</div><div class="who">{{ quotation.expiry_date | date_format }}</div>{% endif %}
    </div>
  </div>
${ITEMS}
${totalsBlock('quotation')}
${SECTIONS}
${notesAndTerms('quotation')}
  <div class="sign">
    <div class="muted">For {{ company.legal_name | default: company.name }}</div>
    <div style="height: 40px"></div>
    {% if company.signatory.name != "" %}<div class="ink"><strong>{{ company.signatory.name }}</strong></div>{% endif %}
    <div class="muted">{{ company.signatory.designation | default: "Authorised signatory" }}</div>
  </div>
</body>
</html>
`;

const PROPOSAL_HTML = `${head('Proposal - {{ proposal.title }}')}
<body>${LETTERHEAD}
  <div class="party">${BILL_TO.replace('Bill to', 'Prepared for')}
  </div>
  <div class="block">
    <div style="font-size: 18px; font-weight: 800; letter-spacing: -.02em" class="ink">{{ proposal.title }}</div>
    {% if proposal.reference != "" %}<div class="muted">Reference: {{ proposal.reference }}</div>{% endif %}
    {% if proposal.valid_until %}<div class="muted">Valid until {{ proposal.valid_until | date_format }}</div>{% endif %}
  </div>
  {% if proposal.summary != "" %}<div class="block">{{ proposal.summary | multiline }}</div>{% endif %}
${SECTIONS}
</body>
</html>
`;

const OFFER_LETTER_HTML = `${head('Offer Letter - {{ candidate.name }}')}
<body>${LETTERHEAD}
  <div class="block" style="margin-top: 24px">
    <div class="ink"><strong>To,</strong></div>
    <div class="ink"><strong>{{ candidate.name }}</strong></div>
    {% if candidate.address != "" %}<div>{{ candidate.address | multiline }}</div>{% endif %}
    <div class="ink" style="margin-top: 16px; font-size: 13px"><strong>Subject: Offer of {% if offer.is_internship %}Internship{% else %}Employment{% endif %} - {{ offer.position }} at {{ company.name }}</strong></div>
  </div>

  <div class="block" style="font-size: 12.5px; line-height: 1.6">{{ offer.body | html }}</div>

  <div style="margin-top: 30px">
    <div class="ink"><strong>Warm regards,</strong></div>
    {% if offer.signature_url != "" %}<img src="{{ offer.signature_url }}" alt="Signature" style="display: block; max-height: 56px; max-width: 220px; margin: 8px 0 2px">{% endif %}
    {% if offer.signatory_name != "" %}<div class="ink"><strong>{{ offer.signatory_name }}</strong></div>{% endif %}
    {% if offer.signatory_designation != "" %}<div class="muted">{{ offer.signatory_designation }}</div>{% endif %}
    <div>For {{ company.name }}</div>
  </div>

  <div class="columns" style="margin-top: 32px">
    <div>
      <div class="label" style="margin-bottom: 26px">Candidate signature</div>
      <div style="border-bottom: 1.5px solid #0f172a"></div>
      <div class="muted" style="margin-top: 6px">{{ candidate.name }}</div>
    </div>
    <div>
      <div class="label" style="margin-bottom: 26px">Date</div>
      <div style="border-bottom: 1.5px solid #0f172a"></div>
    </div>
  </div>
</body>
</html>
`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'invoice_classic',
    name: 'Classic invoice',
    description: 'Teal letterhead, itemised table with tax breakdown, amount in words, bank details and signatory.',
    documentType: 'INVOICE',
    html: INVOICE_HTML,
  },
  {
    key: 'quotation_classic',
    name: 'Classic quotation',
    description: 'Itemised quotation with validity date, totals and sections.',
    documentType: 'QUOTATION',
    html: QUOTATION_HTML,
  },
  {
    key: 'proposal_classic',
    name: 'Classic proposal',
    description: 'Title page details and rich-text sections.',
    documentType: 'PROPOSAL',
    html: PROPOSAL_HTML,
  },
  {
    key: 'offer_letter_classic',
    name: 'Classic offer letter',
    description: 'Letterhead, the offer body clauses, signatory and candidate acceptance block.',
    documentType: 'OFFER_LETTER',
    html: OFFER_LETTER_HTML,
  },
];

export const BLANK_TEMPLATE = (title: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="page-numbers" content="bottom-right">
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1f2937; }
  </style>
</head>
<body>
  <h1>{{ document.title }} {{ document.number }}</h1>
  <p>{{ company.name }}</p>
</body>
</html>
`;

export function builtInStarter(type: TemplatedType): StarterTemplate {
  return STARTER_TEMPLATES.find((s) => s.documentType === type)!;
}
