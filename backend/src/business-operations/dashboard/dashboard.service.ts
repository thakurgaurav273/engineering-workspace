import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Statuses that represent a real, collectible invoice (excludes DRAFT/CANCELLED/VOID).
const OPEN: InvoiceStatus[] = ['ISSUED', 'SENT', 'PARTIALLY_PAID'];
const BILLED: InvoiceStatus[] = ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Business Operations — Dashboard analytics. Read-only aggregation over existing
 * tables (Invoice, Payment, Quotation, Proposal, OfferLetter, Client). No models,
 * no migration; the source modules remain the single source of truth.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(orgId: string) {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - 5, 1); // start of the 6-month window

    const [byStatus, quotations, proposals, offerLetters, clients, recent, recentPayments] =
      await Promise.all([
        this.prisma.invoice.groupBy({
          by: ['status'], where: { orgId },
          _count: { _all: true }, _sum: { grandTotal: true, amountPaid: true },
        }),
        this.prisma.quotation.count({ where: { orgId } }),
        this.prisma.proposal.count({ where: { orgId } }),
        this.prisma.offerLetter.count({ where: { orgId } }),
        this.prisma.client.count({ where: { orgId, isActive: true } }),
        this.prisma.invoice.findMany({
          where: { orgId, NOT: { status: 'DRAFT' } },
          orderBy: { issueDate: 'desc' }, take: 5,
          select: { id: true, number: true, status: true, grandTotal: true, amountPaid: true, currency: true, issueDate: true, clientSnapshot: true },
        }),
        this.prisma.payment.findMany({
          where: { orgId, paymentDate: { gte: since } },
          select: { amount: true, paymentDate: true },
        }),
      ]);

    let collected = 0, invoiced = 0, outstanding = 0, invoiceCount = 0;
    const invoicesByStatus: Record<string, number> = {};
    for (const g of byStatus) {
      const count = g._count._all;
      invoiceCount += count;
      invoicesByStatus[g.status] = count;
      const total = g._sum.grandTotal ?? 0;
      const paid = g._sum.amountPaid ?? 0;
      collected += paid;
      if (BILLED.includes(g.status)) invoiced += total;
      if (OPEN.includes(g.status)) outstanding += total - paid;
    }

    // Bucket payments into the last 6 calendar months.
    const buckets: { key: string; month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], amount: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const p of recentPayments) {
      const d = new Date(p.paymentDate);
      const b = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (b) b.amount += p.amount;
    }

    return {
      currency: 'INR',
      totals: {
        collected: Math.round(collected * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        invoiced: Math.round(invoiced * 100) / 100,
      },
      counts: { invoices: invoiceCount, quotations, proposals, offerLetters, clients, invoicesByStatus },
      monthlyRevenue: buckets.map((b) => ({ month: b.month, amount: Math.round(b.amount * 100) / 100 })),
      recentInvoices: recent.map((r) => ({
        id: r.id, number: r.number, status: r.status,
        grandTotal: r.grandTotal, amountPaid: r.amountPaid, currency: r.currency,
        issueDate: r.issueDate, clientName: (r.clientSnapshot as { name?: string } | null)?.name ?? null,
      })),
    };
  }
}
