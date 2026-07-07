import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PermissionRegistry } from './permission-registry.service';
import { Pdp } from './pdp.service';
import { PermissionResolver } from './permission-resolver.service';
import { PermissionGuard } from './permission.guard';
import { PermissionMetadataDiscovery } from './permission-metadata.discovery';
import { PermissionMappingValidator } from './permission-mapping.validator';
import { ShadowAuthService } from './shadow-auth.service';
import { AuthorizationBootstrapService } from './authorization-bootstrap.service';
import { AuthorizationController } from './authorization.controller';

/**
 * Global authorization kernel: permission catalog, persistence (sync + seed), the PDP,
 * permission resolution + reflection + endpoint discovery, and the shadow harness.
 * Enforcement stays with the legacy RolesGuard; PermissionGuard is provided but NOT wired.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [AuthorizationController],
  providers: [
    PermissionRegistry,
    Pdp,
    PermissionResolver,
    PermissionGuard,
    PermissionMetadataDiscovery,
    PermissionMappingValidator,
    ShadowAuthService,
    AuthorizationBootstrapService,
  ],
  exports: [PermissionRegistry, Pdp, PermissionResolver, ShadowAuthService, PermissionMetadataDiscovery],
})
export class AuthorizationModule {}
