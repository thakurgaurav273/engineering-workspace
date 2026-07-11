import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegistryService } from './registry.service';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { InstallationService } from '../installation/installation.service';
import { AppAccessService } from '../app-access/app-access.service';

/**
 * Application catalog + per-application metadata (the foundation for diagnostics). Apps
 * flagged `requiresSuperAdmin` are hidden from everyone except a platform SUPER_ADMIN, at
 * both the list and the detail endpoints.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform/applications')
export class RegistryController {
  constructor(
    private readonly registry: RegistryService,
    private readonly platformRole: PlatformRoleService,
    private readonly installation: InstallationService,
    private readonly appAccess: AppAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { sub?: string; email?: string; orgId?: string }) {
    const isSuperAdmin = this.platformRole.isSuperAdmin(user?.email);
    const visible = this.registry.listVisible(isSuperAdmin);
    // Filter by the caller org's installation state — launcher & sidebar respect it
    // automatically, with no app-specific logic in the shell.
    const installed = await this.installation.applyInstallationState(visible, user?.orgId);
    // Then by the caller's per-user grants (deny-by-default). SUPER_ADMIN bypasses both.
    return this.appAccess.filterByUserAccess(installed, {
      orgId: user?.orgId,
      userId: user?.sub,
      isSuperAdmin,
    });
  }

  @Get(':key')
  overview(@Param('key') key: string, @CurrentUser() user: { email?: string }) {
    return this.requireVisible(key, user);
  }

  @Get(':key/health')
  health(@Param('key') key: string, @CurrentUser() user: { email?: string }) {
    this.requireVisible(key, user);
    return this.registry.health(key);
  }

  @Get(':key/capabilities')
  capabilities(@Param('key') key: string, @CurrentUser() user: { email?: string }) {
    this.requireVisible(key, user);
    return this.registry.capabilities(key);
  }

  private requireVisible(key: string, user: { email?: string }) {
    const manifest = this.registry.get(key);
    const isSuperAdmin = this.platformRole.isSuperAdmin(user?.email);
    if (!manifest || (manifest.requiresSuperAdmin && !isSuperAdmin)) {
      throw new NotFoundException(`Application "${key}" not found`);
    }
    return manifest;
  }
}
