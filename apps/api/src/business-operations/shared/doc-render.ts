/**
 * Shared chrome for the business-document renderers (invoice / quotation / proposal). Mirrors
 * the offer-letter template exactly: A4 @page margins, a white 6px-padded wrapper, and a teal
 * accent letterhead (company left / document type center / number+date right). Inline styles
 * only (email-safe); all snapshot/user text is escaped via esc()/multiline().
 */

export type CompanySnapshot = {
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

export type ClientSnapshot = {
  id?: string | null;
  name?: string | null;
  companyName?: string | null;
  email?: string | null;
  gstin?: string | null;
  billingState?: string | null;
  billingCountry?: string | null;
} | null;

export const ACCENT = '#0f766e';
export const INK = '#0f172a';
export const BODY = '#334155';
export const MUTED = '#64748b';

export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function multiline(v?: string | null): string {
  return v ? esc(v).replace(/\r?\n/g, '<br/>') : '';
}

export function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function companyName(snap: CompanySnapshot): string {
  return snap?.displayName || snap?.legalName || 'Our Company';
}

export function companyAddress(snap: CompanySnapshot): string {
  const parts = [snap?.addressLine1, snap?.addressLine2, snap?.city, snap?.state, snap?.postalCode, snap?.country]
    .map((x) => (x ? String(x).trim() : ''))
    .filter(Boolean);
  return esc(parts.join(', '));
}

/** The teal letterhead: company (left) · document type (center) · number + date (right). */
export function header(snap: CompanySnapshot, docTitle: string, number: string, date?: Date | string | null): string {
  const company = companyName(snap);
  return `
      <div style="border-bottom:4px solid ${ACCENT};padding-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:42%;">
              <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:${INK};">${esc(company)}</div>
              ${companyAddress(snap) ? `<div style="font-size:11px;color:${MUTED};margin-top:4px;max-width:280px;">${companyAddress(snap)}</div>` : ''}
              ${snap?.website ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${esc(snap?.website)}</div>` : ''}
              ${snap?.gstin ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">GSTIN: ${esc(snap?.gstin)}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:center;width:24%;">
              <div style="font-size:16px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;line-height:1.2;">${esc(docTitle)}</div>
            </td>
            <td style="vertical-align:top;text-align:right;width:34%;white-space:nowrap;">
              <span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;color:${INK};">#${esc(number)}</span>
              <div style="font-size:9.5px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.14em;margin-top:8px;">Dated ${esc(fmtDate(date) || fmtDate(new Date()))}</div>
            </td>
          </tr>
        </table>
      </div>`;
}

/** Wrap header + content in the full A4 page with the shared chrome. */
export function shell(titleText: string, contentHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(titleText)}</title>
<style>@page { size: A4; margin: 11mm 12mm; } h1,h2,h3,p,ul,table { page-break-inside: avoid; }</style>
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};">
  <div style="max-width:780px;margin:0;">
    <div style="background:#ffffff;padding:6px">
${contentHtml}
    </div>
  </div>
</body>
</html>`;
}

/** "Bill To" block from the client snapshot, with a free-text fallback name. */
export function billTo(client: ClientSnapshot, fallbackName?: string | null): string {
  const name = client?.name || client?.companyName || fallbackName || '';
  const lines: string[] = [];
  if (name) lines.push(`<div style="font-size:12.5px;font-weight:700;color:${INK};margin-top:3px;">${esc(name)}</div>`);
  if (client?.companyName && client?.name && client.companyName !== client.name) {
    lines.push(`<div style="font-size:12px;color:${BODY};margin-top:1px;">${esc(client.companyName)}</div>`);
  }
  if (client?.email) lines.push(`<div style="font-size:12px;color:${BODY};margin-top:1px;">${esc(client.email)}</div>`);
  if (client?.gstin) lines.push(`<div style="font-size:11px;color:${MUTED};margin-top:1px;">GSTIN: ${esc(client.gstin)}</div>`);
  return `
      <div style="margin-top:24px;">
        <div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">Bill To</div>
        ${lines.join('\n        ') || `<div style="font-size:12.5px;color:${MUTED};margin-top:3px;">-</div>`}
      </div>`;
}

export function safeFilePart(v?: string | null): string {
  return (v || 'draft').replace(/[^A-Za-z0-9._-]+/g, '-');
}
