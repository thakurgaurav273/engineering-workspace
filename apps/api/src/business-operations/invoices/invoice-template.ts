import { Invoice, InvoiceLine } from '@prisma/client';
import {
  INK, BODY, MUTED, esc, multiline, fmtDate, companyName, header, shell, billTo, safeFilePart,
  CompanySnapshot, ClientSnapshot,
} from '../shared/doc-render';
import { formatMoney } from '../shared/money';

/**
 * Renders an Invoice (with its line items) into the shared teal document chrome. The SAME
 * output powers the preview, the email body, and the attached PDF. Money is locale-formatted
 * per the invoice currency; all snapshot/user text is escaped.
 */

export type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };
type TaxEntry = { name?: string; rate?: number; amount?: number };

export interface RenderedInvoice {
  subject: string;
  html: string;
  fileName: string;
}

export function renderInvoice(invoice: InvoiceWithLines): RenderedInvoice {
  const snap = (invoice.companySnapshot ?? null) as CompanySnapshot;
  const client = (invoice.clientSnapshot ?? null) as ClientSnapshot;
  const company = companyName(snap);
  const number = invoice.number || '(assigned when issued)';
  const currency = invoice.currency || 'INR';
  const money = (n: number) => formatMoney(n, currency);
  const lines = invoice.lines ?? [];
  const breakdown = (invoice.taxBreakdown ?? []) as TaxEntry[];

  const rows = lines
    .map((l) => {
      const qty = l.quantity ?? 1;
      const disc = l.discount ? `${l.discount}${l.discountType === 'FIXED' ? '' : '%'}` : '-';
      return `
          <tr>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${INK};">${esc(l.description)}${l.notes ? `<div style="font-size:10.5px;color:${MUTED};margin-top:2px;">${multiline(l.notes)}</div>` : ''}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${BODY};text-align:right;">${esc(qty)}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${BODY};text-align:left;">${esc(l.unit ?? '')}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${BODY};text-align:right;">${money(l.unitPrice ?? 0)}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${BODY};text-align:right;">${esc(disc)}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${BODY};text-align:right;">${money(l.lineTax ?? 0)}</td>
            <td style="padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:11.5px;color:${INK};text-align:right;font-weight:600;">${money(l.lineTotal ?? 0)}</td>
          </tr>`;
    })
    .join('');

  const amountPaid = invoice.amountPaid ?? 0;
  const balanceDue = (invoice.grandTotal ?? 0) - amountPaid;
  const totalRow = (label: string, value: string, bold = false) => `
          <tr>
            <td style="padding:4px 0;font-size:12px;color:${bold ? INK : BODY};${bold ? 'font-weight:700;' : ''}text-align:right;">${esc(label)}</td>
            <td style="padding:4px 0 4px 24px;font-size:12px;color:${bold ? INK : BODY};${bold ? 'font-weight:700;' : ''}text-align:right;white-space:nowrap;">${value}</td>
          </tr>`;

  const totals = `
      <table style="width:auto;margin-left:auto;margin-top:16px;border-collapse:collapse;">
        ${totalRow('Subtotal', money(invoice.subtotal ?? 0))}
        ${invoice.discountTotal ? totalRow('Discount', `- ${money(invoice.discountTotal)}`) : ''}
        ${breakdown.map((t) => totalRow(`${t.name ?? 'Tax'}${t.rate ? ` (${t.rate}%)` : ''}`, money(t.amount ?? 0))).join('')}
        ${!breakdown.length && invoice.taxTotal ? totalRow('Tax', money(invoice.taxTotal)) : ''}
        ${invoice.roundOff ? totalRow('Round off', money(invoice.roundOff)) : ''}
        ${totalRow('Grand total', money(invoice.grandTotal ?? 0), true)}
        ${amountPaid ? totalRow('Amount paid', `- ${money(amountPaid)}`) : ''}
        ${amountPaid ? totalRow('Balance due', money(balanceDue), true) : ''}
      </table>`;

  const content = `
${header(snap, 'Invoice', number, invoice.issueDate)}
${billTo(client, invoice.clientName)}

      <table style="width:100%;border-collapse:collapse;margin-top:14px;">
        <tr>
          ${invoice.dueDate ? `<td style="font-size:11px;color:${MUTED};"><span style="font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Due</span> ${esc(fmtDate(invoice.dueDate))}</td>` : ''}
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Description</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Qty</th>
            <th style="padding:8px 6px;text-align:left;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Unit</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Unit price</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Disc</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Tax</th>
            <th style="padding:8px 6px;text-align:right;font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="7" style="padding:12px 6px;font-size:11.5px;color:${MUTED};">No line items.</td></tr>`}</tbody>
      </table>

      ${totals}

      ${invoice.notes ? `<div style="margin-top:24px;"><div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Notes</div><div style="font-size:12px;color:${BODY};margin-top:4px;">${multiline(invoice.notes)}</div></div>` : ''}
      ${invoice.terms ? `<div style="margin-top:16px;"><div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Terms</div><div style="font-size:12px;color:${BODY};margin-top:4px;">${multiline(invoice.terms)}</div></div>` : ''}`;

  return {
    subject: `Invoice ${invoice.number || ''} from ${company}`.trim(),
    html: shell(`Invoice - ${number}`, content),
    fileName: `Invoice-${safeFilePart(invoice.number)}.pdf`,
  };
}
