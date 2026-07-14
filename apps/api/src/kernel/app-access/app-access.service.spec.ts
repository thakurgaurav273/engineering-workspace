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

  it('denies installable apps by default - a member with no grants sees only non-installable apps', async () => {
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

describe('AppAccessService.grantDefaultAccess', () => {
  // Installation stub that reports ENG + BIZ as the installed installable apps for any org.
  const installedInstallation = {
    installableApps: () => [ENG, BIZ] as unknown as ApplicationManifest[],
    applyInstallationState: async (list: ApplicationManifest[]) => list,
  } as unknown as InstallationService;

  function recordingPrisma(existing: Array<{ orgId: string; userId: string; applicationKey: string }>) {
    const created: any[] = [];
    const prisma = {
      userApplicationAccess: {
        findMany: async ({ where }: any) =>
          existing.filter(
            (g) =>
              g.orgId === where.orgId &&
              g.userId === where.userId &&
              (!where.applicationKey?.in || where.applicationKey.in.includes(g.applicationKey)),
          ),
        createMany: async ({ data }: any) => {
          created.push(...data);
          return { count: data.length };
        },
      },
    } as unknown as PrismaService;
    return { prisma, created };
  }

  it('grants every installed app to a member with no prior rows', async () => {
    const { prisma, created } = recordingPrisma([]);
    const svc = new AppAccessService(prisma, installedInstallation);
    await svc.grantDefaultAccess('o1', 'u1');
    expect(created.map((c) => c.applicationKey).sort()).toEqual(['business-operations', 'engineering']);
    expect(created.every((c) => c.granted === true)).toBe(true);
  });

  it('is create-missing only: leaves an existing explicit revocation untouched', async () => {
    // A prior granted=false revocation for business-operations must NOT be resurrected.
    const { prisma, created } = recordingPrisma([
      { orgId: 'o1', userId: 'u1', applicationKey: 'business-operations' },
    ]);
    const svc = new AppAccessService(prisma, installedInstallation);
    await svc.grantDefaultAccess('o1', 'u1');
    expect(created.map((c) => c.applicationKey)).toEqual(['engineering']);
  });

  it('is idempotent: a fully-granted member gets no new rows', async () => {
    const { prisma, created } = recordingPrisma([
      { orgId: 'o1', userId: 'u1', applicationKey: 'engineering' },
      { orgId: 'o1', userId: 'u1', applicationKey: 'business-operations' },
    ]);
    const svc = new AppAccessService(prisma, installedInstallation);
    await svc.grantDefaultAccess('o1', 'u1');
    expect(created).toEqual([]);
  });
});
