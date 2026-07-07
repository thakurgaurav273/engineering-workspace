import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { PermissionRegistry } from './permission-registry.service';
import { PermissionMetadataDiscovery } from './permission-metadata.discovery';

/**
 * Read-only diagnostics for the persisted authorization model. SUPER_ADMIN only. No write
 * endpoints — custom roles / permission editing are out of scope for this milestone.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform')
export class AuthorizationController {
  constructor(
    private readonly permissions: PermissionRegistry,
    private readonly platformRole: PlatformRoleService,
    private readonly prisma: PrismaService,
    private readonly endpoints: PermissionMetadataDiscovery,
  ) {}

  @Get('permissions/endpoints')
  auditEndpoints(@CurrentUser() user: { email?: string }) {
    this.requireSuperAdmin(user);
    const all = this.endpoints.discoverEndpoints();
    return {
      total: all.length,
      mapped: all.filter((e) => e.permissions.length > 0).length,
      missing: all.filter((e) => e.roles.length > 0 && e.permissions.length === 0).length,
      endpoints: all,
    };
  }

  @Get('permissions')
  async listPermissions(@CurrentUser() user: { email?: string }) {
    this.requireSuperAdmin(user);
    return {
      discovered: this.permissions.count(),
      byApplication: this.permissions.byApplication(),
      persisted: await this.prisma.permission.count(),
    };
  }

  @Get('roles')
  async listRoles(@CurrentUser() user: { email?: string }) {
    this.requireSuperAdmin(user);
    return this.prisma.authzRole.findMany({
      orderBy: { key: 'asc' },
      select: { id: true, key: true, name: true, scope: true, isSystem: true, description: true },
    });
  }

  @Get('role-permissions')
  async listRolePermissions(@CurrentUser() user: { email?: string }) {
    this.requireSuperAdmin(user);
    const roles = await this.prisma.authzRole.findMany({
      orderBy: { key: 'asc' },
      include: { rolePermissions: { include: { permission: { select: { key: true } } } } },
    });
    return roles.map((role) => ({
      role: role.key,
      scope: role.scope,
      permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
    }));
  }

  @Get('users/:id/roles')
  async userRoles(@Param('id') id: string, @CurrentUser() user: { email?: string }) {
    this.requireSuperAdmin(user);
    const [memberships, platformAssignments, customAssignments] = await Promise.all([
      this.prisma.membership.findMany({ where: { userId: id }, select: { orgId: true, role: true } }),
      this.prisma.platformRoleAssignment.findMany({ where: { userId: id }, include: { role: true } }),
      this.prisma.userRoleAssignment.findMany({ where: { userId: id }, include: { role: true } }),
    ]);
    return {
      organizationRoles: memberships, // reused from Membership; not duplicated
      platformRoles: platformAssignments.map((a) => a.role.key),
      customRoles: customAssignments.map((a) => ({ role: a.role.key, orgId: a.orgId })),
    };
  }

  private requireSuperAdmin(user: { email?: string }): void {
    if (!this.platformRole.isSuperAdmin(user?.email)) {
      throw new ForbiddenException();
    }
  }
}
