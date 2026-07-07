import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PermissionMetadataDiscovery } from './permission-metadata.discovery';

/**
 * Startup validation for migration visibility: every @Roles-protected endpoint should
 * eventually also declare @RequirePermission. Missing ones are WARNED, never fatal.
 */
@Injectable()
export class PermissionMappingValidator implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionMappingValidator.name);

  constructor(private readonly discovery: PermissionMetadataDiscovery) {}

  onApplicationBootstrap(): void {
    const missing = this.discovery.endpointsMissingPermissions();
    if (missing.length === 0) {
      this.logger.log('Permission mapping: all role-guarded endpoints declare @RequirePermission');
      return;
    }
    this.logger.warn(
      `Permission mapping: ${missing.length} role-guarded endpoint(s) missing @RequirePermission`,
    );
    for (const e of missing) {
      this.logger.warn(`  [${e.method}] ${e.route} (${e.controller}.${e.handler}) roles=[${e.roles.join(',')}]`);
    }
  }
}
