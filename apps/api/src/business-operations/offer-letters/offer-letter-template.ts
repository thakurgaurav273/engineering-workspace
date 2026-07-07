import { OfferLetter } from '@prisma/client';
import { prefillBody } from './offer-letter-clauses';

/**
 * Wraps the offer letter's editable body (`bodyContent` — the role-based clauses, edited in
 * TipTap on the frontend) in fixed chrome: a teal letterhead (company / number / date), the
 * To + Subject block, and a candidate signature block. The SAME output powers the preview, the
 * email body, and the attached PDF. Inline styles only (email-safe); chrome values are escaped.
 * If an offer has no bodyContent (older records), the default clause set is rendered instead.
 */

type CompanySnapshot = {
  legalName?: string | null;
  displayName?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  gstin?: string | null;
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
  return v ? esc(v).replace(/\r?\n/g, '<br/>') : '';
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function companyName(snap: CompanySnapshot): string {
  return snap?.displayName || snap?.legalName || 'Our Company';
}

function companyAddress(snap: CompanySnapshot): string {
  const parts = [snap?.addressLine1, snap?.addressLine2, snap?.city, snap?.state, snap?.postalCode, snap?.country]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean);
  return esc(parts.join(', '));
}

export interface RenderedOfferLetter {
  subject: string;
  html: string;
  fileName: string;
}

const ACCENT = '#0f766e';
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

export function renderOfferLetter(offer: OfferLetter): RenderedOfferLetter {
  const snap = (offer.companySnapshot ?? null) as CompanySnapshot;
  const company = companyName(snap);
  const number = offer.number || '(assigned when sent)';
  const isInternship = offer.employmentType === 'INTERNSHIP';
  // Body: the edited/pre-filled clauses. Fall back to a fresh default for legacy offers.
  const body = offer.bodyContent && offer.bodyContent.trim() ? offer.bodyContent : prefillBody(offer);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Offer Letter — ${esc(offer.candidateName)}</title>
<style>@page { size: A4; margin: 11mm 12mm; } h1,h2,h3,p,ul,table { page-break-inside: avoid; }</style>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};">
  <div style="max-width:780px;margin:0;">
    <div style="background:#ffffff;padding:6px">

      <div style="border-bottom:4px solid ${ACCENT};padding-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:42%;">
              <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:${INK};">${esc(company)}</div>
              ${companyAddress(snap) ? `<div style="font-size:11px;color:${MUTED};margin-top:4px;max-width:280px;">${companyAddress(snap)}</div>` : ''}
              ${snap?.website ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${esc(snap?.website)}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:center;width:24%;">
              <div style="font-size:16px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;line-height:1.2;">${isInternship ? 'Internship<br/>' : ''}Offer Letter</div>
            </td>
            <td style="vertical-align:top;text-align:right;width:34%;white-space:nowrap;">
              <span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;color:${INK};">#${esc(number)}</span>
              <div style="font-size:9.5px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.14em;margin-top:8px;">Dated ${esc(fmtDate(offer.offerDate) || fmtDate(new Date()))}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top:24px;">
        <div style="font-size:12.5px;font-weight:700;color:${INK};">To,</div>
        <div style="font-size:12.5px;font-weight:700;color:${INK};margin-top:3px;">${esc(offer.candidateName)}</div>
        ${offer.candidateAddress ? `<div style="font-size:12px;color:${BODY};margin-top:2px;white-space:pre-line;">${multiline(offer.candidateAddress)}</div>` : ''}
        <div style="font-size:13px;font-weight:700;color:${INK};margin-top:16px;">Subject: Offer of ${isInternship ? 'Internship' : 'Employment'} — ${esc(offer.position)} at ${esc(company)}</div>
      </div>

      <div style="margin-top:18px;">${body}</div>

      <div style="margin-top:30px;">
        <div style="font-size:12.5px;font-weight:700;color:${INK};">Warm regards,</div>
        ${offer.signatureUrl ? `<img src="${esc(offer.signatureUrl)}" alt="Signature" style="display:block;max-height:56px;max-width:220px;margin:8px 0 2px;"/>` : ''}
        ${offer.signatoryName ? `<div style="font-size:12.5px;font-weight:700;color:${INK};margin-top:${offer.signatureUrl ? '0' : '10px'};">${esc(offer.signatoryName)}</div>` : ''}
        ${offer.signatoryDesignation ? `<div style="font-size:11.5px;color:${MUTED};margin-top:1px;">${esc(offer.signatoryDesignation)}</div>` : ''}
        <div style="font-size:12.5px;color:${BODY};margin-top:2px;">For ${esc(company)}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:26px;">
        <tr>
          <td style="width:50%;padding-right:16px;vertical-align:top;">
            <div style="font-size:11px;font-weight:700;color:${MUTED};margin-bottom:26px;text-transform:uppercase;letter-spacing:.06em;">Candidate Signature</div>
            <div style="border-bottom:1.5px solid ${INK};"></div>
            <div style="font-size:11px;color:${MUTED};margin-top:6px;">${esc(offer.candidateName)}</div>
          </td>
          <td style="width:50%;vertical-align:top;">
            <div style="font-size:11px;font-weight:700;color:${MUTED};margin-bottom:26px;text-transform:uppercase;letter-spacing:.06em;">Date</div>
            <div style="border-bottom:1.5px solid ${INK};"></div>
          </td>
        </tr>
      </table>
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
