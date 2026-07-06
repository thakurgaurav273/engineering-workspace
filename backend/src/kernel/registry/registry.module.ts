import { Global, Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { RegistryController } from './registry.controller';
import { CORE_MANIFEST } from './core.manifest';

/**
 * Global application registry. Exposes {@link RegistryService} so any app module can
 * self-register its manifest, and registers the platform's own core (Workspace/Settings)
 * navigation on boot.
 */
@Global()
@Module({
  controllers: [RegistryController],
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(CORE_MANIFEST);
  }
}
