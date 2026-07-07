import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RoleScope } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionRegistry } from './permission-registry.service';

interface RoleSeed {
  key: string;
  name: string;
  scope: RoleScope;
  description: string;
  /** Which discovered permissions this role is granted. */
  match: (permissionKey: string) => boolean;
}

/**
 * Built-in platform + organization roles and how they map onto discovered permissions.
 * OWNER and ADMIN are granted the same app permissions (they are treated together by the
 * legacy RolesGuard). Role→permission mapping lives here as seed data and is persisted —
 * it is no longer hardcoded inside the PDP.
 */
export const ROLE_SEED: RoleSeed[] = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', scope: 'PLATFORM', description: 'Platform operator.', match: (p) => p.startsWith('platform:') },
  { key: 'OWNER', name: 'Owner', scope: 'ORG', description: 'Organization owner.', match: (p) => !p.startsWith('platform:') },
  { key: 'ADMIN', name: 'Admin', scope: 'ORG', description: 'Organization administrator.', match: (p) => !p.startsWith('platform:') },
  { key: 'MANAGER', name: 'Manager', scope: 'ORG', description: 'Team manager.', match: (p) => p.startsWith('engineering:') || p.endsWith(':read') },
  { key: 'MEMBER', name: 'Member', scope: 'ORG', description: 'Organization member.', match: (p) => p.endsWith(':read') },
];

/**
 * Boot-time synchronization: manifest permissions -> Permission table -> role seeding ->
 * RolePermission seeding. Idempotent (upserts + create-missing; never deletes). Runs after
 * every application has registered (OnApplicationBootstrap). A DB failure is logged, not
 * fatal — the app still boots and the authoritative RolesGuard is unaffected.
 */
@Injectable()
export class AuthorizationBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthorizationBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sync();
    } catch (error) {
      this.logger.error(
        `Authorization bootstrap skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sync(): Promise<void> {
    const permissions = await this.syncPermissions();
    await this.seedRoles();
    await this.seedRolePermissions();
    this.logger.log(`Authorization catalog synchronized (${permissions} permissions, ${ROLE_SEED.length} roles)`);
  }

  private parse(key: string): { appKey: string; resource: string; action: string } {
    const [appKey = '', resource = '', action = ''] = key.split(':');
    return { appKey, resource, action };
  }

  async syncPermissions(): Promise<number> {
    const keys = this.permissions.list();
    for (const key of keys) {
      const { appKey, resource, action } = this.parse(key);
      await this.prisma.permission.upsert({
        where: { key },
        create: { key, appKey, resource, action },
        update: { appKey, resource, action },
      });
    }
    return keys.length;
  }

  async seedRoles(): Promise<void> {
    for (const role of ROLE_SEED) {
      await this.prisma.authzRole.upsert({
        where: { key: role.key },
        create: { key: role.key, name: role.name, scope: role.scope, description: role.description, isSystem: true },
        update: { name: role.name, scope: role.scope, description: role.description },
      });
    }
  }

  async seedRolePermissions(): Promise<void> {
    const allPermissions = await this.prisma.permission.findMany({ select: { id: true, key: true } });
    for (const seed of ROLE_SEED) {
      const role = await this.prisma.authzRole.findUnique({ where: { key: seed.key }, select: { id: true } });
      if (!role) continue;
      const desired = allPermissions.filter((p) => seed.match(p.key));
      const existing = await this.prisma.rolePermission.findMany({
        where: { roleId: role.id },
        select: { permissionId: true },
      });
      const have = new Set(existing.map((e) => e.permissionId));
      const toCreate = desired
        .filter((p) => !have.has(p.id))
        .map((p) => ({ roleId: role.id, permissionId: p.id }));
      if (toCreate.length) {
        await this.prisma.rolePermission.createMany({ data: toCreate, skipDuplicates: true });
      }
    }
  }
}
