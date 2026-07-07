import { AuthorizationBootstrapService, ROLE_SEED } from './authorization-bootstrap.service';
import { PermissionRegistry } from './permission-registry.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Minimal stateful in-memory Prisma double so idempotency is genuinely exercised. */
function fakePrisma() {
  const permissions = new Map<string, { id: string; key: string }>();
  const roles = new Map<string, { id: string; key: string }>();
  const rolePerms = new Set<string>(); // `${roleId}|${permissionId}`
  let seq = 0;
  const prisma = {
    _state: { permissions, roles, rolePerms },
    permission: {
      upsert: async ({ where, create }: { where: { key: string }; create: { key: string } }) => {
        const existing = permissions.get(where.key);
        if (existing) return existing;
        const row = { id: `p${++seq}`, key: create.key };
        permissions.set(where.key, row);
        return row;
      },
      findMany: async () => [...permissions.values()],
    },
    authzRole: {
      upsert: async ({ where, create }: { where: { key: string }; create: { key: string } }) => {
        const existing = roles.get(where.key);
        if (existing) return existing;
        const row = { id: `r${++seq}`, key: create.key };
        roles.set(where.key, row);
        return row;
      },
      findUnique: async ({ where }: { where: { key: string } }) => {
        const r = roles.get(where.key);
        return r ? { id: r.id } : null;
      },
    },
    rolePermission: {
      findMany: async ({ where }: { where: { roleId: string } }) =>
        [...rolePerms]
          .filter((k) => k.startsWith(`${where.roleId}|`))
          .map((k) => ({ permissionId: k.split('|')[1] })),
      createMany: async ({ data }: { data: { roleId: string; permissionId: string }[] }) => {
        for (const d of data) rolePerms.add(`${d.roleId}|${d.permissionId}`);
        return { count: data.length };
      },
    },
  };
  return prisma;
}

function service(prisma: ReturnType<typeof fakePrisma>, keys: string[]) {
  const registry = { list: () => keys } as unknown as PermissionRegistry;
  return new AuthorizationBootstrapService(prisma as unknown as PrismaService, registry);
}

const KEYS = ['engineering:goal:read', 'engineering:goal:write', 'platform:tenant:manage'];

describe('AuthorizationBootstrapService', () => {
  it('synchronizes permissions and seeds all roles', async () => {
    const prisma = fakePrisma();
    await service(prisma, KEYS).sync();
    expect(prisma._state.permissions.size).toBe(3);
    expect(prisma._state.roles.size).toBe(ROLE_SEED.length);
  });

  it('is idempotent — running twice creates no duplicates', async () => {
    const prisma = fakePrisma();
    const svc = service(prisma, KEYS);
    await svc.sync();
    const perms = prisma._state.permissions.size;
    const rolePerms = prisma._state.rolePerms.size;
    await svc.sync();
    expect(prisma._state.permissions.size).toBe(perms);
    expect(prisma._state.roles.size).toBe(ROLE_SEED.length);
    expect(prisma._state.rolePerms.size).toBe(rolePerms);
  });

  it('maps role permissions per the seed rules (MEMBER = reads only)', async () => {
    const prisma = fakePrisma();
    await service(prisma, KEYS).sync();
    const memberId = prisma._state.roles.get('MEMBER')!.id;
    const readId = [...prisma._state.permissions.values()].find((p) => p.key === 'engineering:goal:read')!.id;
    const writeId = [...prisma._state.permissions.values()].find((p) => p.key === 'engineering:goal:write')!.id;
    expect(prisma._state.rolePerms.has(`${memberId}|${readId}`)).toBe(true);
    expect(prisma._state.rolePerms.has(`${memberId}|${writeId}`)).toBe(false);
  });

  it('grants SUPER_ADMIN the platform permissions', async () => {
    const prisma = fakePrisma();
    await service(prisma, KEYS).sync();
    const superId = prisma._state.roles.get('SUPER_ADMIN')!.id;
    const platformId = [...prisma._state.permissions.values()].find((p) => p.key === 'platform:tenant:manage')!.id;
    expect(prisma._state.rolePerms.has(`${superId}|${platformId}`)).toBe(true);
  });
});
