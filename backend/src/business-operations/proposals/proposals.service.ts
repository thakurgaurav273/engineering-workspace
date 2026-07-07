import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { CreateProposalDto, ProposalSectionDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { ListProposalsDto } from './dto/list-proposals.dto';

/**
 * Proposal orchestration. Proposals are NOT financial documents — this service
 * does not touch the Tax Engine, Document Numbering, or totals. It reuses
 * CompanyService/ClientsService for snapshots and stores ordered rich-text (HTML)
 * sections. Editable only while DRAFT; read-only once SENT.
 */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly clients: ClientsService,
  ) {}

  private async snapshots(orgId: string, clientId: string) {
    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      this.clients.findOne(clientId, orgId),
    ]);
    return {
      companySnapshot: (company ?? null) as Prisma.InputJsonValue,
      clientSnapshot: {
        id: client.id, name: client.name, companyName: client.companyName, email: client.email,
        billingState: client.billingState, billingCountry: client.billingCountry,
      } as Prisma.InputJsonValue,
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
    const snap = await this.snapshots(orgId, dto.clientId);
    return this.prisma.proposal.create({
      data: {
        orgId, clientId: dto.clientId, status: 'DRAFT', title: dto.title,
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
    const snap = await this.snapshots(orgId, clientId);
    const sections = dto.sections ?? proposal.sections.map(fromRow);
    return this.prisma.proposal.update({
      where: { id },
      data: {
        clientId, title: dto.title ?? proposal.title,
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

  async send(id: string, orgId: string) {
    const proposal = await this.findOne(id, orgId);
    if (proposal.status !== 'DRAFT') throw new BadRequestException('Only draft proposals can be sent');
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
      clientId: proposal.clientId, title: `${proposal.title} (copy)`,
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
