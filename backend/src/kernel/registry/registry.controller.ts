import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegistryService } from './registry.service';
import { PlatformRoleService } from '../platform-role/platform-role.service';
import { InstallationService } from '../installation/installation.service';

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
  ) {}

  @Get()
  async list(@CurrentUser() user: { email?: string; orgId?: string }) {
    const visible = this.registry.listVisible(this.platformRole.isSuperAdmin(user?.email));
    // Filter by the caller org's installation state — launcher & sidebar respect it
    // automatically, with no app-specific logic in the shell.
    return this.installation.applyInstallationState(visible, user?.orgId);
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
