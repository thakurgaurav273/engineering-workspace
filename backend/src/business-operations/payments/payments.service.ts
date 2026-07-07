import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';

// An invoice can only receive payments once it is issued and still open. DRAFT has
// no number yet; PAID is fully settled; CANCELLED/VOID are terminal.
const PAYABLE: InvoiceStatus[] = ['ISSUED', 'SENT', 'PARTIALLY_PAID'];

/**
 * Payments orchestration. Records money received against an issued Invoice and
 * keeps the invoice's amountPaid + status in sync. The Invoice remains the single
 * source of truth for totals; payments never touch the Tax Engine or numbering.
 */
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async invoiceOr404(invoiceId: string, orgId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // Recompute amountPaid (sum of payments) and derive the invoice status. A terminal
  // state (CANCELLED/VOID) is authoritative: deleting a payment must never resurrect a
  // cancelled invoice, so we only refresh amountPaid and leave the status untouched.
  private async recompute(tx: Prisma.TransactionClient, invoiceId: string) {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const agg = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
    const amountPaid = Math.round((agg._sum.amount ?? 0) * 100) / 100;

    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      return tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid } });
    }

    let status = invoice.status;
    if (invoice.grandTotal > 0 && amountPaid >= invoice.grandTotal) status = 'PAID';
    else if (amountPaid > 0) status = 'PARTIALLY_PAID';
    else if (invoice.status === 'PAID' || invoice.status === 'PARTIALLY_PAID') status = 'ISSUED';

    return tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status } });
  }

  async create(orgId: string, dto: CreatePaymentDto) {
    const invoice = await this.invoiceOr404(dto.invoiceId, orgId);
    if (!PAYABLE.includes(invoice.status)) {
      throw new BadRequestException(`Cannot record a payment against a ${invoice.status} invoice`);
    }
    // Guard against overpayment corrupting the ledger (0.01 tolerance for float rounding).
    if (invoice.amountPaid + dto.amount > invoice.grandTotal + 0.01) {
      throw new BadRequestException('Payment exceeds the invoice balance due');
    }
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orgId, invoiceId: dto.invoiceId, amount: dto.amount,
          paymentDate: new Date(dto.paymentDate), method: dto.method ?? 'BANK_TRANSFER',
          reference: dto.reference, notes: dto.notes,
        },
      });
      await this.recompute(tx, dto.invoiceId);
      return payment;
    });
  }

  async findOne(id: string, orgId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, orgId },
      include: { invoice: { select: { number: true, currency: true, grandTotal: true, clientSnapshot: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async list(orgId: string, query: ListPaymentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.PaymentWhereInput = { orgId };
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    if (query.method) where.method = query.method;
    if (query.clientId) where.invoice = { clientId: query.clientId };
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { invoice: { number: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.paymentDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    const [data, total, agg] = await Promise.all([
      this.prisma.payment.findMany({
        where, orderBy: { [query.sort ?? 'paymentDate']: query.order ?? 'desc' },
        skip: (page - 1) * limit, take: limit,
        include: { invoice: { select: { number: true, currency: true, clientSnapshot: true } } },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      success: true,
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalAmount: agg._sum.amount ?? 0 },
    };
  }

  async remove(id: string, orgId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, orgId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });
      await this.recompute(tx, payment.invoiceId);
      return { deleted: true };
    });
  }
}
