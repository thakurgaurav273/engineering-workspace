import { OfferLetter } from '@prisma/client';

/**
 * Renders an offer letter to a self-contained, print-ready HTML document modelled on the
 * GrovynDashboard offer letter: teal letterhead, numbered legal clauses (nature of engagement,
 * responsibilities, duration, compensation, confidentiality, IP, termination, governing law,
 * …), candidate acceptance, and an NDA Annexure. This is the SINGLE source of the document —
 * the same output powers the preview, the email body, and the attached PDF. Inline styles only
 * (email-safe); every dynamic value is HTML-escaped.
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
  if (!v) return '';
  return esc(v).replace(/\r?\n/g, '<br/>');
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addMonths(d: Date | null, months: number): Date | null {
  if (!d) return null;
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
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
const INK = '#0f172a';
const BODY = '#334155';
const MUTED = '#64748b';

export function renderOfferLetter(offer: OfferLetter): RenderedOfferLetter {
  const snap = (offer.companySnapshot ?? null) as CompanySnapshot;
  const company = companyName(snap);
  const number = offer.number || '(assigned when sent)';
  const isInternship = offer.employmentType === 'INTERNSHIP';
  const engagement = isInternship ? 'internship' : 'employment';
  const roleWord = isInternship ? 'internship' : 'position';
  const empLabel = humanize(offer.employmentType) || 'Employment';
  const base = offer.baseSalary ?? 0;
  const variable = offer.variablePay ?? 0;
  const isUnpaid = isInternship && base === 0;
  const showCompensation = base > 0 || isUnpaid;
  const jurisdiction = snap?.state ? `${esc(snap.state)}, India` : 'India';
  const startDate = offer.startDate ? new Date(offer.startDate) : null;
  const internEnd = fmtDate(addMonths(startDate, 3));

  // --- section building blocks --------------------------------------------------------------
  let n = 0;
  const heading = (title: string) =>
    `<h2 style="font-size:13px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;margin:0 0 10px;">${title}</h2>`;
  const sec = (title: string, body: string) =>
    `<div style="margin-top:22px;page-break-inside:avoid;">${heading(`${++n}. ${title}`)}${body}</div>`;
  const p = (text: string, mt = 0) =>
    `<p style="font-size:12.5px;line-height:1.7;color:${BODY};margin:${mt}px 0 0;">${text}</p>`;
  const ul = (items: string[]) =>
    `<ul style="margin:8px 0 0;padding-left:20px;color:${BODY};font-size:12.5px;line-height:1.7;">${items
      .map((i) => `<li style="margin:2px 0;">${i}</li>`)
      .join('')}</ul>`;

  // --- compensation ------------------------------------------------------------------------
  let compensation = '';
  if (showCompensation) {
    if (isUnpaid) {
      compensation =
        p('<strong>This internship is unpaid.</strong>') +
        p(
          `However, ${esc(company)} may, at its sole discretion, offer performance-based incentives subject to internal policies and conditions.`,
          8,
        ) +
        (offer.benefits
          ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;"><div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Benefits &amp; Perks</div><div style="font-size:12px;color:${BODY};line-height:1.6;">${multiline(offer.benefits)}</div></div>`
          : '');
    } else {
      const row = (label: string, value: string, strong = false) =>
        `<tr><td style="padding:5px 0;font-size:12.5px;color:${strong ? INK : BODY};${strong ? 'font-weight:700;' : ''}">${label}</td><td style="padding:5px 0;font-size:12.5px;text-align:right;font-weight:700;color:${INK};">${value}</td></tr>`;
      compensation =
        `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;margin-top:4px;">
           <table style="width:100%;border-collapse:collapse;">
             ${row('Annual CTC', fmtMoney(base + variable, offer.currency), true)}
             ${row('Base Salary', fmtMoney(base, offer.currency))}
             ${variable > 0 ? row('Variable / Performance Pay', fmtMoney(variable, offer.currency)) : ''}
           </table>
           ${offer.salaryBreakdown ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;"><div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Salary Breakdown</div><div style="font-size:12px;color:${BODY};line-height:1.6;">${multiline(offer.salaryBreakdown)}</div></div>` : ''}
           ${offer.benefits ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;"><div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Benefits &amp; Perks</div><div style="font-size:12px;color:${BODY};line-height:1.6;">${multiline(offer.benefits)}</div></div>` : ''}
         </div>`;
    }
  }

  // --- duration ----------------------------------------------------------------------------
  const durationBody = isInternship
    ? p(
        `The internship shall be for a <strong>fixed period of three months</strong>, commencing from <strong>${esc(fmtDate(startDate)) || 'the agreed start date'}</strong>${internEnd ? ` and ending on <strong>${esc(internEnd)}</strong>` : ''}, unless terminated earlier in accordance with this letter.`,
      ) + p('Completion of the internship does not guarantee future employment or extension.', 8)
    : p(
        `Your employment will commence on <strong>${esc(fmtDate(startDate)) || 'the agreed start date'}</strong>.${offer.probationPeriod ? ` You will be on probation for <strong>${esc(offer.probationPeriod)}</strong>.` : ''}`,
      );

  // --- termination -------------------------------------------------------------------------
  const terminationBody = isInternship
    ? p('Either party may terminate this internship by providing <strong>45 days&#39; written notice</strong>.') +
      p(`${esc(company)} reserves the right to terminate the internship <strong>without notice</strong> in cases of serious misconduct or breach of this agreement.`, 8)
    : p(
        offer.noticePeriod
          ? `Either party may terminate this employment by providing <strong>${esc(offer.noticePeriod)} notice</strong>.`
          : 'Either party may terminate this employment as per company policy and applicable laws.',
      );

  // --- assemble sections -------------------------------------------------------------------
  const sections =
    sec(
      'Nature of Engagement',
      isInternship
        ? p(`This engagement is strictly an <strong>internship</strong> and <strong>does not constitute employment</strong> under any labour, employment, or industrial law in India.`) +
            p('You acknowledge and agree that this internship does not create an employer-employee relationship, and continuation is at the company&#39;s discretion.', 8)
        : p(`This is a ${esc(empLabel.toLowerCase())} position with ${esc(company)}. Your employment will be governed by the company&#39;s policies and procedures as amended from time to time.`),
    ) +
    sec(
      'Role and Responsibilities',
      p(`You are being onboarded as <strong>${esc(offer.designation || offer.position)}</strong>${offer.department ? ` in the ${esc(offer.department)} department` : ''}.`) +
        p(`Your responsibilities will be communicated by your reporting manager${offer.reportingManager ? ` (${esc(offer.reportingManager)})` : ''} and may evolve based on business requirements.`, 8),
    ) +
    sec(
      isInternship ? 'Internship Duration' : 'Employment Duration',
      durationBody,
    ) +
    sec(
      'Place of Work',
      p(`Your primary place of work shall be ${offer.workLocation ? `<strong>${esc(offer.workLocation)}</strong>` : 'as designated by the company'}. You may be required to work from other locations or remotely as per business needs.`),
    ) +
    sec(
      'Working Commitment',
      p(`You are expected to devote sincere effort, professional conduct, and reasonable working hours toward assigned tasks. This ${roleWord} may involve variable hours based on project needs.`),
    ) +
    (showCompensation ? sec(isInternship ? 'Compensation and Incentive Structure' : 'Compensation Package', compensation) : '') +
    sec(
      'Performance and Conduct',
      p(`Your continuation in this ${roleWord} is subject to:`) +
        ul(['Satisfactory performance', 'Professional behaviour', 'Adherence to company values and instructions']) +
        p('Any form of negligence, misrepresentation, misconduct, or non-cooperation may result in immediate termination.', 8),
    ) +
    sec(
      'Confidentiality and Non-Disclosure',
      p(`During and after the ${engagement}, you shall maintain strict confidentiality regarding all non-public information related to ${esc(company)}, including but not limited to:`) +
        ul([
          'Business strategies and plans',
          'Client and partner information',
          'Pricing, proposals, and negotiations',
          'Internal tools, documents, data, and communications',
          'Any insider or sensitive company information',
        ]) +
        p('You shall not disclose, copy, store, or share such information in any form without written authorisation. This obligation shall survive the completion or termination of this engagement.', 8),
    ) +
    sec(
      'Intellectual Property Rights',
      p(`All work, content, ideas, documents, leads, strategies, data, and materials created or contributed by you during this ${engagement} shall be the exclusive intellectual property of ${esc(company)}.`) +
        p('You waive any ownership or moral rights over such work to the maximum extent permitted by applicable law.', 8),
    ) +
    sec(
      'Conflict of Interest',
      p(`You shall not engage in any activity or business that conflicts with ${esc(company)}&#39;s interests during this ${engagement} period without prior written consent.`),
    ) +
    sec(
      'Misconduct and Disciplinary Action',
      p(`${esc(company)} reserves the right to terminate this ${engagement} immediately in cases including but not limited to:`) +
        ul(['Breach of confidentiality', 'Misrepresentation or fraud', 'Insubordination or unethical conduct', 'Damage to company reputation or relationships', 'Unauthorised communication on behalf of the company']),
    ) +
    sec('Termination and Notice Period', terminationBody) +
    sec(
      'Company Policies and Rights',
      p(`You agree to comply with all current and future policies, guidelines, and instructions issued by ${esc(company)}. ${esc(company)} reserves the right to modify, amend, or change any terms, policies, or conditions at any time, subject to applicable law.`),
    ) +
    sec(
      'Governing Law and Jurisdiction',
      p(`This letter shall be governed by the laws of India. Courts located in ${jurisdiction} shall have exclusive jurisdiction.`),
    ) +
    (offer.termsAndConditions ? sec('Terms &amp; Conditions', `<div style="font-size:12.5px;line-height:1.7;color:${BODY};">${multiline(offer.termsAndConditions)}</div>`) : '') +
    (offer.additionalNotes ? sec('Additional Notes', `<div style="font-size:12.5px;line-height:1.7;color:${BODY};">${multiline(offer.additionalNotes)}</div>`) : '') +
    sec(
      'Acceptance',
      p('By signing below, you confirm that you have read, understood, and agreed to all the terms and conditions stated in this letter.') +
        p(`We look forward to your contribution and wish you a successful journey with ${esc(company)}.`, 8),
    );

  // --- NDA annexure clauses ----------------------------------------------------------------
  const party = isInternship ? 'Intern' : 'Employee';
  let a = 0;
  const clause = (title: string, body: string) =>
    `<div style="margin-top:18px;page-break-inside:avoid;">${heading(`${++a}. ${title}`)}${body}</div>`;
  const annexure = `
    <div style="margin-top:40px;padding-top:24px;border-top:3px solid ${INK};page-break-before:always;">
      <h1 style="font-size:20px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;margin:0 0 6px;">Annexure A</h1>
      <h2 style="font-size:15px;font-weight:800;color:${INK};text-transform:uppercase;margin:0 0 16px;">Non-Disclosure and Confidentiality Agreement</h2>
      ${p(`This Non-Disclosure Agreement (&quot;Agreement&quot;) is entered into on <strong>${esc(fmtDate(offer.offerDate) || fmtDate(new Date()))}</strong> by and between <strong>${esc(company)}</strong> (the &quot;Company&quot;) and <strong>${esc(offer.candidateName)}</strong> (the &quot;${party}&quot;).`)}
      ${clause('Purpose', p(`The ${party} agrees to receive certain confidential, proprietary, and sensitive information solely for the purpose of performing duties related to the ${engagement} with ${esc(company)}.`))}
      ${clause('Definition of Confidential Information', p('&quot;Confidential Information&quot; includes but is not limited to:') + ul(['Business plans, project roadmaps, and internal strategies', 'Client, partner, and vendor information', 'Pricing models, proposals, contracts, and technical specifications', 'Financial data, internal reports, and proprietary algorithms', 'Software source code, design assets, and development workflows', 'Any non-public information shared verbally, digitally, or in writing']))}
      ${clause('Obligations of the ' + party, p(`The ${party} agrees that they shall:`) + ul(['Keep all Confidential Information strictly confidential', 'Not disclose such information to any third party', 'Not use Confidential Information for personal or external benefit', 'Take reasonable measures to protect such information']))}
      ${clause('Exceptions', p('Confidential Information does not include information that is publicly available without breach of this Agreement, is lawfully obtained from a third party without restriction, or is required to be disclosed by law or court order.'))}
      ${clause('Intellectual Property', p(`All work, data, materials, documentation, strategies, or outputs created or accessed during this ${engagement} remain the <strong>exclusive property of ${esc(company)}</strong>. No licence or ownership rights are granted to the ${party}.`))}
      ${clause('Non-Solicitation', p(`During the ${engagement} and for a reasonable period thereafter as permitted by law, the ${party} shall not solicit ${esc(company)}&#39;s clients, partners, vendors, or employees for competing or personal purposes.`))}
      ${clause('Data Protection and Security', p(`The ${party} agrees to:`) + ul(['Use only authorised devices and tools', 'Not share login credentials', 'Immediately report any data breach or security incident']))}
      ${clause('Term and Survival', p(`This Agreement shall remain effective <strong>during the ${engagement} and indefinitely thereafter</strong>, regardless of the manner of termination.`))}
      ${clause('Breach and Remedies', p(`The ${party} acknowledges that any breach may cause irreparable harm to the Company, entitling ${esc(company)} to injunctive relief, monetary damages, legal costs, and any other remedy available under Indian law.`))}
      ${clause('Governing Law and Jurisdiction', p(`This Agreement shall be governed by the laws of India. Courts located in ${jurisdiction} shall have exclusive jurisdiction.`))}
      ${clause('Entire Agreement', p('This Agreement constitutes the entire understanding between the parties concerning confidentiality and supersedes all prior communications.'))}

      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;page-break-inside:avoid;">
        ${heading('Signatures')}
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tr>
            <td style="width:50%;vertical-align:bottom;padding-right:16px;">
              <div style="font-size:12px;font-weight:700;color:${INK};margin-bottom:26px;">For ${esc(company)}</div>
              <div style="width:190px;border-bottom:1.5px solid ${INK};"></div>
              <div style="font-size:11px;color:${MUTED};margin-top:6px;">Authorised Signatory</div>
            </td>
            <td style="width:50%;vertical-align:bottom;">
              <div style="font-size:12px;font-weight:700;color:${INK};margin-bottom:26px;">${esc(party)}</div>
              <div style="width:190px;border-bottom:1.5px solid ${INK};"></div>
              <div style="font-size:11px;color:${MUTED};margin-top:6px;">${esc(offer.candidateName)}</div>
            </td>
          </tr>
        </table>
      </div>
    </div>`;

  const legalFooter = `
    <div style="margin-top:26px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:9px;color:#94a3b8;line-height:1.6;page-break-inside:avoid;">
      <div style="font-weight:700;margin-bottom:4px;">Legal Disclaimer</div>
      This document is confidential and intended solely for the individual to whom it is addressed. This offer letter and any
      associated annexures do not constitute an employment contract unless explicitly stated. ${esc(company)} reserves the right
      to interpret, modify, amend, suspend, or withdraw any terms at its sole discretion, subject to applicable laws.
      Unauthorised copying, sharing, or misuse of this document is strictly prohibited.
    </div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Offer Letter — ${esc(offer.candidateName)}</title>
<style>@page { size: A4; margin: 16mm 15mm; }</style>
</head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};">
  <div style="max-width:780px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:36px 44px 40px;">

      <!-- Letterhead -->
      <div style="border-bottom:4px solid ${ACCENT};padding-bottom:16px;page-break-inside:avoid;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:40%;">
              <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;color:${INK};">${esc(company)}</div>
              ${companyAddress(snap) ? `<div style="font-size:11px;color:${MUTED};margin-top:4px;max-width:280px;">${companyAddress(snap)}</div>` : ''}
              ${snap?.email || snap?.website ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">${[esc(snap?.email), esc(snap?.website)].filter(Boolean).join(' · ')}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:center;width:26%;">
              <div style="font-size:16px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.02em;line-height:1.2;">${isInternship ? 'Internship<br/>' : ''}Offer Letter</div>
            </td>
            <td style="vertical-align:top;text-align:right;width:34%;white-space:nowrap;">
              <span style="display:inline-block;background:#f1f5f9;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;color:${INK};">#${esc(number)}</span>
              <div style="font-size:9.5px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.14em;margin-top:8px;">Dated ${esc(fmtDate(offer.offerDate) || fmtDate(new Date()))}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- To + subject -->
      <div style="margin-top:24px;page-break-inside:avoid;">
        <div style="font-size:12.5px;font-weight:700;color:${INK};">To,</div>
        <div style="font-size:12.5px;font-weight:700;color:${INK};margin-top:3px;">${esc(offer.candidateName)}</div>
        ${offer.candidateAddress ? `<div style="font-size:12px;color:${BODY};margin-top:2px;white-space:pre-line;">${multiline(offer.candidateAddress)}</div>` : ''}
        ${offer.candidateEmail ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(offer.candidateEmail)}</div>` : ''}
        <div style="font-size:13px;font-weight:700;color:${INK};margin-top:16px;">Subject: Offer of ${isInternship ? 'Internship' : 'Employment'} — ${esc(offer.position)} at ${esc(company)}</div>
      </div>

      <!-- Intro -->
      <div style="margin-top:18px;page-break-inside:avoid;">
        <div style="font-size:12.5px;line-height:1.7;color:${BODY};">Dear ${firstName(offer.candidateName)},</div>
        ${p(
          isInternship
            ? `We are pleased to offer you an <strong>internship</strong> with <strong>${esc(company)}</strong> for the role of <strong>${esc(offer.position)}</strong>, subject to the terms and conditions outlined in this letter.`
            : `We are pleased to extend this offer of employment to you for the position of <strong>${esc(offer.position)}</strong> at ${esc(company)}. After careful consideration of your qualifications and experience, we believe you will be a valuable addition to our team.`,
          10,
        )}
        ${p(`Please read this letter carefully, as it defines the complete understanding between you and ${esc(company)}.`, 8)}
      </div>

      ${sections}

      <!-- Sign-off -->
      <div style="margin-top:30px;page-break-inside:avoid;">
        <div style="font-size:12.5px;font-weight:700;color:${INK};">Warm regards,</div>
        <div style="font-size:12.5px;color:${BODY};margin-top:2px;">For ${esc(company)}</div>
      </div>

      <!-- Contact + authorised signatory -->
      <table style="width:100%;border-collapse:collapse;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;page-break-inside:avoid;">
        <tr>
          <td style="vertical-align:top;width:55%;">
            <div style="font-size:10px;font-weight:800;color:${INK};text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Contact Information</div>
            ${companyAddress(snap) ? `<div style="font-size:11px;color:${BODY};">${companyAddress(snap)}</div>` : ''}
            ${snap?.email ? `<div style="font-size:11px;color:${BODY};">Email: ${esc(snap.email)}</div>` : ''}
            ${snap?.gstin ? `<div style="font-size:11px;color:${BODY};">GSTIN/Udyam: ${esc(snap.gstin)}</div>` : ''}
          </td>
          <td style="vertical-align:bottom;text-align:right;">
            <div style="width:180px;border-bottom:1.5px solid ${INK};margin:34px 0 0 auto;"></div>
            <div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.1em;margin-top:6px;">Authorised Signatory, ${esc(company)}</div>
          </td>
        </tr>
      </table>

      <!-- Candidate acceptance -->
      <div style="margin-top:28px;page-break-inside:avoid;">
        ${heading('Candidate Acceptance')}
        ${p(`I, <strong>${esc(offer.candidateName)}</strong>, accept this ${engagement} offer and agree to all terms and conditions stated above.`)}
        <table style="width:100%;border-collapse:collapse;margin-top:22px;">
          <tr>
            <td style="width:50%;padding-right:16px;">
              <div style="font-size:11px;font-weight:700;color:${MUTED};margin-bottom:20px;">Signature</div>
              <div style="border-bottom:1.5px solid ${INK};"></div>
            </td>
            <td style="width:50%;">
              <div style="font-size:11px;font-weight:700;color:${MUTED};margin-bottom:20px;">Date</div>
              <div style="border-bottom:1.5px solid ${INK};"></div>
            </td>
          </tr>
        </table>
      </div>

      ${legalFooter}
      ${annexure}
      ${legalFooter}
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
