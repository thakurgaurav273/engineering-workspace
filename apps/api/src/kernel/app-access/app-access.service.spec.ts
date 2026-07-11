import { AppAccessService } from './app-access.service';
import { InstallationService } from '../installation/installation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationManifest } from '../registry/application-manifest';

const ENG = { key: 'engineering', name: 'Engineering', requiresSuperAdmin: false, showInLauncher: true, status: 'ACTIVE' };
const BIZ = { key: 'business-operations', name: 'Business Operations', requiresSuperAdmin: false, showInLauncher: true, status: 'EXPERIMENTAL' };
const ADMIN = { key: 'platform-admin', name: 'Platform Administration', requiresSuperAdmin: true, showInLauncher: true, status: 'ACTIVE' };
const CORE = { key: 'core', name: 'Settings', requiresSuperAdmin: false, showInLauncher: false, status: 'ACTIVE' };
const ALL = [ENG, BIZ, ADMIN, CORE] as unknown as ApplicationManifest[];

// Real installable predicate: not platform-owned and shown in the launcher.
const installation = {
  isInstallable: (m: ApplicationManifest) =>
    !(m as any).requiresSuperAdmin && (m as any).showInLauncher !== false,
} as unknown as InstallationService;

function fakePrisma(grants: Array<{ orgId: string; userId: string; applicationKey: string }>) {
  return {
    userApplicationAccess: {
      findMany: async ({ where }: any) =>
        grants.filter((g) => g.orgId === where.orgId && g.userId === where.userId),
    },
  } as unknown as PrismaService;
}

function keys(list: ApplicationManifest[]): string[] {
  return list.map((m) => m.key);
}

describe('AppAccessService.filterByUserAccess', () => {
  it('lets a SUPER_ADMIN see every application, ignoring grants', async () => {
    const svc = new AppAccessService(fakePrisma([]), installation);
    const out = await svc.filterByUserAccess(ALL, { orgId: 'o1', userId: 'u1', isSuperAdmin: true });
    expect(keys(out)).toEqual(['engineering', 'business-operations', 'platform-admin', 'core']);
  });

  it('denies installable apps by default — a member with no grants sees only non-installable apps', async () => {
    const svc = new AppAccessService(fakePrisma([]), installation);
    const out = await svc.filterByUserAccess(ALL, { orgId: 'o1', userId: 'u1', isSuperAdmin: false });
    // engineering + business-operations are hidden; platform chrome/owned pass through.
    expect(keys(out)).toEqual(['platform-admin', 'core']);
  });

  it('shows exactly the installable apps a member is granted', async () => {
    const grants = [{ orgId: 'o1', userId: 'u1', applicationKey: 'engineering' }];
    const svc = new AppAccessService(fakePrisma(grants), installation);
    const out = await svc.filterByUserAccess(ALL, { orgId: 'o1', userId: 'u1', isSuperAdmin: false });
    expect(keys(out)).toContain('engineering');
    expect(keys(out)).not.toContain('business-operations');
  });

  it('never gates non-installable apps (Settings chrome, SUPER_ADMIN-only apps)', async () => {
    const svc = new AppAccessService(fakePrisma([]), installation);
    const out = await svc.filterByUserAccess(ALL, { orgId: 'o1', userId: 'u1', isSuperAdmin: false });
    expect(keys(out)).toEqual(expect.arrayContaining(['core', 'platform-admin']));
  });

  it('is defensive: returns everything when the caller has no org/user in scope', async () => {
    const svc = new AppAccessService(fakePrisma([]), installation);
    const out = await svc.filterByUserAccess(ALL, { orgId: undefined, userId: undefined, isSuperAdmin: false });
    expect(keys(out)).toEqual(keys(ALL));
  });
});
