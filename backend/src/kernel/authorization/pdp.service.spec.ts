import { Pdp } from './pdp.service';

interface Role {
  key: string;
  rolePermissions: { permission: { key: string } }[];
}

function makePdp(opts: {
  known?: string[];
  roles?: Role[];
  superAdmin?: boolean;
  cache?: Map<string, unknown>;
  authzFindMany?: jest.Mock;
}): Pdp {
  const authzFindMany =
    opts.authzFindMany ??
    (jest.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
      (opts.roles ?? []).filter((r) => where.key.in.includes(r.key)),
    ) as jest.Mock);
  const prisma = {
    platformRoleAssignment: { findMany: jest.fn(async () => []) },
    userRoleAssignment: { findMany: jest.fn(async () => []) },
    authzRole: { findMany: authzFindMany },
  };
  const permissions = { has: (p: string) => (opts.known ?? []).includes(p) };
  const platformRole = { isSuperAdmin: () => opts.superAdmin ?? false };
  const context = { cache: opts.cache };
  return new Pdp(prisma as never, permissions as never, platformRole as never, context as never);
}

describe('Pdp', () => {
  describe('checkRoles (parity with RolesGuard)', () => {
    it('is byte-equivalent to requiredRoles.includes(role)', () => {
      const pdp = makePdp({});
      const required = ['OWNER', 'ADMIN'];
      for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
        expect(pdp.checkRoles({ role }, required).allow).toBe(required.includes(role));
      }
    });
    it('allows when no roles are required', () => {
      expect(makePdp({}).checkRoles({ role: 'MEMBER' }, []).allow).toBe(true);
    });
  });

  describe('checkPermission (DB-backed forward path)', () => {
    const ownerRole: Role = { key: 'OWNER', rolePermissions: [{ permission: { key: 'engineering:goal:write' } }] };
    const memberRole: Role = { key: 'MEMBER', rolePermissions: [{ permission: { key: 'engineering:goal:read' } }] };

    it('denies unknown permissions without touching the DB', async () => {
      const pdp = makePdp({ known: [] });
      expect((await pdp.checkPermission({ role: 'OWNER', sub: 'u1' }, 'nope:none:none')).allow).toBe(false);
    });

    it('grants a permission mapped to the principal role', async () => {
      const pdp = makePdp({ known: ['engineering:goal:write'], roles: [ownerRole] });
      expect((await pdp.checkPermission({ role: 'OWNER', sub: 'u1' }, 'engineering:goal:write')).allow).toBe(true);
    });

    it('denies a permission not mapped to the principal role', async () => {
      const pdp = makePdp({ known: ['engineering:goal:write'], roles: [memberRole] });
      expect((await pdp.checkPermission({ role: 'MEMBER', sub: 'u1' }, 'engineering:goal:write')).allow).toBe(false);
    });

    it('caches the resolved permission set per request', async () => {
      const authzFindMany = jest.fn(async () => [ownerRole]);
      const pdp = makePdp({ known: ['engineering:goal:write'], authzFindMany, cache: new Map() });
      await pdp.checkPermission({ role: 'OWNER', sub: 'u1' }, 'engineering:goal:write');
      await pdp.checkPermission({ role: 'OWNER', sub: 'u1' }, 'engineering:goal:write');
      expect(authzFindMany).toHaveBeenCalledTimes(1);
    });
  });
});
