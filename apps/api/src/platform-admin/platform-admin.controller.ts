import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RegistryService } from '../kernel/registry/registry.service';
import { PlatformRoleService } from '../kernel/platform-role/platform-role.service';
import { FeatureFlagService } from '../kernel/flags/feature-flag.service';
import { StorageService } from '../platform/storage/storage.service';
import { AuditService } from '../kernel/audit/audit.service';

type Principal = { email?: string };

/**
 * Platform-wide administrative reads: system settings, storage inventory and the audit trail.
 * All SUPER_ADMIN-only, matching the rest of the platform surface. These compose existing
 * services/models — no new domain concepts — so they stay honest about what the platform knows.
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

  private requireSuperAdmin(user: Principal): void {
    if (!this.platformRole.isSuperAdmin(user?.email)) throw new ForbiddenException();
  }
}
