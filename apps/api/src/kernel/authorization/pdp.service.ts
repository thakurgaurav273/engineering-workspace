import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { PermissionRegistry } from './permission-registry.service';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface AuthzPrincipal {
  sub?: string;
  email?: string;
  role?: OrgRole;
  orgId?: string;
}

export interface AuthzDecision {
  allow: boolean;
  reason: string;
}

/**
 * Policy Decision Point. SHADOW MODE only - the legacy RolesGuard remains authoritative.
 *
 * `checkRoles` mirrors the guard exactly (sync, no DB) and is the parity path used by the
 * shadow harness. `checkPermission` is the forward path and now resolves permissions from
 * the database (Role -> RolePermission), with per-request caching. Unknown permission =
 * deny. Nothing in the request path depends on `checkPermission` yet, so the DB has no
 * effect on live behavior.
 */
@Injectable()
export class Pdp {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionRegistry,
    private readonly platformRole: PlatformRoleService,
    private readonly context: RequestContextService,
  ) {}

  /** Role-based decision, byte-equivalent to `requiredRoles.includes(user.role)`. */
  checkRoles(principal: AuthzPrincipal, requiredRoles: string[]): AuthzDecision {
    if (!requiredRoles || requiredRoles.length === 0) {
      return { allow: true, reason: 'no-roles-required' };
    }
    const role = principal?.role;
    const allow = !!role && requiredRoles.includes(role);
    return {
      allow,
      reason: allow ? `role:${role}` : `role:${role ?? 'none'} not in [${requiredRoles.join(',')}]`,
    };
  }

  /** Permission-based decision (forward path), resolved from the database. */
  async checkPermission(principal: AuthzPrincipal, permission: string): Promise<AuthzDecision> {
    if (!this.permissions.has(permission)) {
      return { allow: false, reason: `unknown-permission:${permission}` };
    }
    const granted = await this.resolvePermissions(principal);
    const allow = granted.has(permission);
    return { allow, reason: allow ? `granted:${permission}` : `missing:${permission}` };
  }

  /** The effective permission keys for a principal, unioned across all their roles. Cached per request. */
  async resolvePermissions(principal: AuthzPrincipal): Promise<Set<string>> {
    const cacheKey = `authz:perms:${principal?.sub ?? 'anon'}:${principal?.orgId ?? '-'}`;
    const cache = this.context.cache;
    const cached = cache?.get(cacheKey) as Set<string> | undefined;
    if (cached) return cached;

    const roleKeys = new Set<string>();
    if (principal?.role) roleKeys.add(principal.role); // org role reused from Membership (via JWT)
    if (this.platformRole.isSuperAdmin(principal?.email)) roleKeys.add('SUPER_ADMIN');

    if (principal?.sub) {
      const [platformAssignments, customAssignments] = await Promise.all([
        this.prisma.platformRoleAssignment.findMany({
          where: { userId: principal.sub },
          include: { role: true },
        }),
        this.prisma.userRoleAssignment.findMany({
          where: { userId: principal.sub, OR: [{ orgId: principal.orgId ?? undefined }, { orgId: null }] },
          include: { role: true },
        }),
      ]);
      for (const a of platformAssignments) roleKeys.add(a.role.key);
      for (const a of customAssignments) roleKeys.add(a.role.key);
    }

    const permissions = new Set<string>();
    if (roleKeys.size) {
      const roles = await this.prisma.authzRole.findMany({
        where: { key: { in: [...roleKeys] } },
        include: { rolePermissions: { include: { permission: true } } },
      });
      for (const role of roles) {
        for (const rp of role.rolePermissions) permissions.add(rp.permission.key);
      }
    }

    cache?.set(cacheKey, permissions);
    return permissions;
  }
}
