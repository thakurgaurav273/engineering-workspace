import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

function fakePrisma(over: Partial<Record<string, any>> = {}) {
  const client: any = {
    invoice: {
      groupBy: async () => [
        { status: 'PAID', _count: { _all: 2 }, _sum: { grandTotal: 200, amountPaid: 200 } },
        { status: 'PARTIALLY_PAID', _count: { _all: 1 }, _sum: { grandTotal: 100, amountPaid: 40 } },
        { status: 'DRAFT', _count: { _all: 3 }, _sum: { grandTotal: 999, amountPaid: 0 } },
      ],
      findMany: async () => [
        { id: 'i1', number: 'INV-1', status: 'PAID', grandTotal: 100, amountPaid: 100, currency: 'INR', issueDate: new Date('2026-01-01'), clientSnapshot: { name: 'Acme' } },
      ],
    },
    quotation: { count: async () => 4 },
    proposal: { count: async () => 5 },
    offerLetter: { count: async () => 6 },
    client: { count: async () => 7 },
    payment: { findMany: async () => [{ amount: 40, paymentDate: new Date() }] },
    ...over,
  };
  return client as unknown as PrismaService;
}

describe('DashboardService (analytics)', () => {
  it('aggregates totals, counts and a 6-month revenue series', async () => {
    const svc = new DashboardService(fakePrisma());
    const s = await svc.summary('org1');

    // collected = 200 + 40 (DRAFT amountPaid 0 counted but is 0)
    expect(s.totals.collected).toBe(240);
    // invoiced excludes DRAFT: 200 (PAID) + 100 (PARTIALLY_PAID)
    expect(s.totals.invoiced).toBe(300);
    // outstanding only from OPEN (PARTIALLY_PAID): 100 - 40
    expect(s.totals.outstanding).toBe(60);

    expect(s.counts.invoices).toBe(6);
    expect(s.counts.quotations).toBe(4);
    expect(s.counts.proposals).toBe(5);
    expect(s.counts.offerLetters).toBe(6);
    expect(s.counts.clients).toBe(7);
    expect(s.counts.invoicesByStatus.DRAFT).toBe(3);

    expect(s.monthlyRevenue).toHaveLength(6);
    // this month's payment lands in the last bucket
    expect(s.monthlyRevenue[5].amount).toBe(40);

    expect(s.recentInvoices[0]).toMatchObject({ number: 'INV-1', clientName: 'Acme' });
  });

  it('handles an empty org gracefully', async () => {
    const svc = new DashboardService(fakePrisma({
      invoice: { groupBy: async () => [], findMany: async () => [] },
      quotation: { count: async () => 0 }, proposal: { count: async () => 0 },
      offerLetter: { count: async () => 0 }, client: { count: async () => 0 },
      payment: { findMany: async () => [] },
    }));
    const s = await svc.summary('org1');
    expect(s.totals).toEqual({ collected: 0, outstanding: 0, invoiced: 0 });
    expect(s.counts.invoices).toBe(0);
    expect(s.monthlyRevenue.every((m) => m.amount === 0)).toBe(true);
  });
});
