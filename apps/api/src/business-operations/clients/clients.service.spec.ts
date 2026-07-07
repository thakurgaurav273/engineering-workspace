import { ClientsService } from './clients.service';
import { PrismaService } from '../../prisma/prisma.service';

function fakePrisma() {
  const rows = new Map<string, any>();
  let seq = 0;
  const match = (r: any, where: any) => {
    if (where.orgId && r.orgId !== where.orgId) return false;
    if (where.archivedAt === null && r.archivedAt !== null) return false;
    if (where.archivedAt?.not === null && r.archivedAt === null) return false;
    if (where.type && r.type !== where.type) return false;
    if (where.isActive !== undefined && r.isActive !== where.isActive) return false;
    if (where.OR) {
      const s = where.OR[0].name.contains.toLowerCase();
      const hay = `${r.name} ${r.companyName ?? ''} ${r.email ?? ''} ${r.contactPersonName ?? ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  };
  return {
    _rows: rows,
    client: {
      create: async ({ data }: any) => {
        const row = { id: `c${++seq}`, archivedAt: null, isActive: true, ...data };
        rows.set(row.id, row);
        return row;
      },
      findFirst: async ({ where }: any) => [...rows.values()].find((r) => r.id === where.id && r.orgId === where.orgId) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        [...rows.values()].filter((r) => match(r, where)).slice(skip, skip + take),
      count: async ({ where }: any) => [...rows.values()].filter((r) => match(r, where)).length,
      update: async ({ where, data }: any) => {
        const row = rows.get(where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

function service(prisma = fakePrisma()) {
  return { svc: new ClientsService(prisma as unknown as PrismaService), prisma };
}

describe('ClientsService', () => {
  it('creates a client scoped to the org', async () => {
    const { svc } = service();
    const c = await svc.create('org1', { name: 'Acme' });
    expect(c).toMatchObject({ orgId: 'org1', name: 'Acme' });
  });

  it('lists active clients (excludes archived) with pagination meta', async () => {
    const { svc } = service();
    await svc.create('org1', { name: 'Acme' });
    const archived = await svc.create('org1', { name: 'Old Co' });
    await svc.archive(archived.id, 'org1');
    const res = await svc.list('org1', {});
    expect(res.data.map((c) => c.name)).toEqual(['Acme']);
    expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('lists archived clients when requested', async () => {
    const { svc } = service();
    const c = await svc.create('org1', { name: 'Old Co' });
    await svc.archive(c.id, 'org1');
    const res = await svc.list('org1', { archived: 'true' });
    expect(res.data.map((c) => c.name)).toEqual(['Old Co']);
  });

  it('searches by name/email/company', async () => {
    const { svc } = service();
    await svc.create('org1', { name: 'Acme', email: 'a@acme.io' });
    await svc.create('org1', { name: 'Globex' });
    expect((await svc.list('org1', { search: 'acme' })).data.map((c) => c.name)).toEqual(['Acme']);
  });

  it('archives (soft delete) and restores', async () => {
    const { svc } = service();
    const c = await svc.create('org1', { name: 'Acme' });
    const archived = await svc.archive(c.id, 'org1');
    expect(archived.archivedAt).toBeInstanceOf(Date);
    const restored = await svc.restore(c.id, 'org1');
    expect(restored.archivedAt).toBeNull();
  });

  it('does not leak clients across orgs', async () => {
    const { svc } = service();
    const c = await svc.create('org1', { name: 'Acme' });
    await expect(svc.findOne(c.id, 'org2')).rejects.toThrow();
  });
});
