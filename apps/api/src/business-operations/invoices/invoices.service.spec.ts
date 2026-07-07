import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { TaxService } from '../tax/tax.service';

/** Fake Prisma covering invoices (+ nested lines), the numbering sequence, and tax config. */
function fakePrisma() {
  const invoices = new Map<string, any>();
  const seqStore = new Map<string, any>();
  let seq = 0;
  let lock: Promise<unknown> = Promise.resolve();
  const seqKey = (w: any) => `${w.orgId_documentType.orgId}|${w.orgId_documentType.documentType}`;

  const client: any = {
    _invoices: invoices,
    invoice: {
      create: async ({ data, include }: any) => {
        const id = `inv${++seq}`;
        const lines = (data.lines?.create ?? []).map((l: any) => ({ id: `ln${++seq}`, invoiceId: id, ...l }));
        const { lines: _l, ...rest } = data;
        const row = { id, ...rest, lines };
        invoices.set(id, row);
        return include?.lines ? row : { ...row, lines: undefined };
      },
      findFirst: async ({ where }: any) =>
        [...invoices.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        [...invoices.values()]
          .filter((r) => r.orgId === where.orgId && (!where.status || r.status === where.status))
          .slice(skip, skip + take),
      count: async ({ where }: any) => [...invoices.values()].filter((r) => r.orgId === where.orgId).length,
      update: async ({ where, data }: any) => {
        const row = invoices.get(where.id);
        if (data.lines) {
          row.lines = (data.lines.create ?? []).map((l: any) => ({ id: `ln${++seq}`, invoiceId: row.id, ...l }));
          const { lines, ...rest } = data;
          Object.assign(row, rest);
        } else Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        invoices.delete(where.id);
        return {};
      },
    },
    taxConfig: { findUnique: async () => null, upsert: async ({ create }: any) => create },
    documentNumberSequence: {
      upsert: async ({ where, create }: any) => {
        const k = seqKey(where);
        if (!seqStore.has(k)) seqStore.set(k, { ...create });
        return seqStore.get(k);
      },
      findUnique: async ({ where }: any) => seqStore.get(seqKey(where)) ?? null,
      update: async ({ where, data }: any) => {
        Object.assign(seqStore.get(seqKey(where)), data);
        return seqStore.get(seqKey(where));
      },
    },
    $queryRaw: async (_s: TemplateStringsArray, orgId: string, type: string) => {
      const r = seqStore.get(`${orgId}|${type}`);
      return r ? [r] : [];
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const run = lock.then(() => fn(client));
      lock = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  return client;
}

function make() {
  const prisma = fakePrisma();
  const company = { getForOrg: async () => ({ state: 'KA', legalName: 'Grovyn' }) } as unknown as CompanyService;
  const clients = {
    findOne: async (id: string, orgId: string) => ({
      id, orgId, name: 'Acme', companyName: null, email: null,
      gstin: '29ABCDE1234F1Z5', billingState: 'KA', billingCountry: 'India',
    }),
  } as unknown as ClientsService;
  const tax = new TaxService(prisma as unknown as PrismaService);
  const numbering = new DocumentNumberingService(prisma as unknown as PrismaService);
  const svc = new InvoicesService(prisma as unknown as PrismaService, company, clients, numbering, tax);
  return { svc, tax };
}

const line = (over: object = {}) => ({ description: 'Service', quantity: 1, unitPrice: 100, taxes: [{ type: 'GST' as const, rate: 18 }], ...over });

describe('InvoicesService (orchestration)', () => {
  it('creates a DRAFT with totals from the Tax Engine (no manual calc)', async () => {
    const { svc, tax } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    expect(inv.status).toBe('DRAFT');
    expect(inv.number).toBeFalsy();

    // Totals must equal the Tax Engine output exactly (same-state → CGST+SGST).
    const expected = await tax.calculate('org1', {
      items: [{ description: 'Service', quantity: 1, price: 100, taxes: [{ type: 'GST', rate: 18 }] }],
      companyState: 'KA', customerState: 'KA', customerCountry: 'India',
    });
    expect(inv.grandTotal).toBe(expected.grandTotal);
    expect(inv.taxTotal).toBe(expected.taxTotal);
    expect(inv.grandTotal).toBe(118);
    expect(inv.lines[0].lineTax).toBe(18);
  });

  it('edits a draft and recomputes totals', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    const updated = await svc.update(inv.id, 'org1', { lines: [line({ quantity: 2 })] });
    expect(updated.grandTotal).toBe(236); // 200 + 36
  });

  it('issue reserves the number via DocumentNumberingService and locks', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    const issued = await svc.issue(inv.id, 'org1');
    expect(issued.status).toBe('ISSUED');
    expect(issued.number).toMatch(/^INV-\d{4}-000001$/);
    expect(issued.issuedAt).toBeInstanceOf(Date);
  });

  it('cannot edit or delete after issue', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await svc.issue(inv.id, 'org1');
    await expect(svc.update(inv.id, 'org1', { lines: [line()] })).rejects.toThrow();
    await expect(svc.remove(inv.id, 'org1')).rejects.toThrow();
  });

  it('duplicate creates a fresh DRAFT with no number', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await svc.issue(inv.id, 'org1');
    const copy = await svc.duplicate(inv.id, 'org1');
    expect(copy.status).toBe('DRAFT');
    expect(copy.number).toBeFalsy();
    expect(copy.grandTotal).toBe(118);
  });

  it('cancel works on issued, not on draft', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await expect(svc.cancel(inv.id, 'org1')).rejects.toThrow(); // draft
    await svc.issue(inv.id, 'org1');
    const cancelled = await svc.cancel(inv.id, 'org1');
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('deletes a draft', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    expect(await svc.remove(inv.id, 'org1')).toEqual({ deleted: true });
    await expect(svc.findOne(inv.id, 'org1')).rejects.toThrow();
  });

  it('does not leak invoices across orgs', async () => {
    const { svc } = make();
    const inv = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await expect(svc.findOne(inv.id, 'org2')).rejects.toThrow();
  });

  it('CONCURRENCY: parallel issues never duplicate invoice numbers', async () => {
    const { svc } = make();
    const drafts = await Promise.all(
      Array.from({ length: 25 }, () => svc.create('org1', { clientId: 'c1', lines: [line()] })),
    );
    const issued = await Promise.all(drafts.map((d) => svc.issue(d.id, 'org1')));
    const numbers = issued.map((i) => i.number);
    expect(new Set(numbers).size).toBe(25); // all unique
  });
});
