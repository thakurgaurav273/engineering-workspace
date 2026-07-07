import { OfferLetter } from '@prisma/client';

/**
 * Renders an offer letter to a self-contained, print-ready HTML document. This is the SINGLE
 * source of the document: the same output is shown in the on-screen preview, used as the email
 * body, and rendered to the attached PDF — so preview == email == PDF. Uses only inline styles
 * (email-client safe) and escapes every dynamic value.
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

function firstName(full: string): string {
  return esc((full || '').trim().split(/\s+/)[0] || full);
}

export interface RenderedOfferLetter {
  subject: string;
  html: string;
  fileName: string;
}

const ACCENT = '#0f766e'; // teal-700
const INK = '#1f2937';
const MUTED = '#6b7280';

export function renderOfferLetter(offer: OfferLetter): RenderedOfferLetter {
  const snap = (offer.companySnapshot ?? null) as CompanySnapshot;
  const company = companyName(snap);
  const number = offer.number || '(assigned when sent)';
  const employment = humanize(offer.employmentType) || 'Employment';
  const isInternship = offer.employmentType === 'INTERNSHIP';
  const isContract = offer.employmentType === 'CONTRACT';
  const kind = isInternship ? 'Internship' : isContract ? 'Engagement' : 'Employment';

  const detail = (label: string, value: string) =>
    value
      ? `<tr>
           <td style="padding:7px 16px 7px 0;color:${MUTED};font-size:12.5px;vertical-align:top;white-space:nowrap;width:190px;">${label}</td>
           <td style="padding:7px 0;color:${INK};font-size:12.5px;font-weight:600;">${value}</td>
         </tr>`
      : '';

  const detailRows =
    detail('Position', esc(offer.position)) +
    detail('Designation', esc(offer.designation)) +
    detail('Department', esc(offer.department)) +
    detail('Employment type', employment) +
    detail('Work location', esc(offer.workLocation)) +
    detail('Reporting manager', esc(offer.reportingManager)) +
    detail('Start date', esc(fmtDate(offer.startDate))) +
    detail('Probation period', esc(offer.probationPeriod)) +
    detail('Notice period', esc(offer.noticePeriod));

  const compRows =
    detail('Annual base salary', offer.baseSalary ? fmtMoney(offer.baseSalary, offer.currency) : '') +
    detail('Variable / performance pay', offer.variablePay ? fmtMoney(offer.variablePay, offer.currency) : '');

  const section = (title: string, inner: string) =>
    inner
      ? `<div style="margin-top:26px;page-break-inside:avoid;">
           <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT};font-weight:700;margin-bottom:8px;">${title}</div>
           ${inner}
         </div>`
      : '';

  const table = (rows: string) =>
    rows ? `<table style="width:100%;border-collapse:collapse;">${rows}</table>` : '';

  const prose = (body: string) =>
    body ? `<div style="font-size:12.5px;line-height:1.65;color:${INK};">${body}</div>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Offer Letter — ${esc(offer.candidateName)}</title>
<style>@page { size: A4; margin: 18mm 16mm; }</style>
</head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <div style="max-width:760px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <!-- Letterhead -->
      <div style="border-top:5px solid ${ACCENT};padding:26px 40px 20px;border-bottom:1px solid #eef0f2;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:#0f172a;">${esc(company)}</div>
              ${companyAddress(snap) ? `<div style="font-size:11.5px;color:${MUTED};margin-top:4px;max-width:360px;">${companyAddress(snap)}</div>` : ''}
              ${snap?.email || snap?.website ? `<div style="font-size:11.5px;color:${MUTED};margin-top:2px;">${[esc(snap?.email), esc(snap?.website)].filter(Boolean).join(' · ')}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:11px;color:${MUTED};">Ref</div>
              <div style="font-size:13px;font-weight:700;color:#0f172a;">${esc(number)}</div>
              <div style="font-size:11px;color:${MUTED};margin-top:6px;">Date</div>
              <div style="font-size:12.5px;font-weight:600;">${esc(fmtDate(offer.offerDate) || fmtDate(new Date()))}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding:30px 40px 36px;">
        <!-- To block -->
        <div style="page-break-inside:avoid;">
          <div style="font-size:12.5px;font-weight:700;color:#0f172a;">To,</div>
          <div style="font-size:12.5px;font-weight:700;margin-top:4px;">${esc(offer.candidateName)}</div>
          ${offer.candidateAddress ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;white-space:pre-line;">${multiline(offer.candidateAddress)}</div>` : ''}
          ${offer.candidateEmail ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(offer.candidateEmail)}</div>` : ''}
        </div>

        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-top:20px;">
          Subject: Offer of ${esc(kind)} — ${esc(offer.position)}
        </div>

        <div style="font-size:12.5px;line-height:1.65;margin-top:18px;">Dear ${firstName(offer.candidateName)},</div>
        <div style="font-size:12.5px;line-height:1.65;margin-top:10px;">
          We are pleased to offer you the position of <strong>${esc(offer.position)}</strong> at ${esc(company)}.
          After careful consideration of your qualifications and experience, we believe you will be a valuable
          addition to our team. The principal terms of this offer are set out below.
        </div>

        ${section('Position Details', table(detailRows))}
        ${section('Compensation', table(compRows) + (offer.salaryBreakdown ? `<div style="margin-top:10px;">${prose(multiline(offer.salaryBreakdown))}</div>` : ''))}
        ${section('Benefits', prose(multiline(offer.benefits)))}
        ${section('Terms & Conditions', prose(multiline(offer.termsAndConditions)))}
        ${section('Additional Notes', prose(multiline(offer.additionalNotes)))}

        <div style="font-size:12.5px;line-height:1.65;margin-top:26px;page-break-inside:avoid;">
          We are excited about the prospect of you joining ${esc(company)}. Kindly confirm your acceptance
          ${offer.validUntil ? `by <strong>${esc(fmtDate(offer.validUntil))}</strong>` : 'at your earliest convenience'}
          by replying to this letter.
        </div>

        <div style="margin-top:34px;page-break-inside:avoid;">
          <div style="font-size:12.5px;">Warm regards,</div>
          <div style="font-size:12.5px;font-weight:700;margin-top:22px;">For ${esc(company)}</div>
          <div style="width:200px;border-top:1px solid #cbd5e1;margin-top:26px;padding-top:6px;font-size:11px;color:${MUTED};">
            Authorised Signatory
          </div>
        </div>

        <div style="margin-top:30px;padding-top:14px;border-top:1px solid #eef0f2;font-size:9.5px;color:#9ca3af;line-height:1.6;page-break-inside:avoid;">
          <strong>Disclaimer:</strong> This letter constitutes an offer only and does not create an employment
          contract until accepted in writing. All terms are subject to the company's policies and applicable law.
          This document was generated by ${esc(company)} and sent to ${esc(offer.candidateEmail)}.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const safeNumber = (offer.number || 'draft').replace(/[^A-Za-z0-9._-]+/g, '-');
  return {
    subject: `Offer Letter — ${offer.position} at ${company}`,
    html,
    fileName: `Offer-Letter-${safeNumber}.pdf`,
  };
}
