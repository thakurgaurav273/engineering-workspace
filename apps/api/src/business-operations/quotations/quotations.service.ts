import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QuotationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { TaxService } from '../tax/tax.service';
import { CreateQuotationDto, QuotationLineDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { ListQuotationsDto } from './dto/list-quotations.dto';

/** Quotation orchestration — mirrors InvoicesService. Never computes taxes/numbers/totals. */
@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly clients: ClientsService,
    private readonly numbering: DocumentNumberingService,
    private readonly tax: TaxService,
  ) {}

  private async build(orgId: string, dto: CreateQuotationDto | UpdateQuotationDto, clientId: string) {
    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      this.clients.findOne(clientId, orgId),
    ]);
    const lines = dto.lines ?? [];
    const summary = await this.tax.calculate(orgId, {
      items: lines.map((l) => ({
        description: l.description, quantity: l.quantity, price: l.unitPrice,
        discount: l.discount, discountType: l.discountType, taxes: l.taxes,
      })),
      companyState: company?.state ?? undefined,
      customerState: client.billingState ?? undefined,
      customerCountry: client.billingCountry ?? undefined,
      customerHasGstin: !!client.gstin,
      priceMode: dto.priceMode as 'EXCLUSIVE' | 'INCLUSIVE' | undefined,
    });
    const lineData = lines.map((l, i) => ({
      description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice,
      discount: l.discount ?? 0, discountType: l.discountType ?? 'PERCENT',
      taxes: (l.taxes ?? []) as unknown as Prisma.InputJsonValue, notes: l.notes,
      lineTaxable: summary.lines[i]?.taxable ?? 0, lineTax: summary.lines[i]?.taxAmount ?? 0,
      lineTotal: summary.lines[i]?.total ?? 0, sortOrder: i,
    }));
    return {
      companySnapshot: (company ?? null) as Prisma.InputJsonValue,
      clientSnapshot: {
        id: client.id, name: client.name, companyName: client.companyName, email: client.email,
        gstin: client.gstin, billingState: client.billingState, billingCountry: client.billingCountry,
      } as Prisma.InputJsonValue,
      totals: {
        subtotal: summary.subtotal, discountTotal: summary.discountTotal, taxableTotal: summary.taxableTotal,
        taxTotal: summary.taxTotal, roundOff: summary.roundOff, grandTotal: summary.grandTotal,
        taxBreakdown: summary.taxBreakdown as unknown as Prisma.InputJsonValue,
      },
      lineData,
    };
  }

  async create(orgId: string, dto: CreateQuotationDto) {
    const built = await this.build(orgId, dto, dto.clientId);
    return this.prisma.quotation.create({
      data: {
        orgId, clientId: dto.clientId, status: 'DRAFT', currency: dto.currency ?? 'INR',
        notes: dto.notes, terms: dto.terms, expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        priceMode: dto.priceMode ?? 'EXCLUSIVE', companySnapshot: built.companySnapshot,
        clientSnapshot: built.clientSnapshot, ...built.totals, lines: { create: built.lineData },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(id: string, orgId: string, dto: UpdateQuotationDto) {
    const quotation = await this.findOne(id, orgId);
    if (quotation.status !== 'DRAFT') throw new BadRequestException('Only draft quotations can be edited');
    const clientId = dto.clientId ?? quotation.clientId;
    const built = await this.build(orgId, { ...dto, lines: dto.lines ?? quotation.lines.map(fromRow) }, clientId);
    return this.prisma.quotation.update({
      where: { id },
      data: {
        clientId, currency: dto.currency ?? quotation.currency, notes: dto.notes ?? quotation.notes,
        terms: dto.terms ?? quotation.terms,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : quotation.expiryDate,
        priceMode: dto.priceMode ?? quotation.priceMode, companySnapshot: built.companySnapshot,
        clientSnapshot: built.clientSnapshot, ...built.totals,
        lines: { deleteMany: {}, create: built.lineData },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findOne(id: string, orgId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, orgId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async list(orgId: string, query: ListQuotationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.QuotationWhereInput = { orgId };
    if (query.status) where.status = query.status;
    if (query.clientId) where.clientId = query.clientId;
    if (query.search) where.number = { contains: query.search.trim(), mode: 'insensitive' };
    if (query.dateFrom || query.dateTo) {
      where.issueDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where, orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async issue(id: string, orgId: string) {
    const quotation = await this.findOne(id, orgId);
    if (quotation.status !== 'DRAFT') throw new BadRequestException('Only draft quotations can be issued');
    const reserved = await this.numbering.next(orgId, 'QUOTATION');
    return this.prisma.quotation.update({
      where: { id },
      data: { number: reserved.number, status: 'ISSUED', issueDate: quotation.issueDate ?? new Date(), issuedAt: new Date() },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async cancel(id: string, orgId: string) {
    const quotation = await this.findOne(id, orgId);
    const cancellable: QuotationStatus[] = ['ISSUED', 'SENT', 'ACCEPTED'];
    if (!cancellable.includes(quotation.status)) {
      throw new BadRequestException(`Cannot cancel a quotation in status ${quotation.status}`);
    }
    return this.prisma.quotation.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async duplicate(id: string, orgId: string) {
    const quotation = await this.findOne(id, orgId);
    return this.create(orgId, {
      clientId: quotation.clientId, currency: quotation.currency, notes: quotation.notes ?? undefined,
      terms: quotation.terms ?? undefined, priceMode: quotation.priceMode, lines: quotation.lines.map(fromRow),
    });
  }

  async remove(id: string, orgId: string) {
    const quotation = await this.findOne(id, orgId);
    if (quotation.status !== 'DRAFT') throw new BadRequestException('Only draft quotations can be deleted');
    await this.prisma.quotation.delete({ where: { id } });
    return { deleted: true };
  }
}

function fromRow(row: {
  description: string; quantity: number; unit: string | null; unitPrice: number;
  discount: number; discountType: string; taxes: unknown; notes: string | null;
}): QuotationLineDto {
  return {
    description: row.description, quantity: row.quantity, unit: row.unit ?? undefined,
    unitPrice: row.unitPrice, discount: row.discount, discountType: row.discountType as 'PERCENT' | 'FIXED',
    taxes: (row.taxes as QuotationLineDto['taxes']) ?? undefined, notes: row.notes ?? undefined,
  };
}
