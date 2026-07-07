import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../kernel/registry/registry.service';
import { platformAdminApplication } from './platform-admin.manifest';

/**
 * Registers Platform Administration as an application (exactly like Engineering). The
 * feature-flag gate now lives in the manifest + registry, so this module is a uniform
 * one-line registration with no special-case logic. No controllers yet — pages are
 * frontend placeholders.
 */
@Module({})
export class PlatformAdminModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(platformAdminApplication);
  }
}
