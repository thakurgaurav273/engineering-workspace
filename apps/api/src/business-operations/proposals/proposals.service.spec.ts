import { ProposalsService } from './proposals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyService } from '../company/company.service';
import { ClientsService } from '../clients/clients.service';
import { MailService } from '../../platform/mail/mail.service';
import { DocumentRenderService } from '../document-templates/document-render.service';
import { renderTemplate } from '../document-templates/template-engine';
import { builtInStarter } from '../document-templates/starter-templates';

function fakePrisma() {
  const rows = new Map<string, any>();
  let seq = 0;
  const client: any = {
    proposal: {
      create: async ({ data, include }: any) => {
        const id = `p${++seq}`;
        const sections = (data.sections?.create ?? []).map((s: any) => ({ id: `ps${++seq}`, proposalId: id, ...s }));
        const { sections: _s, ...rest } = data;
        const row = { id, ...rest, sections };
        rows.set(id, row);
        return include?.sections ? row : { ...row, sections: undefined };
      },
      findFirst: async ({ where }: any) => [...rows.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        [...rows.values()].filter((r) => r.orgId === where.orgId && (!where.status || r.status === where.status)).slice(skip, skip + take),
      count: async ({ where }: any) => [...rows.values()].filter((r) => r.orgId === where.orgId).length,
      update: async ({ where, data }: any) => {
        const row = rows.get(where.id);
        if (data.sections) {
          row.sections = (data.sections.create ?? []).map((s: any) => ({ id: `ps${++seq}`, proposalId: row.id, ...s }));
          const { sections, ...rest } = data;
          Object.assign(row, rest);
        } else Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => { rows.delete(where.id); return {}; },
    },
  };
  return client;
}

function make() {
  const prisma = fakePrisma();
  const company = { getForOrg: async () => ({ state: 'KA', legalName: 'Grovyn' }) } as unknown as CompanyService;
  const clients = {
    findOne: async (id: string, orgId: string) => ({ id, orgId, name: 'Acme', companyName: null, email: 'client@acme.test', billingState: 'KA', billingCountry: 'India' }),
  } as unknown as ClientsService;
  const mail = { sendDocumentEmail: async () => {} } as unknown as MailService;
  const pdf = {
    // Renders the real built-in layout, so assertions see actual document text.
    html: jest.fn(async (type: never, _m: unknown, _o: unknown, _d: unknown, data: Record<string, unknown>) =>
      renderTemplate(builtInStarter(type).html, data),
    ),
    toPdf: jest.fn(async () => Buffer.from('')),
    pickTemplate: jest.fn(async (_o: unknown, _t: unknown, id?: string | null) => (id === undefined ? undefined : id || null)),
  } as unknown as DocumentRenderService;
  const svc = new ProposalsService(prisma as unknown as PrismaService, company, clients, mail, pdf);
  return { svc };
}

const base = (over: object = {}) => ({ clientId: 'c1', title: 'Website revamp', sections: [{ title: 'Scope', content: '<p>Design</p>' }], ...over });

describe('ProposalsService (orchestration, non-financial)', () => {
  it('creates a DRAFT with client + company snapshots and ordered sections', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base({ sections: [{ title: 'B', content: '2' }, { title: 'A', content: '1' }] }));
    expect(p.status).toBe('DRAFT');
    expect(p.clientSnapshot).toMatchObject({ name: 'Acme' });
    expect(p.companySnapshot).toMatchObject({ state: 'KA' });
    expect(p.sections.map((s: any) => [s.title, s.sortOrder])).toEqual([['B', 0], ['A', 1]]);
  });

  it('edits a draft and replaces sections (add / delete / reorder in one PATCH)', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    const updated = await svc.update(p.id, 'org1', { title: 'Renamed', sections: [{ title: 'One' }, { title: 'Two' }] });
    expect(updated.title).toBe('Renamed');
    expect(updated.sections.map((s: any) => s.title)).toEqual(['One', 'Two']);
  });

  it('send moves DRAFT -> SENT and stamps sentAt', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    const sent = await svc.send(p.id, 'org1');
    expect(sent.status).toBe('SENT');
    expect(sent.sentAt).toBeTruthy();
  });

  it('is read-only after send (no edit, no delete)', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    await svc.send(p.id, 'org1');
    await expect(svc.update(p.id, 'org1', { title: 'x' })).rejects.toThrow();
    await expect(svc.remove(p.id, 'org1')).rejects.toThrow();
  });

  it('duplicate creates a fresh DRAFT copy', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    await svc.send(p.id, 'org1');
    const copy = await svc.duplicate(p.id, 'org1');
    expect(copy.status).toBe('DRAFT');
    expect(copy.title).toBe('Website revamp (copy)');
    expect(copy.sections.map((s: any) => s.title)).toEqual(['Scope']);
  });

  it('archive works and blocks double-archive', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    await svc.send(p.id, 'org1');
    expect((await svc.archive(p.id, 'org1')).status).toBe('ARCHIVED');
    await expect(svc.archive(p.id, 'org1')).rejects.toThrow();
  });

  it('deletes a draft', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    expect(await svc.remove(p.id, 'org1')).toEqual({ deleted: true });
    await expect(svc.findOne(p.id, 'org1')).rejects.toThrow();
  });

  it('does not leak across orgs', async () => {
    const { svc } = make();
    const p = await svc.create('org1', base());
    await expect(svc.findOne(p.id, 'org2')).rejects.toThrow();
  });
});
