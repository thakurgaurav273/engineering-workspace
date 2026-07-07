import { EmploymentType, OfferLetter } from '@prisma/client';

/**
 * Default, role-aware legal clause sets for offer letters, and the placeholder interpolation
 * used to pre-fill them from an offer's structured fields. The clauses are the EDITABLE body of
 * the letter (TipTap on the frontend): they pre-fill from the org's OfferLetterTemplate (or these
 * built-in defaults) at create time, then travel with the offer as `bodyContent`.
 *
 * Templates may contain {{placeholders}} — resolved against the offer + company snapshot at
 * create time so the editor shows real values, not tokens.
 */

const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`;
  }
}

type Snap = { legalName?: string | null; displayName?: string | null; state?: string | null } | null;

function companyName(snap: Snap): string {
  return snap?.displayName || snap?.legalName || 'Our Company';
}

/** Placeholder values derived from the offer + its company snapshot. */
export function offerVars(offer: OfferLetter): Record<string, string> {
  const snap = (offer.companySnapshot ?? null) as Snap;
  const company = companyName(snap);
  const base = offer.baseSalary ?? 0;
  const variable = offer.variablePay ?? 0;
  const start = offer.startDate ? new Date(offer.startDate) : null;
  const end = start ? new Date(start) : null;
  if (end) end.setMonth(end.getMonth() + 3);
  return {
    company: esc(company),
    candidateName: esc(offer.candidateName),
    position: esc(offer.position),
    designation: esc(offer.designation || offer.position),
    department: esc(offer.department || ''),
    reportingManager: esc(offer.reportingManager || 'your reporting manager'),
    workLocation: esc(offer.workLocation || 'as designated by the company'),
    startDate: esc(fmtDate(start) || 'the agreed start date'),
    endDate: esc(fmtDate(end)),
    noticePeriod: esc(offer.noticePeriod || 'the notice period as per company policy'),
    probationPeriod: esc(offer.probationPeriod || ''),
    validUntil: esc(fmtDate(offer.validUntil)),
    jurisdiction: snap?.state ? `${esc(snap.state)}, India` : 'India',
    baseSalary: base ? fmtMoney(base, offer.currency) : '',
    variablePay: variable ? fmtMoney(variable, offer.currency) : '',
    ctc: base ? fmtMoney(base + variable, offer.currency) : '',
  };
}

/** Replace {{token}} occurrences; unknown tokens collapse to empty so nothing leaks. */
export function interpolate(html: string, vars: Record<string, string>): string {
  return html.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key: string) => vars[key] ?? '');
}

// --- default clause sets ------------------------------------------------------------------

const h = (t: string) =>
  `<h2 style="font-size:13px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;margin:22px 0 10px;">${t}</h2>`;
const p = (t: string) => `<p style="font-size:12.5px;line-height:1.7;color:${BODY};margin:8px 0 0;">${t}</p>`;

/**
 * A concise, single-A4-page editable body: a short intro, a compact offer summary, a handful of
 * essential short clauses, and an acceptance line. Deliberately NOT the multi-page legal tome —
 * teams that want more (extended clauses, an NDA annexure) can add it in the editor/Settings.
 */
export function defaultOfferLetterBody(type: EmploymentType): string {
  const internship = type === 'INTERNSHIP';
  const engagement = internship ? 'internship' : 'employment';
  let n = 0;
  const s = (title: string, body: string) => `${h(`${++n}. ${title}`)}${body}`;

  const intro =
    p('Dear {{candidateName}},') +
    p(
      internship
        ? 'We are pleased to offer you an <strong>internship</strong> with <strong>{{company}}</strong> for the role of <strong>{{position}}</strong>. The key terms are set out below.'
        : 'We are pleased to offer you the position of <strong>{{position}}</strong> at <strong>{{company}}</strong>. We believe you will be a valuable addition to our team. The key terms of your offer are set out below.',
    );

  // Compact "offer at a glance" summary — the dynamic fields, not prose.
  const summary =
    `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-top:14px;">
       <table style="width:100%;border-collapse:collapse;">
         <tr><td style="padding:5px 12px 5px 0;font-size:12.5px;color:${MUTED};width:180px;">Designation</td><td style="padding:5px 0;font-size:12.5px;font-weight:600;color:${INK};">{{designation}}</td></tr>
         <tr><td style="padding:5px 12px 5px 0;font-size:12.5px;color:${MUTED};">Start date</td><td style="padding:5px 0;font-size:12.5px;font-weight:600;color:${INK};">{{startDate}}</td></tr>
         <tr><td style="padding:5px 12px 5px 0;font-size:12.5px;color:${MUTED};">Work location</td><td style="padding:5px 0;font-size:12.5px;font-weight:600;color:${INK};">{{workLocation}}</td></tr>
         <tr><td style="padding:5px 12px 5px 0;font-size:12.5px;color:${MUTED};">Annual compensation</td><td style="padding:5px 0;font-size:12.5px;font-weight:700;color:${INK};">{{ctc}}</td></tr>
         <tr><td style="padding:5px 12px 5px 0;font-size:12.5px;color:${MUTED};">Notice period</td><td style="padding:5px 0;font-size:12.5px;font-weight:600;color:${INK};">{{noticePeriod}}</td></tr>
       </table>
     </div>`;

  const clauses =
    s('Confidentiality', p('During and after the ' + engagement + ', you shall keep all non-public information relating to {{company}} strictly confidential. This obligation survives the ' + engagement + '.')) +
    s('Intellectual Property', p('All work created by you during this ' + engagement + ' shall be the exclusive property of {{company}}.')) +
    s('Termination', p('Either party may terminate this ' + engagement + ' by providing <strong>{{noticePeriod}}</strong>. {{company}} may terminate without notice for serious misconduct or breach.')) +
    s('Governing Law', p('This letter is governed by the laws of India, with courts in {{jurisdiction}} having exclusive jurisdiction. Your ' + engagement + ' is subject to {{company}}&#39;s policies as amended from time to time.'));

  const closing =
    p('Please confirm your acceptance by signing below. We look forward to welcoming you to {{company}}.');

  return intro + summary + clauses + closing;
}

/** Resolve the editable body for a fresh offer: given template (or built-in default) + values. */
export function prefillBody(offer: OfferLetter, template?: string | null): string {
  const src = template && template.trim() ? template : defaultOfferLetterBody(offer.employmentType);
  return interpolate(src, offerVars(offer));
}

export const EMPLOYMENT_TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];
