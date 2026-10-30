import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { MailService } from '../../platform/mail/mail.service';
import { DocumentRenderService } from '../document-templates/document-render.service';
import { proposalContext } from '../document-templates/template-variables';
import { renderProposal, ProposalWithSections } from './proposal-template';
import { CreateProposalDto, ProposalSectionDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ListProposalsDto } from './dto/list-proposals.dto';

/**
 * Proposal orchestration. Proposals are NOT financial documents - this service
 * does not touch the Tax Engine, Document Numbering, or totals. It reuses
 * CompanyService/ClientsService for snapshots and stores ordered rich-text (HTML)
 * sections. Editable only while DRAFT; read-only once SENT.
 */
@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly clients: ClientsService,
    private readonly mail: MailService,
    private readonly docs: DocumentRenderService,
  ) {}

  private async snapshots(orgId: string, clientId?: string | null, clientName?: string | null) {
    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      clientId ? this.clients.findOne(clientId, orgId) : Promise.resolve(null),
    ]);
    const clientSnapshot = client
      ? {
          id: client.id, name: client.name, companyName: client.companyName, email: client.email,
          billingState: client.billingState, billingCountry: client.billingCountry,
        }
      : clientName
        ? { name: clientName }
        : null;
    return {
      companySnapshot: (company ?? null) as Prisma.InputJsonValue,
      clientSnapshot: (clientSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    };
  }

  // Ordered section rows. `order` from the client is advisory; we normalise to a
  // dense 0..n sortOrder based on array position so drag-reordering is authoritative.
  private sectionData(sections: ProposalSectionDto[] = []) {
    return sections.map((s, i) => ({
      title: s.title,
      content: s.content ?? '',
      sortOrder: i,
    }));
  }

  async create(orgId: string, dto: CreateProposalDto) {
    const snap = await this.snapshots(orgId, dto.clientId, dto.clientName);
    const templateId = await this.docs.pickTemplate(orgId, 'PROPOSAL', dto.templateId);
    return this.prisma.proposal.create({
      data: {
        orgId, templateId, clientId: dto.clientId ?? null, clientName: dto.clientName ?? null, status: 'DRAFT', title: dto.title,
        reference: dto.reference, summary: dto.summary,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        companySnapshot: snap.companySnapshot, clientSnapshot: snap.clientSnapshot,
        sections: { create: this.sectionData(dto.sections) },
      },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(id: string, orgId: string, dto: UpdateProposalDto) {
    const proposal = await this.findOne(id, orgId);
    if (proposal.status !== 'DRAFT') throw new BadRequestException('Only draft proposals can be edited');
    const clientId = dto.clientId ?? proposal.clientId;
    const clientName = dto.clientName ?? proposal.clientName;
    const snap = await this.snapshots(orgId, clientId, clientName);
    const sections = dto.sections ?? proposal.sections.map(fromRow);
    const templateId = await this.docs.pickTemplate(orgId, 'PROPOSAL', dto.templateId);
    return this.prisma.proposal.update({
      where: { id },
      data: {
        templateId, clientId, clientName, title: dto.title ?? proposal.title,
        reference: dto.reference ?? proposal.reference,
        summary: dto.summary ?? proposal.summary,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : proposal.validUntil,
        companySnapshot: snap.companySnapshot, clientSnapshot: snap.clientSnapshot,
        sections: { deleteMany: {}, create: this.sectionData(sections) },
      },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findOne(id: string, orgId: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, orgId },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }

  async list(orgId: string, query: ListProposalsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ProposalWhereInput = { orgId };
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { reference: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where, orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.proposal.count({ where }),
    ]);
    return { success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Refresh company/client snapshots on a DRAFT so newly-added details show; frozen once sent. */
  private async withCurrentSnapshots(proposal: ProposalWithSections, orgId: string): Promise<ProposalWithSections> {
    if (proposal.status !== 'DRAFT') return proposal;
    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      proposal.clientId ? this.clients.findOne(proposal.clientId, orgId).catch(() => null) : Promise.resolve(null),
    ]);
    const clientSnapshot = client
      ? {
          id: client.id, name: client.name, companyName: client.companyName, email: client.email,
          billingState: client.billingState, billingCountry: client.billingCountry,
        }
      : proposal.clientName
        ? { name: proposal.clientName }
        : proposal.clientSnapshot;
    return {
      ...proposal,
      companySnapshot: (company ?? proposal.companySnapshot) as Prisma.JsonValue,
      clientSnapshot: clientSnapshot as Prisma.JsonValue,
    } as ProposalWithSections;
  }

  private recipientEmail(proposal: ProposalWithSections): string | undefined {
    const snap = proposal.clientSnapshot as { email?: string | null } | null;
    return snap?.email ?? undefined;
  }

  /** The document the client receives - same renderer used by send(). Available in any status. */

  /** Subject/file name from the classic renderer; the HTML from the org's template. */
  private async render(proposal: Parameters<typeof renderProposal>[0], orgId: string) {
    const classic = renderProposal(proposal);
    try {
      const html = await this.docs.html('PROPOSAL', 'proposal', orgId, proposal, proposalContext(proposal));
      return { ...classic, html };
    } catch (err) {
      this.logger.warn(`Proposal ${proposal.id}: template render failed, using the classic layout - ${(err as Error).message}`);
      return classic;
    }
  }
  async preview(id: string, orgId: string) {
    const proposal = await this.withCurrentSnapshots(await this.findOne(id, orgId), orgId);
    const { subject, html } = await this.render(proposal, orgId);
    return { to: this.recipientEmail(proposal) ?? null, subject, html };
  }

  async toPdf(id: string, orgId: string): Promise<{ fileName: string; buffer: Buffer }> {
    const proposal = await this.withCurrentSnapshots(await this.findOne(id, orgId), orgId);
    const { html, fileName } = await this.render(proposal, orgId);
    return { fileName, buffer: await this.docs.toPdf(html) };
  }

  /**
   * Emails the rendered proposal (PDF attached) to the client and advances DRAFT -> SENT. The
   * status is only persisted after the email succeeds, so "Sent" always means delivered. If
   * there's no recipient email, throws. PDF generation degrades gracefully.
   */
  async send(id: string, orgId: string) {
    const draft = await this.findOne(id, orgId);
    if (draft.status !== 'DRAFT') throw new BadRequestException('Only draft proposals can be sent');
    const proposal = await this.withCurrentSnapshots(draft, orgId);
    const to = this.recipientEmail(proposal);
    if (!to) throw new BadRequestException('No client email to send to');
    const { subject, html, fileName } = await this.render(proposal, orgId);
    let attachments: { filename: string; content: Buffer }[] | undefined;
    try {
      attachments = [{ filename: fileName, content: await this.docs.toPdf(html) }];
    } catch (err) {
      this.logger.warn(`Proposal ${proposal.id}: PDF generation failed, sending without attachment - ${(err as Error).message}`);
    }
    await this.mail.sendDocumentEmail(to, subject, html, attachments);
    return this.prisma.proposal.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async archive(id: string, orgId: string) {
    const proposal = await this.findOne(id, orgId);
    if (proposal.status === 'ARCHIVED') throw new BadRequestException('Proposal is already archived');
    return this.prisma.proposal.update({
      where: { id },
      data: { status: 'ARCHIVED' },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async duplicate(id: string, orgId: string) {
    const proposal = await this.findOne(id, orgId);
    return this.create(orgId, {
      clientId: proposal.clientId ?? undefined, clientName: proposal.clientName ?? undefined,
      title: `${proposal.title} (copy)`,
      reference: proposal.reference ?? undefined, summary: proposal.summary ?? undefined,
      sections: proposal.sections.map(fromRow),
    });
  }

  async remove(id: string, orgId: string) {
    const proposal = await this.findOne(id, orgId);
    if (proposal.status !== 'DRAFT') throw new BadRequestException('Only draft proposals can be deleted');
    await this.prisma.proposal.delete({ where: { id } });
    return { deleted: true };
  }
}

function fromRow(row: { title: string; content: string }): ProposalSectionDto {
  return { title: row.title, content: row.content };
}
