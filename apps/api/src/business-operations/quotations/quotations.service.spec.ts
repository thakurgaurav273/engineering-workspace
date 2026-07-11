import { QuotationsService } from './quotations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';
import { TaxService } from '../tax/tax.service';
import { MailService } from '../../platform/mail/mail.service';
import { PdfService } from '../../platform/pdf/pdf.service';

function fakePrisma() {
  const rows = new Map<string, any>();
  const seqStore = new Map<string, any>();
  let seq = 0;
  let lock: Promise<unknown> = Promise.resolve();
  const seqKey = (w: any) => `${w.orgId_documentType.orgId}|${w.orgId_documentType.documentType}`;
  const client: any = {
    quotation: {
      create: async ({ data, include }: any) => {
        const id = `q${++seq}`;
        const lines = (data.lines?.create ?? []).map((l: any) => ({ id: `ql${++seq}`, quotationId: id, ...l }));
        const sections = (data.sections?.create ?? []).map((s: any, i: number) => ({ id: `qs${++seq}`, quotationId: id, sortOrder: i, ...s }));
        const { lines: _l, sections: _s, ...rest } = data;
        const row = { id, ...rest, lines, sections };
        rows.set(id, row);
        return include?.lines ? row : { ...row, lines: undefined };
      },
      findFirst: async ({ where }: any) => [...rows.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        [...rows.values()].filter((r) => r.orgId === where.orgId && (!where.status || r.status === where.status)).slice(skip, skip + take),
      count: async ({ where }: any) => [...rows.values()].filter((r) => r.orgId === where.orgId).length,
      update: async ({ where, data }: any) => {
        const row = rows.get(where.id);
        if (data.lines) row.lines = (data.lines.create ?? []).map((l: any) => ({ id: `ql${++seq}`, quotationId: row.id, ...l }));
        if (data.sections) row.sections = (data.sections.create ?? []).map((s: any, i: number) => ({ id: `qs${++seq}`, quotationId: row.id, sortOrder: i, ...s }));
        const { lines: _l, sections: _s, ...rest } = data;
        Object.assign(row, rest);
        return row;
      },
      delete: async ({ where }: any) => { rows.delete(where.id); return {}; },
    },
    taxConfig: { findUnique: async () => null, upsert: async ({ create }: any) => create },
    documentNumberSequence: {
      upsert: async ({ where, create }: any) => { const k = seqKey(where); if (!seqStore.has(k)) seqStore.set(k, { ...create }); return seqStore.get(k); },
      findUnique: async ({ where }: any) => seqStore.get(seqKey(where)) ?? null,
      update: async ({ where, data }: any) => { Object.assign(seqStore.get(seqKey(where)), data); return seqStore.get(seqKey(where)); },
    },
    $queryRaw: async (_s: TemplateStringsArray, orgId: string, type: string) => { const r = seqStore.get(`${orgId}|${type}`); return r ? [r] : []; },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => { const run = lock.then(() => fn(client)); lock = run.then(() => undefined, () => undefined); return run; },
  };
  return client;
}

function make() {
  const prisma = fakePrisma();
  const company = { getForOrg: async () => ({ state: 'KA', legalName: 'Grovyn' }) } as unknown as CompanyService;
  const clients = {
    findOne: async (id: string, orgId: string) => ({ id, orgId, name: 'Acme', companyName: null, email: null, gstin: 'x', billingState: 'KA', billingCountry: 'India' }),
  } as unknown as ClientsService;
  const tax = new TaxService(prisma as unknown as PrismaService);
  const numbering = new DocumentNumberingService(prisma as unknown as PrismaService);
  const mail = { sendDocumentEmail: async () => {} } as unknown as MailService;
  const pdf = { fromHtml: async () => Buffer.from('') } as unknown as PdfService;
  const svc = new QuotationsService(prisma as unknown as PrismaService, company, clients, numbering, tax, mail, pdf);
  return { svc, tax };
}

const line = (over: object = {}) => ({ description: 'Service', quantity: 1, unitPrice: 100, taxes: [{ type: 'GST' as const, rate: 18 }], ...over });

describe('QuotationsService (orchestration)', () => {
  it('creates a DRAFT with totals from the Tax Engine', async () => {
    const { svc, tax } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    expect(q.status).toBe('DRAFT');
    expect(q.number).toBeFalsy();
    const expected = await tax.calculate('org1', { items: [{ quantity: 1, price: 100, taxes: [{ type: 'GST', rate: 18 }] }], companyState: 'KA', customerState: 'KA', customerCountry: 'India' });
    expect(q.grandTotal).toBe(expected.grandTotal);
    expect(q.grandTotal).toBe(118);
  });

  it('edits a draft and recomputes', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    const updated = await svc.update(q.id, 'org1', { lines: [line({ quantity: 2 })] });
    expect(updated.grandTotal).toBe(236);
  });

  it('issue reserves a QUOTATION number and locks', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    const issued = await svc.issue(q.id, 'org1');
    expect(issued.status).toBe('ISSUED');
    expect(issued.number).toMatch(/^QTN-\d{4}-000001$/);
  });

  it('cannot edit or delete after issue', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await svc.issue(q.id, 'org1');
    await expect(svc.update(q.id, 'org1', { lines: [line()] })).rejects.toThrow();
    await expect(svc.remove(q.id, 'org1')).rejects.toThrow();
  });

  it('duplicate creates a fresh DRAFT with no number', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await svc.issue(q.id, 'org1');
    const copy = await svc.duplicate(q.id, 'org1');
    expect(copy.status).toBe('DRAFT');
    expect(copy.number).toBeFalsy();
    expect(copy.grandTotal).toBe(118);
  });

  it('cancel works on issued, not on draft', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await expect(svc.cancel(q.id, 'org1')).rejects.toThrow();
    await svc.issue(q.id, 'org1');
    expect((await svc.cancel(q.id, 'org1')).status).toBe('CANCELLED');
  });

  it('deletes a draft', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    expect(await svc.remove(q.id, 'org1')).toEqual({ deleted: true });
    await expect(svc.findOne(q.id, 'org1')).rejects.toThrow();
  });

  it('does not leak across orgs', async () => {
    const { svc } = make();
    const q = await svc.create('org1', { clientId: 'c1', lines: [line()] });
    await expect(svc.findOne(q.id, 'org2')).rejects.toThrow();
  });

  it('CONCURRENCY: parallel issues never duplicate numbers', async () => {
    const { svc } = make();
    const drafts = await Promise.all(Array.from({ length: 20 }, () => svc.create('org1', { clientId: 'c1', lines: [line()] })));
    const issued = await Promise.all(drafts.map((d) => svc.issue(d.id, 'org1')));
    expect(new Set(issued.map((i) => i.number)).size).toBe(20);
  });
});
