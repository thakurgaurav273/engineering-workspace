import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../kernel/registry/registry.service';
import { platformAdminApplication } from './platform-admin.manifest';
import { PlatformAdminController } from './platform-admin.controller';

/**
 * Registers Platform Administration as an application (exactly like Engineering) and exposes the
 * platform-admin read surface (settings, storage inventory, audit trail) via its controller. The
 * feature-flag gate lives in the manifest + registry, so registration stays one line.
 */
@Module({ controllers: [PlatformAdminController] })
export class PlatformAdminModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(platformAdminApplication);
  }
}
