import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { TaxService } from '../tax/tax.service';
import { CreateInvoiceDto, InvoiceLineDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

/**
 * Invoice orchestration. It NEVER calculates taxes, document numbers, or company defaults
 * itself — those come from TaxService, DocumentNumberingService, and CompanyService. This
 * service only loads inputs, delegates, and persists.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly company: CompanyService,
    private readonly clients: ClientsService,
    private readonly numbering: DocumentNumberingService,
    private readonly tax: TaxService,
  ) {}

  private lineToTaxItem(l: InvoiceLineDto) {
    return {
      description: l.description,
      quantity: l.quantity,
      price: l.unitPrice,
      discount: l.discount,
      discountType: l.discountType,
      taxes: l.taxes,
    };
  }

  /** Loads company + client, delegates totals to the Tax Engine, returns persistable data. */
  private async build(orgId: string, dto: CreateInvoiceDto | UpdateInvoiceDto, clientId: string) {
    const [company, client] = await Promise.all([
      this.company.getForOrg(orgId),
      this.clients.findOne(clientId, orgId),
    ]);

    const lines = dto.lines ?? [];
    const summary = await this.tax.calculate(orgId, {
      items: lines.map((l) => this.lineToTaxItem(l)),
      companyState: company?.state ?? undefined,
      customerState: client.billingState ?? undefined,
      customerCountry: client.billingCountry ?? undefined,
      customerHasGstin: !!client.gstin,
      priceMode: dto.priceMode as 'EXCLUSIVE' | 'INCLUSIVE' | undefined,
    });

    const lineData = lines.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discount: l.discount ?? 0,
      discountType: l.discountType ?? 'PERCENT',
      taxes: (l.taxes ?? []) as unknown as Prisma.InputJsonValue,
      notes: l.notes,
      lineTaxable: summary.lines[i]?.taxable ?? 0,
      lineTax: summary.lines[i]?.taxAmount ?? 0,
      lineTotal: summary.lines[i]?.total ?? 0,
      sortOrder: i,
    }));

    return {
      client,
      companySnapshot: (company ?? null) as Prisma.InputJsonValue,
      clientSnapshot: {
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        email: client.email,
        gstin: client.gstin,
        billingState: client.billingState,
        billingCountry: client.billingCountry,
      } as Prisma.InputJsonValue,
      totals: {
        subtotal: summary.subtotal,
        discountTotal: summary.discountTotal,
        taxableTotal: summary.taxableTotal,
        taxTotal: summary.taxTotal,
        roundOff: summary.roundOff,
        grandTotal: summary.grandTotal,
        taxBreakdown: summary.taxBreakdown as unknown as Prisma.InputJsonValue,
      },
      lineData,
    };
  }

  async create(orgId: string, dto: CreateInvoiceDto) {
    const built = await this.build(orgId, dto, dto.clientId);
    return this.prisma.invoice.create({
      data: {
        orgId,
        clientId: dto.clientId,
        status: 'DRAFT',
        invoiceType: dto.invoiceType ?? 'STANDARD',
        currency: dto.currency ?? 'INR',
        notes: dto.notes,
        terms: dto.terms,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priceMode: dto.priceMode ?? 'EXCLUSIVE',
        companySnapshot: built.companySnapshot,
        clientSnapshot: built.clientSnapshot,
        ...built.totals,
        lines: { create: built.lineData },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(id: string, orgId: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id, orgId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be edited');
    }
    const clientId = dto.clientId ?? invoice.clientId;
    const built = await this.build(orgId, { ...dto, lines: dto.lines ?? invoice.lines.map(fromRow) }, clientId);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        clientId,
        invoiceType: dto.invoiceType ?? invoice.invoiceType,
        currency: dto.currency ?? invoice.currency,
        notes: dto.notes ?? invoice.notes,
        terms: dto.terms ?? invoice.terms,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : invoice.dueDate,
        priceMode: dto.priceMode ?? invoice.priceMode,
        companySnapshot: built.companySnapshot,
        clientSnapshot: built.clientSnapshot,
        ...built.totals,
        lines: { deleteMany: {}, create: built.lineData },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findOne(id: string, orgId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, orgId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async list(orgId: string, query: ListInvoicesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.InvoiceWhereInput = { orgId };
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
      this.prisma.invoice.findMany({
        where,
        orderBy: { [query.sort ?? 'createdAt']: query.order ?? 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { lines: false },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** Reserve the number (never reused) and lock the invoice. */
  async issue(id: string, orgId: string) {
    const invoice = await this.findOne(id, orgId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be issued');
    }
    // Credit notes require a distinct number series (GST). Other sub-types share INVOICE.
    const numberingType = invoice.invoiceType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : 'INVOICE';
    const reserved = await this.numbering.next(orgId, numberingType);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        number: reserved.number,
        status: 'ISSUED',
        issueDate: invoice.issueDate ?? new Date(),
        issuedAt: new Date(),
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async cancel(id: string, orgId: string) {
    const invoice = await this.findOne(id, orgId);
    const cancellable: InvoiceStatus[] = ['ISSUED', 'SENT', 'PARTIALLY_PAID'];
    if (!cancellable.includes(invoice.status)) {
      throw new BadRequestException(`Cannot cancel an invoice in status ${invoice.status}`);
    }
    return this.prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Duplicate creates a fresh DRAFT (no number). */
  async duplicate(id: string, orgId: string) {
    const invoice = await this.findOne(id, orgId);
    return this.create(orgId, {
      clientId: invoice.clientId,
      invoiceType: invoice.invoiceType,
      currency: invoice.currency,
      notes: invoice.notes ?? undefined,
      terms: invoice.terms ?? undefined,
      priceMode: invoice.priceMode,
      lines: invoice.lines.map(fromRow),
    });
  }

  async remove(id: string, orgId: string) {
    const invoice = await this.findOne(id, orgId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be deleted');
    }
    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true };
  }
}

/** Map a persisted line row back into a line input (for update/duplicate). */
function fromRow(row: {
  description: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discount: number;
  discountType: string;
  taxes: unknown;
  notes: string | null;
}): InvoiceLineDto {
  return {
    description: row.description,
    quantity: row.quantity,
    unit: row.unit ?? undefined,
    unitPrice: row.unitPrice,
    discount: row.discount,
    discountType: row.discountType as 'PERCENT' | 'FIXED',
    taxes: (row.taxes as InvoiceLineDto['taxes']) ?? undefined,
    notes: row.notes ?? undefined,
  };
}
