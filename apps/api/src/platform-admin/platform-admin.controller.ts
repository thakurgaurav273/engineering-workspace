import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RegistryService } from '../kernel/registry/registry.service';
import { PlatformRoleService } from '../kernel/platform-role/platform-role.service';
import { FeatureFlagService } from '../kernel/flags/feature-flag.service';
import { StorageService } from '../platform/storage/storage.service';
import { AuditService } from '../kernel/audit/audit.service';

type Principal = { sub?: string; email?: string };

class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * Platform-wide administrative reads: system settings, storage inventory and the audit trail.
 * All SUPER_ADMIN-only, matching the rest of the platform surface. These compose existing
 * services/models - no new domain concepts - so they stay honest about what the platform knows.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
    private readonly platformRole: PlatformRoleService,
    private readonly flags: FeatureFlagService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ---- Settings: read-only platform/system information ----
  @Get('settings')
  async settings(@CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const apps = this.registry.list();
    const flagMap = this.flags.snapshot();
    const [organizations, users] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
    ]);
    return {
      environment: process.env.NODE_ENV ?? 'development',
      apiVersion: process.env.npm_package_version ?? '1.0.0',
      nodeVersion: process.version,
      storageConfigured: this.storage.isConfigured(),
      counts: {
        applications: apps.length,
        organizations,
        users,
        featureFlags: Object.keys(flagMap).length,
        enabledFlags: Object.values(flagMap).filter(Boolean).length,
      },
      featureFlags: flagMap,
    };
  }

  // ---- Storage: document/artifact inventory derived from the database ----
  @Get('storage')
  async storageInventory(@CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const [avatars, logos, signatures, taskAttachments, commentAttachments] = await Promise.all([
      this.prisma.user.count({ where: { avatarUrl: { not: null } } }),
      this.prisma.organization.count({ where: { logoUrl: { not: null } } }),
      this.prisma.user.count({ where: { signatureUrl: { not: null } } }),
      this.prisma.taskUpdateAttachment.count(),
      this.prisma.workspaceItemCommentAttachment.count(),
    ]);
    const items = [
      { kind: 'User avatars', count: avatars },
      { kind: 'Organization logos', count: logos },
      { kind: 'User signatures', count: signatures },
      { kind: 'Task-update attachments', count: taskAttachments },
      { kind: 'Comment attachments', count: commentAttachments },
    ];
    return {
      configured: this.storage.isConfigured(),
      totalObjects: items.reduce((sum, i) => sum + i.count, 0),
      items,
    };
  }

  // ---- Audit: paginated platform audit trail ----
  @Get('audit')
  async auditList(@Query() pagination: PaginationDto, @Query('action') action: string | undefined, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { rows, total } = await this.audit.list({ page, limit, action });
    return paginate(rows, total, page, limit);
  }

  @Get('audit/actions')
  async auditActions(@CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    return this.audit.actions();
  }

  // ---- Organizations / Tenants: the full cross-org directory ----
  // In this platform an organization IS the tenant (the top-level account & isolation boundary);
  // there is no separate tenant layer. SUPER_ADMIN only - every other org endpoint is scoped to
  // the caller's own org.
  @Get('organizations')
  async organizations(@CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        description: true,
        logoUrl: true,
        createdAt: true,
        linearWorkspaceName: true,
        _count: { select: { memberships: true, users: true, applicationInstallations: true } },
      },
    });
    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      status: o.status,
      description: o.description,
      logoUrl: o.logoUrl,
      createdAt: o.createdAt,
      linearWorkspaceName: o.linearWorkspaceName,
      memberCount: o._count.memberships,
      userCount: o._count.users,
      appCount: o._count.applicationInstallations,
    }));
  }

  @Get('organizations/:id')
  async organization(@Param('id') id: string, @CurrentUser() user: Principal) {
    this.requireSuperAdmin(user);
    return this.getOrgDetail(id);
  }

  @Patch('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrgDto,
    @CurrentUser() user: Principal,
  ) {
    this.requireSuperAdmin(user);
    await this.ensureOrg(id);
    await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    await this.audit.record({
      action: 'organization.update',
      actorId: user.sub,
      actorEmail: user.email,
      targetType: 'organization',
      targetId: id,
      orgId: id,
      metadata: { ...dto },
    });
    return this.getOrgDetail(id);
  }

  @Post('organizations/:id/suspend')
  suspendOrganization(@Param('id') id: string, @CurrentUser() user: Principal) {
    return this.setOrgStatus(id, 'SUSPENDED', user);
  }

  @Post('organizations/:id/activate')
  activateOrganization(@Param('id') id: string, @CurrentUser() user: Principal) {
    return this.setOrgStatus(id, 'ACTIVE', user);
  }

  private async setOrgStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', user: Principal) {
    this.requireSuperAdmin(user);
    await this.ensureOrg(id);
    await this.prisma.organization.update({ where: { id }, data: { status } });
    await this.audit.record({
      action: status === 'SUSPENDED' ? 'organization.suspend' : 'organization.activate',
      actorId: user.sub,
      actorEmail: user.email,
      targetType: 'organization',
      targetId: id,
      orgId: id,
    });
    return this.getOrgDetail(id);
  }

  private async ensureOrg(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true } });
    if (!org) throw new NotFoundException('Organization not found');
  }

  private async getOrgDetail(id: string) {
    const o = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        description: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        linearWorkspaceName: true,
        linearConnectedAt: true,
        _count: { select: { memberships: true, users: true, applicationInstallations: true } },
      },
    });
    if (!o) throw new NotFoundException('Organization not found');
    const { _count, ...rest } = o;
    return {
      ...rest,
      memberCount: _count.memberships,
      userCount: _count.users,
      appCount: _count.applicationInstallations,
    };
  }

  private requireSuperAdmin(user: Principal): void {
    if (!this.platformRole.isSuperAdmin(user?.email)) throw new ForbiddenException();
  }
}
