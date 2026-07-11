import { Global, Module } from '@nestjs/common';
import { AppAccessService } from './app-access.service';
import { AppAccessController } from './app-access.controller';

/**
 * Global per-user application-access kernel. Reuses PrismaService (persistence), InstallationService
 * (installable detection) and PlatformRoleService (SUPER_ADMIN authorization). Exports
 * AppAccessService so the RegistryController can filter the catalog by per-user grants.
 */
@Global()
@Module({
  controllers: [AppAccessController],
  providers: [AppAccessService],
  exports: [AppAccessService],
})
export class AppAccessModule {}
