import { CompanyService } from './company.service';
import { PrismaService } from '../../prisma/prisma.service';

function fakePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    _rows: rows,
    companyProfile: {
      findUnique: async ({ where }: { where: { orgId: string } }) => rows.get(where.orgId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = rows.get(where.orgId);
        const row = existing ? { ...existing, ...update } : { id: 'c1', ...create };
        rows.set(where.orgId, row);
        return row;
      },
    },
  };
}

function service(prisma = fakePrisma()) {
  return { svc: new CompanyService(prisma as unknown as PrismaService), prisma };
}

describe('CompanyService', () => {
  it('returns null when no profile exists yet (empty state)', async () => {
    const { svc } = service();
    expect(await svc.getForOrg('org1')).toBeNull();
  });

  it('creates a profile on first upsert', async () => {
    const { svc } = service();
    const row = await svc.upsert('org1', { legalName: 'Grovyn Pvt Ltd' });
    expect(row).toMatchObject({ orgId: 'org1', legalName: 'Grovyn Pvt Ltd' });
    expect(await svc.getForOrg('org1')).toMatchObject({ legalName: 'Grovyn Pvt Ltd' });
  });

  it('updates an existing profile and preserves prior fields', async () => {
    const { svc } = service();
    await svc.upsert('org1', { legalName: 'Grovyn', gstin: '29ABCDE1234F1Z5' });
    const updated = await svc.upsert('org1', { legalName: 'Grovyn Systems' });
    expect(updated).toMatchObject({ legalName: 'Grovyn Systems', gstin: '29ABCDE1234F1Z5' });
  });

  it('scopes profiles per organization', async () => {
    const { svc } = service();
    await svc.upsert('org1', { legalName: 'Org One' });
    await svc.upsert('org2', { legalName: 'Org Two' });
    expect(await svc.getForOrg('org1')).toMatchObject({ legalName: 'Org One' });
    expect(await svc.getForOrg('org2')).toMatchObject({ legalName: 'Org Two' });
  });
});
