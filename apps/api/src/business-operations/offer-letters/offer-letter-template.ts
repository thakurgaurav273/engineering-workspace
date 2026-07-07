import { OfferLetter } from '@prisma/client';

/**
 * Renders an offer letter to a self-contained HTML document. This is the SINGLE source of the
 * document body: the same output is shown in the on-screen preview and used as the email body,
 * so "preview" is exactly what the candidate receives. Uses only inline styles for email-client
 * compatibility, and escapes every dynamic value.
 */

type CompanySnapshot = {
  legalName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
} | null;

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Preserve author line breaks from free-text fields (terms, benefits, notes). */
function multiline(v?: string | null): string {
  if (!v) return '';
  return esc(v).replace(/\r?\n/g, '<br/>');
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}

function humanize(v?: string | null): string {
  if (!v) return '';
  return esc(v.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
}

function companyName(snap: CompanySnapshot): string {
  return snap?.displayName || snap?.legalName || 'Our Company';
}

function companyAddress(snap: CompanySnapshot): string {
  const parts = [snap?.addressLine1, snap?.addressLine2, snap?.city, snap?.state, snap?.postalCode, snap?.country]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean);
  return esc(parts.join(', '));
}

export interface RenderedOfferLetter {
  subject: string;
  html: string;
}

export function renderOfferLetter(offer: OfferLetter): RenderedOfferLetter {
  const snap = (offer.companySnapshot ?? null) as CompanySnapshot;
  const company = companyName(snap);
  const number = offer.number || '(assigned when sent)';
  const salary = fmtMoney(offer.baseSalary ?? 0, offer.currency);

  const rows: [string, string][] = [
    ['Position', esc(offer.position)],
    ['Designation', esc(offer.designation)],
    ['Department', esc(offer.department)],
    ['Employment type', humanize(offer.employmentType)],
    ['Work location', esc(offer.workLocation)],
    ['Reporting manager', esc(offer.reportingManager)],
    ['Start date', esc(fmtDate(offer.startDate))],
    ['Annual base salary', salary],
    ['Variable pay', offer.variablePay ? fmtMoney(offer.variablePay, offer.currency) : ''],
    ['Notice period', esc(offer.noticePeriod)],
    ['Probation period', esc(offer.probationPeriod)],
    ['Offer valid until', esc(fmtDate(offer.validUntil))],
  ].filter(([, v]) => v !== '' && v !== undefined) as [string, string][];

  const detailRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">${v}</td></tr>`,
    )
    .join('');

  const section = (title: string, body: string) =>
    body
      ? `<div style="margin-top:22px;"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;font-weight:600;margin-bottom:6px;">${title}</div><div style="font-size:13px;line-height:1.6;color:#111827;">${body}</div></div>`
      : '';

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Offer Letter — ${esc(offer.candidateName)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-.01em;">${esc(company)}</div>
        ${companyAddress(snap) ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${companyAddress(snap)}</div>` : ''}
      </div>
      <div style="padding:32px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;">
          <span>Ref: ${esc(number)}</span><span>${esc(fmtDate(offer.offerDate) || fmtDate(new Date()))}</span>
        </div>
        <h1 style="font-size:20px;margin:18px 0 4px;letter-spacing:-.01em;">Letter of Offer</h1>
        <p style="font-size:13px;line-height:1.6;margin:14px 0 0;">Dear ${esc(offer.candidateName)},</p>
        <p style="font-size:13px;line-height:1.6;margin:10px 0 0;">
          We are pleased to offer you the position of <strong>${esc(offer.position)}</strong> at ${esc(company)}.
          The key terms of your offer are set out below.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-top:20px;">${detailRows}</table>

        ${section('Compensation & Benefits', multiline(offer.salaryBreakdown) + (offer.benefits ? (offer.salaryBreakdown ? '<br/><br/>' : '') + multiline(offer.benefits) : ''))}
        ${section('Terms & Conditions', multiline(offer.termsAndConditions))}
        ${section('Additional Notes', multiline(offer.additionalNotes))}

        <p style="font-size:13px;line-height:1.6;margin-top:24px;">
          We are excited about the possibility of you joining our team. Please confirm your acceptance
          ${offer.validUntil ? `by <strong>${esc(fmtDate(offer.validUntil))}</strong>` : 'at your earliest convenience'}.
        </p>
        <p style="font-size:13px;line-height:1.6;margin-top:20px;">Warm regards,<br/><strong>${esc(company)}</strong></p>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">
      This offer letter was sent to ${esc(offer.candidateEmail)} by ${esc(company)}.
    </div>
  </div>
</body>
</html>`;

  return { subject: `Offer Letter — ${offer.position} at ${company}`, html };
}
