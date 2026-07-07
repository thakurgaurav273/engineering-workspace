import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';

function fakePrisma() {
  const invoices = new Map<string, any>();
  const payments = new Map<string, any>();
  let seq = 0;
  const client: any = {
    invoice: {
      findFirst: async ({ where }: any) =>
        [...invoices.values()].find((r) => r.id === where.id && (where.orgId === undefined || r.orgId === where.orgId)) ?? null,
      findUniqueOrThrow: async ({ where }: any) => {
        const r = invoices.get(where.id);
        if (!r) throw new Error('not found');
        return r;
      },
      update: async ({ where, data }: any) => { Object.assign(invoices.get(where.id), data); return invoices.get(where.id); },
    },
    payment: {
      create: async ({ data }: any) => { const id = `pay${++seq}`; const row = { id, ...data }; payments.set(id, row); return row; },
      findFirst: async ({ where }: any) => [...payments.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where }: any) => [...payments.values()].filter((r) => r.orgId === where.orgId),
      count: async ({ where }: any) => [...payments.values()].filter((r) => r.orgId === where.orgId).length,
      delete: async ({ where }: any) => { payments.delete(where.id); return {}; },
      aggregate: async ({ where }: any) => ({
        _sum: { amount: [...payments.values()].filter((r) => r.invoiceId === where.invoiceId).reduce((s, r) => s + r.amount, 0) },
      }),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { client, invoices };
}

function make(invoice: object = {}) {
  const { client, invoices } = fakePrisma();
  invoices.set('inv1', { id: 'inv1', orgId: 'org1', status: 'ISSUED', grandTotal: 100, amountPaid: 0, ...invoice });
  const svc = new PaymentsService(client as unknown as PrismaService);
  return { svc, invoices };
}

const pay = (over: object = {}) => ({ invoiceId: 'inv1', amount: 40, paymentDate: '2026-01-01', ...over });

describe('PaymentsService (invoice sync)', () => {
  it('records a partial payment → PARTIALLY_PAID with amountPaid', async () => {
    const { svc, invoices } = make();
    await svc.create('org1', pay({ amount: 40 }));
    expect(invoices.get('inv1').amountPaid).toBe(40);
    expect(invoices.get('inv1').status).toBe('PARTIALLY_PAID');
  });

  it('marks PAID once the total is met (across multiple payments)', async () => {
    const { svc, invoices } = make();
    await svc.create('org1', pay({ amount: 60 }));
    await svc.create('org1', pay({ amount: 40 }));
    expect(invoices.get('inv1').amountPaid).toBe(100);
    expect(invoices.get('inv1').status).toBe('PAID');
  });

  it('rejects an overpayment beyond the balance due', async () => {
    const { svc } = make();
    await expect(svc.create('org1', pay({ amount: 150 }))).rejects.toThrow();
  });

  it('rejects a payment on a fully-paid invoice', async () => {
    const { svc } = make({ status: 'PAID', amountPaid: 100 });
    await expect(svc.create('org1', pay({ amount: 10 }))).rejects.toThrow();
  });

  it('deleting a payment never resurrects a cancelled invoice', async () => {
    const { svc, invoices } = make();
    const p = await svc.create('org1', pay({ amount: 40 })); // PARTIALLY_PAID
    invoices.get('inv1').status = 'CANCELLED'; // invoice later cancelled
    await svc.remove(p.id, 'org1');
    expect(invoices.get('inv1').status).toBe('CANCELLED');
    expect(invoices.get('inv1').amountPaid).toBe(0);
  });

  it('deleting a payment recomputes and can revert PAID → PARTIALLY_PAID', async () => {
    const { svc, invoices } = make();
    const p1 = await svc.create('org1', pay({ amount: 60 }));
    await svc.create('org1', pay({ amount: 40 }));
    expect(invoices.get('inv1').status).toBe('PAID');
    await svc.remove(p1.id, 'org1');
    expect(invoices.get('inv1').amountPaid).toBe(40);
    expect(invoices.get('inv1').status).toBe('PARTIALLY_PAID');
  });

  it('removing the last payment reverts to ISSUED', async () => {
    const { svc, invoices } = make();
    const p = await svc.create('org1', pay({ amount: 40 }));
    await svc.remove(p.id, 'org1');
    expect(invoices.get('inv1').amountPaid).toBe(0);
    expect(invoices.get('inv1').status).toBe('ISSUED');
  });

  it('rejects payment on a DRAFT invoice', async () => {
    const { svc } = make({ status: 'DRAFT' });
    await expect(svc.create('org1', pay())).rejects.toThrow();
  });

  it('rejects payment on a CANCELLED invoice', async () => {
    const { svc } = make({ status: 'CANCELLED' });
    await expect(svc.create('org1', pay())).rejects.toThrow();
  });

  it('does not leak across orgs', async () => {
    const { svc } = make();
    await expect(svc.create('org2', pay())).rejects.toThrow();
  });
});
