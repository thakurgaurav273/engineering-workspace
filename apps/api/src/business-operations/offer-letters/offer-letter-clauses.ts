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
const ul = (items: string[]) =>
  `<ul style="margin:8px 0 0;padding-left:20px;color:${BODY};font-size:12.5px;line-height:1.7;">${items
    .map((i) => `<li style="margin:2px 0;">${i}</li>`)
    .join('')}</ul>`;

function compensationBlock(): string {
  return `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-top:8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:5px 0;font-size:12.5px;font-weight:700;color:${INK};">Annual CTC</td><td style="padding:5px 0;font-size:12.5px;text-align:right;font-weight:700;color:${INK};">{{ctc}}</td></tr>
      <tr><td style="padding:5px 0;font-size:12.5px;color:${BODY};">Base Salary</td><td style="padding:5px 0;font-size:12.5px;text-align:right;font-weight:700;color:${INK};">{{baseSalary}}</td></tr>
      <tr><td style="padding:5px 0;font-size:12.5px;color:${BODY};">Variable / Performance Pay</td><td style="padding:5px 0;font-size:12.5px;text-align:right;font-weight:700;color:${INK};">{{variablePay}}</td></tr>
    </table>
  </div>`;
}

/** The full editable body (intro + numbered clauses + NDA annexure), with placeholders. */
export function defaultOfferLetterBody(type: EmploymentType): string {
  const internship = type === 'INTERNSHIP';
  const engagement = internship ? 'internship' : 'employment';
  const party = internship ? 'Intern' : 'Employee';
  let n = 0;
  const s = (title: string, body: string) => `${h(`${++n}. ${title}`)}${body}`;

  const intro =
    p('Dear {{candidateName}},') +
    p(
      internship
        ? 'We are pleased to offer you an <strong>internship</strong> with <strong>{{company}}</strong> for the role of <strong>{{position}}</strong>, subject to the terms and conditions outlined in this letter.'
        : 'We are pleased to extend this offer of employment to you for the position of <strong>{{position}}</strong> at {{company}}. After careful consideration of your qualifications and experience, we believe you will be a valuable addition to our team.',
    ) +
    p('Please read this letter carefully, as it defines the complete understanding between you and {{company}}.');

  const clauses =
    s(
      'Nature of Engagement',
      internship
        ? p('This engagement is strictly an <strong>internship</strong> and <strong>does not constitute employment</strong> under any labour, employment, or industrial law in India.')
        : p('This is a position with {{company}}. Your employment will be governed by the company&#39;s policies and procedures as amended from time to time.'),
    ) +
    s(
      'Role and Responsibilities',
      p('You are being onboarded as <strong>{{designation}}</strong>. Your responsibilities will be communicated by {{reportingManager}} and may evolve based on business requirements.'),
    ) +
    s(
      internship ? 'Internship Duration' : 'Employment Duration',
      internship
        ? p('The internship shall be for a <strong>fixed period of three months</strong>, commencing from <strong>{{startDate}}</strong> and ending on <strong>{{endDate}}</strong>, unless terminated earlier in accordance with this letter.')
        : p('Your employment will commence on <strong>{{startDate}}</strong>. You will be on probation for {{probationPeriod}} where applicable.'),
    ) +
    s('Place of Work', p('Your primary place of work shall be <strong>{{workLocation}}</strong>. You may be required to work from other locations or remotely as per business needs.')) +
    s('Working Commitment', p('You are expected to devote sincere effort, professional conduct, and reasonable working hours toward assigned tasks. This engagement may involve variable hours based on project needs.')) +
    s('Compensation', p('Your compensation is set out below and is subject to statutory deductions and company policy.') + compensationBlock()) +
    s('Performance and Conduct', p('Your continuation is subject to satisfactory performance, professional behaviour, and adherence to company values.') + p('Any form of negligence, misrepresentation, misconduct, or non-cooperation may result in immediate termination.')) +
    s('Confidentiality and Non-Disclosure', p('During and after the ' + engagement + ', you shall maintain strict confidentiality regarding all non-public information related to {{company}}. This obligation shall survive the completion or termination of this engagement.')) +
    s('Intellectual Property Rights', p('All work, content, ideas, documents, strategies, and materials created or contributed by you during this ' + engagement + ' shall be the exclusive intellectual property of {{company}}.')) +
    s('Conflict of Interest', p('You shall not engage in any activity or business that conflicts with {{company}}&#39;s interests during this ' + engagement + ' period without prior written consent.')) +
    s('Termination and Notice Period', p('Either party may terminate this ' + engagement + ' by providing <strong>{{noticePeriod}}</strong>. {{company}} reserves the right to terminate without notice in cases of serious misconduct or breach.')) +
    s('Company Policies and Rights', p('You agree to comply with all current and future policies issued by {{company}}. {{company}} reserves the right to modify any terms at any time, subject to applicable law.')) +
    s('Governing Law and Jurisdiction', p('This letter shall be governed by the laws of India. Courts located in {{jurisdiction}} shall have exclusive jurisdiction.')) +
    s('Acceptance', p('By signing below, you confirm that you have read, understood, and agreed to all the terms and conditions stated in this letter.') + p('We look forward to your contribution and wish you a successful journey with {{company}}.'));

  const annexure =
    `<div style="margin-top:34px;padding-top:20px;border-top:3px solid ${INK};">` +
    `<h1 style="font-size:18px;font-weight:800;color:${INK};text-transform:uppercase;margin:0 0 6px;">Annexure A</h1>` +
    `<h2 style="font-size:14px;font-weight:800;color:${INK};text-transform:uppercase;margin:0 0 12px;">Non-Disclosure and Confidentiality Agreement</h2>` +
    p('This Non-Disclosure Agreement is entered into between <strong>{{company}}</strong> (the &quot;Company&quot;) and <strong>{{candidateName}}</strong> (the &quot;' + party + '&quot;).') +
    h('1. Purpose') + p('The ' + party + ' agrees to receive confidential information solely for performing duties related to the ' + engagement + ' with {{company}}.') +
    h('2. Confidential Information') + p('Includes business plans, client and partner information, pricing, financial data, source code, internal communications, and any information marked or understood to be confidential.') +
    h('3. Obligations') + ul(['Keep all Confidential Information strictly confidential', 'Not disclose such information to any third party', 'Not use it for personal or external benefit', 'Take reasonable measures to protect such information']) +
    h('4. Intellectual Property') + p('All work, data, and outputs created during this ' + engagement + ' remain the exclusive property of {{company}}.') +
    h('5. Term and Survival') + p('This Agreement shall remain effective during the ' + engagement + ' and indefinitely thereafter, regardless of the manner of termination.') +
    h('6. Governing Law') + p('Governed by the laws of India; courts located in {{jurisdiction}} shall have exclusive jurisdiction.') +
    `<table style="width:100%;border-collapse:collapse;margin-top:24px;">
       <tr>
         <td style="width:50%;vertical-align:bottom;padding-right:16px;">
           <div style="font-size:12px;font-weight:700;color:${INK};margin-bottom:26px;">For {{company}}</div>
           <div style="width:180px;border-bottom:1.5px solid ${INK};"></div>
           <div style="font-size:11px;color:${MUTED};margin-top:6px;">Authorised Signatory</div>
         </td>
         <td style="width:50%;vertical-align:bottom;">
           <div style="font-size:12px;font-weight:700;color:${INK};margin-bottom:26px;">${party}</div>
           <div style="width:180px;border-bottom:1.5px solid ${INK};"></div>
           <div style="font-size:11px;color:${MUTED};margin-top:6px;">{{candidateName}}</div>
         </td>
       </tr>
     </table>` +
    `</div>`;

  return intro + clauses + annexure;
}

/** Resolve the editable body for a fresh offer: given template (or built-in default) + values. */
export function prefillBody(offer: OfferLetter, template?: string | null): string {
  const src = template && template.trim() ? template : defaultOfferLetterBody(offer.employmentType);
  return interpolate(src, offerVars(offer));
}

export const EMPLOYMENT_TYPES: EmploymentType[] = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];
