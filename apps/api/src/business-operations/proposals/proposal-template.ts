import { Proposal, ProposalSection } from '@prisma/client';
import {
  INK, BODY, MUTED, esc, fmtDate, companyName, header, shell, billTo, safeFilePart,
  CompanySnapshot, ClientSnapshot,
} from '../shared/doc-render';

/**
 * Renders a Proposal (with its ordered rich-text sections) into the shared teal document
 * chrome. Non-financial - no line items or totals. Each section's `content` is already
 * sanitized rich-text HTML and is rendered as-is; only chrome/snapshot text is escaped.
 */

export type ProposalWithSections = Proposal & { sections: ProposalSection[] };

export interface RenderedProposal {
  subject: string;
  html: string;
  fileName: string;
}

export function renderProposal(proposal: ProposalWithSections): RenderedProposal {
  const snap = (proposal.companySnapshot ?? null) as CompanySnapshot;
  const client = (proposal.clientSnapshot ?? null) as ClientSnapshot;
  const company = companyName(snap);
  const number = proposal.reference || '(draft)';
  const sections = proposal.sections ?? [];

  const sectionHtml = sections
    .map(
      (s) => `
      <div style="margin-top:22px;">
        <div style="font-size:14px;font-weight:800;color:${INK};letter-spacing:-.01em;">${esc(s.title)}</div>
        <div style="font-size:12.5px;color:${BODY};margin-top:6px;line-height:1.55;">${s.content ?? ''}</div>
      </div>`,
    )
    .join('');

  const content = `
${header(snap, 'Proposal', number, proposal.createdAt)}
${billTo(client, proposal.clientName)}

      <div style="margin-top:24px;">
        <div style="font-size:18px;font-weight:800;color:${INK};letter-spacing:-.02em;">${esc(proposal.title)}</div>
        ${proposal.reference ? `<div style="font-size:11px;color:${MUTED};margin-top:3px;">Reference: ${esc(proposal.reference)}</div>` : ''}
        ${proposal.validUntil ? `<div style="font-size:11px;color:${MUTED};margin-top:2px;">Valid until ${esc(fmtDate(proposal.validUntil))}</div>` : ''}
      </div>

      ${proposal.summary ? `<div style="margin-top:14px;font-size:12.5px;color:${BODY};line-height:1.55;">${esc(proposal.summary)}</div>` : ''}

      ${sectionHtml}`;

  return {
    subject: `Proposal - ${proposal.title} from ${company}`,
    html: shell(`Proposal - ${proposal.title}`, content),
    fileName: `Proposal-${safeFilePart(proposal.reference || proposal.title)}.pdf`,
  };
}
