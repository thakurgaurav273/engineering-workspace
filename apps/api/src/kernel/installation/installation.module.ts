import { Global, Module } from '@nestjs/common';
import { InstallationService } from './installation.service';
import { InstallationBootstrapService } from './installation-bootstrap.service';
import { InstallationController } from './installation.controller';

/**
 * Global application-installation kernel. Reuses RegistryService (installable detection),
 * PrismaService (persistence), PlatformRoleService + Membership (authorization). Exports
 * InstallationService so the RegistryController can filter the catalog by install state.
 */
@Global()
@Module({
  controllers: [InstallationController],
  providers: [InstallationService, InstallationBootstrapService],
  exports: [InstallationService],
})
export class InstallationModule {}
