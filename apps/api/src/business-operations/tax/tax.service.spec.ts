import { TaxService } from './tax.service';
import { PrismaService } from '../../prisma/prisma.service';

function fakePrisma(row: any = null) {
  const store = new Map<string, any>();
  if (row) store.set(row.orgId, row);
  return {
    _store: store,
    taxConfig: {
      findUnique: async ({ where }: any) => store.get(where.orgId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = store.get(where.orgId);
        const next = existing ? { ...existing, ...update } : { ...create };
        store.set(where.orgId, next);
        return next;
      },
    },
  };
}

function service(prisma = fakePrisma()) {
  return { svc: new TaxService(prisma as unknown as PrismaService), prisma };
}

describe('TaxService', () => {
  it('returns default config when none is stored', async () => {
    const { svc } = service();
    const cfg = await svc.getConfig('org1');
    expect(cfg).toMatchObject({ regime: 'IN_GST', defaultGstRate: 18, priceMode: 'EXCLUSIVE', roundingMode: 'NEAREST' });
  });

  it('upserts config', async () => {
    const { svc } = service();
    const cfg = await svc.updateConfig('org1', { defaultGstRate: 12, roundingMode: 'NONE' });
    expect(cfg).toMatchObject({ defaultGstRate: 12, roundingMode: 'NONE' });
  });

  it('applies the org default GST when a line omits taxes', async () => {
    const { svc } = service();
    const summary = await svc.calculate('org1', {
      items: [{ quantity: 1, price: 100 }],
      companyState: 'KA',
      customerState: 'KA',
    });
    // default 18% GST, intra-state → CGST 9 + SGST 9
    expect(summary.taxTotal).toBe(18);
    expect(summary.grandTotal).toBe(118);
  });

  it('respects an explicit exempt line even with a default rate', async () => {
    const { svc } = service();
    const summary = await svc.calculate('org1', { items: [{ quantity: 1, price: 100, exempt: true }] });
    expect(summary.taxTotal).toBe(0);
  });
});
