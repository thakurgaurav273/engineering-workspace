import { OfferLettersService } from './offer-letters.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { DocumentNumberingService } from '../document-numbering/document-numbering.service';

function fakePrisma() {
  const rows = new Map<string, any>();
  const seqStore = new Map<string, any>();
  let seq = 0;
  let lock: Promise<unknown> = Promise.resolve();
  const seqKey = (w: any) => `${w.orgId_documentType.orgId}|${w.orgId_documentType.documentType}`;
  const client: any = {
    offerLetter: {
      create: async ({ data }: any) => { const id = `o${++seq}`; const row = { id, ...data }; rows.set(id, row); return row; },
      findFirst: async ({ where }: any) => [...rows.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        [...rows.values()].filter((r) => r.orgId === where.orgId && (!where.status || r.status === where.status)).slice(skip, skip + take),
      count: async ({ where }: any) => [...rows.values()].filter((r) => r.orgId === where.orgId).length,
      update: async ({ where, data }: any) => { Object.assign(rows.get(where.id), data); return rows.get(where.id); },
      delete: async ({ where }: any) => { rows.delete(where.id); return {}; },
    },
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
  const company = { getForOrg: async () => ({ legalName: 'Grovyn', state: 'KA' }) } as unknown as CompanyService;
  const numbering = new DocumentNumberingService(prisma as unknown as PrismaService);
  const svc = new OfferLettersService(prisma as unknown as PrismaService, company, numbering);
  return { svc };
}

const base = (over: object = {}) => ({ candidateName: 'Asha', candidateEmail: 'asha@x.com', position: 'Engineer', baseSalary: 1200000, ...over });

describe('OfferLettersService (HR document)', () => {
  it('creates a DRAFT with a company snapshot and no number', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    expect(o.status).toBe('DRAFT');
    expect(o.number).toBeFalsy();
    expect(o.companySnapshot).toMatchObject({ legalName: 'Grovyn' });
  });

  it('edits a draft', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    const updated = await svc.update(o.id, 'org1', { position: 'Senior Engineer' });
    expect(updated.position).toBe('Senior Engineer');
  });

  it('send reserves an OFFER_LETTER number and locks', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    const sent = await svc.send(o.id, 'org1');
    expect(sent.status).toBe('SENT');
    expect(sent.number).toMatch(/^OFF-\d{4}-000001$/);
    expect(sent.sentAt).toBeTruthy();
    await expect(svc.update(o.id, 'org1', { position: 'x' })).rejects.toThrow();
  });

  it('accept / reject only from SENT and stamp the date', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    await expect(svc.accept(o.id, 'org1')).rejects.toThrow(); // still DRAFT
    await svc.send(o.id, 'org1');
    const accepted = await svc.accept(o.id, 'org1');
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.acceptedAt).toBeTruthy();
  });

  it('duplicate creates a fresh DRAFT copy with no number', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    await svc.send(o.id, 'org1');
    const copy = await svc.duplicate(o.id, 'org1');
    expect(copy.status).toBe('DRAFT');
    expect(copy.number).toBeFalsy();
    expect(copy.candidateName).toBe('Asha');
  });

  it('deletes only a draft', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    await svc.send(o.id, 'org1');
    await expect(svc.remove(o.id, 'org1')).rejects.toThrow();
  });

  it('parallel sends never duplicate numbers', async () => {
    const { svc } = make();
    const drafts = await Promise.all(Array.from({ length: 15 }, () => svc.create('org1', base())));
    const sent = await Promise.all(drafts.map((d) => svc.send(d.id, 'org1')));
    expect(new Set(sent.map((s) => s.number)).size).toBe(15);
  });

  it('does not leak across orgs', async () => {
    const { svc } = make();
    const o = await svc.create('org1', base());
    await expect(svc.findOne(o.id, 'org2')).rejects.toThrow();
  });
});
