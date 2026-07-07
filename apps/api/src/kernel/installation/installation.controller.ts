import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { InstallationService } from './installation.service';
import { ConfigurationDto, InstallationTargetDto } from './dto/installation.dto';

type Principal = { sub?: string; email?: string };

/**
 * Application installation management. Reuses the platform authorization model: platform
 * SUPER_ADMIN for platform-wide reads/writes, or an organization OWNER/ADMIN for their own
 * org. @RequirePermission adds shadow-mode audit coverage.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class InstallationController {
  constructor(
    private readonly installation: InstallationService,
    private readonly platformRole: PlatformRoleService,
    private readonly prisma: PrismaService,
  ) {}

  // ---- Reads ----

  @Get('platform/installations')
  @RequirePermission('platform:application:manage')
  async listAll(@CurrentUser() user: Principal) {
    await this.requireSuperAdmin(user);
    return this.installation.listAll();
  }

  @Get('platform/installations/:application')
  @RequirePermission('platform:application:manage')
  async listByApplication(@Param('application') application: string, @CurrentUser() user: Principal) {
    await this.requireSuperAdmin(user);
    return this.installation.listByApplication(application);
  }

  @Get('organizations/:id/installations')
  @RequirePermission('platform:application:manage')
  async listByOrg(@Param('id') orgId: string, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, orgId);
    return this.installation.listByOrg(orgId);
  }

  // ---- Writes ----

  @Post('platform/installations/install')
  @RequirePermission('platform:application:manage')
  async install(@Body() dto: InstallationTargetDto, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, dto.orgId);
    return this.installation.install(dto.orgId, dto.application);
  }

  @Post('platform/installations/uninstall')
  @RequirePermission('platform:application:manage')
  async uninstall(@Body() dto: InstallationTargetDto, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, dto.orgId);
    return this.installation.uninstall(dto.orgId, dto.application);
  }

  @Post('platform/installations/enable')
  @RequirePermission('platform:application:manage')
  async enable(@Body() dto: InstallationTargetDto, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, dto.orgId);
    return this.installation.enable(dto.orgId, dto.application);
  }

  @Post('platform/installations/disable')
  @RequirePermission('platform:application:manage')
  async disable(@Body() dto: InstallationTargetDto, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, dto.orgId);
    return this.installation.disable(dto.orgId, dto.application);
  }

  @Patch('platform/installations/configuration')
  @RequirePermission('platform:application:manage')
  async configure(@Body() dto: ConfigurationDto, @CurrentUser() user: Principal) {
    await this.requireOrgManager(user, dto.orgId);
    return this.installation.setConfiguration(dto.orgId, dto.application, dto.config);
  }

  // ---- Authorization (reuses PlatformRoleService + Membership) ----

  private async requireSuperAdmin(user: Principal): Promise<void> {
    if (!this.platformRole.isSuperAdmin(user?.email)) throw new ForbiddenException();
  }

  private async requireOrgManager(user: Principal, orgId: string): Promise<void> {
    if (this.platformRole.isSuperAdmin(user?.email)) return;
    if (!user?.sub) throw new ForbiddenException();
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.sub, orgId } },
      select: { role: true },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new ForbiddenException();
    }
  }
}
