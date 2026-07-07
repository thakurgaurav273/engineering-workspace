import { InstallationService } from './installation.service';
import { InstallationBootstrapService } from './installation-bootstrap.service';
import { RegistryService } from '../registry/registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationManifest } from '../registry/application-manifest';

const ENG = { key: 'engineering', requiresSuperAdmin: false, showInLauncher: true, status: 'ACTIVE' };
const BIZ = { key: 'business-operations', requiresSuperAdmin: false, showInLauncher: true, status: 'EXPERIMENTAL' };
const ADMIN = { key: 'platform-admin', requiresSuperAdmin: true, showInLauncher: true, status: 'ACTIVE' };
const CORE = { key: 'core', requiresSuperAdmin: false, showInLauncher: false, status: 'ACTIVE' };
const ALL = [ENG, BIZ, ADMIN, CORE] as unknown as ApplicationManifest[];

function fakeRegistry(): RegistryService {
  return {
    get: (k: string) => ALL.find((m) => m.key === k),
    list: () => ALL,
  } as unknown as RegistryService;
}

function fakePrisma(orgs: string[] = ['org1']) {
  const installs = new Map<string, { id: string; orgId: string; applicationKey: string; state: string }>();
  const configs = new Map<string, unknown>();
  const prisma = {
    _installs: installs,
    _configs: configs,
    organization: { findMany: async () => orgs.map((id) => ({ id })) },
    applicationInstallation: {
      upsert: async ({ where, create, update }: any) => {
        const { orgId, applicationKey } = where.orgId_applicationKey;
        const k = `${orgId}|${applicationKey}`;
        const existing = installs.get(k);
        if (existing) { existing.state = update.state; return existing; }
        const row = { id: `i${installs.size + 1}`, orgId, applicationKey, state: create.state };
        installs.set(k, row);
        return row;
      },
      findMany: async ({ where }: any = {}) =>
        [...installs.values()].filter(
          (r) => (!where?.orgId || r.orgId === where.orgId) && (!where?.applicationKey || r.applicationKey === where.applicationKey),
        ),
      createMany: async ({ data }: any) => {
        for (const d of data) {
          const k = `${d.orgId}|${d.applicationKey}`;
          if (!installs.has(k)) installs.set(k, { id: `i${installs.size + 1}`, ...d });
        }
        return { count: data.length };
      },
    },
    applicationConfiguration: {
      upsert: async ({ where, create, update }: any) => {
        const { orgId, applicationKey } = where.orgId_applicationKey;
        const config = update.config ?? create.config;
        configs.set(`${orgId}|${applicationKey}`, config);
        return { orgId, applicationKey, config };
      },
      findUnique: async ({ where }: any) => {
        const { orgId, applicationKey } = where.orgId_applicationKey;
        const k = `${orgId}|${applicationKey}`;
        return configs.has(k) ? { config: configs.get(k) } : null;
      },
      findMany: async ({ where }: any) =>
        [...configs.entries()]
          .filter(([k]) => k.startsWith(`${where.orgId}|`))
          .map(([k, config]) => ({ applicationKey: k.split('|')[1], config })),
    },
  };
  return prisma;
}

function service(prisma = fakePrisma()) {
  return { svc: new InstallationService(prisma as unknown as PrismaService, fakeRegistry()), prisma };
}

describe('InstallationService', () => {
  it('installs, disables, enables and uninstalls an app', async () => {
    const { svc, prisma } = service();
    await svc.install('org1', 'engineering');
    expect(prisma._installs.get('org1|engineering')?.state).toBe('INSTALLED');
    await svc.disable('org1', 'engineering');
    expect(prisma._installs.get('org1|engineering')?.state).toBe('DISABLED');
    await svc.enable('org1', 'engineering');
    expect(prisma._installs.get('org1|engineering')?.state).toBe('INSTALLED');
    await svc.uninstall('org1', 'engineering');
    expect(prisma._installs.get('org1|engineering')?.state).toBe('UNINSTALLED');
  });

  it('is idempotent — installing twice keeps a single record', async () => {
    const { svc, prisma } = service();
    await svc.install('org1', 'engineering');
    await svc.install('org1', 'engineering');
    expect(prisma._installs.size).toBe(1);
  });

  it('rejects installing/uninstalling platform-owned apps', async () => {
    const { svc } = service();
    await expect(svc.install('org1', 'platform-admin')).rejects.toThrow();
    await expect(svc.disable('org1', 'core')).rejects.toThrow();
    await expect(svc.install('org1', 'unknown')).rejects.toThrow();
  });

  it('updates and preserves configuration across uninstall', async () => {
    const { svc } = service();
    await svc.setConfiguration('org1', 'engineering', { theme: 'dark' });
    expect(await svc.getConfiguration('org1', 'engineering')).toEqual({ theme: 'dark' });
    await svc.uninstall('org1', 'engineering');
    expect(await svc.getConfiguration('org1', 'engineering')).toEqual({ theme: 'dark' });
  });

  it('filters the registry catalog by installation state (launcher)', async () => {
    const { svc } = service();
    const keys = async () => (await svc.applyInstallationState(ALL, 'org1')).map((m) => m.key);
    // Default: all visible (installable default INSTALLED; platform-owned pass through).
    expect(await keys()).toEqual(['engineering', 'business-operations', 'platform-admin', 'core']);
    await svc.disable('org1', 'business-operations');
    expect(await keys()).toEqual(['engineering', 'platform-admin', 'core']);
    await svc.uninstall('org1', 'engineering');
    expect(await keys()).toEqual(['platform-admin', 'core']);
  });

  it('surfaces MAINTENANCE status without hiding the app', async () => {
    const { svc, prisma } = service();
    await prisma.applicationInstallation.upsert({
      where: { orgId_applicationKey: { orgId: 'org1', applicationKey: 'engineering' } },
      create: { state: 'MAINTENANCE' },
      update: { state: 'MAINTENANCE' },
    });
    const eng = (await svc.applyInstallationState(ALL, 'org1')).find((m) => m.key === 'engineering');
    expect(eng?.status).toBe('MAINTENANCE');
  });
});

describe('InstallationBootstrapService', () => {
  it('creates INSTALLED records for each org x installable app, idempotently', async () => {
    const prisma = fakePrisma(['org1', 'org2']);
    const svc = new InstallationService(prisma as unknown as PrismaService, fakeRegistry());
    const boot = new InstallationBootstrapService(prisma as unknown as PrismaService, svc);

    const created = await boot.sync();
    expect(created).toBe(4); // 2 orgs x 2 installable apps (eng, biz) — admin/core excluded
    expect(prisma._installs.size).toBe(4);

    const again = await boot.sync();
    expect(again).toBe(0);
    expect(prisma._installs.size).toBe(4);
  });
});
