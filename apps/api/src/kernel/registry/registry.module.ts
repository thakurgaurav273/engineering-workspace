import { Global, Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { RegistryController } from './registry.controller';
import { coreApplication } from './core.manifest';

/**
 * Global Application Registry. Exposes {@link RegistryService} so any app module can
 * register itself, and registers the platform's own core (Workspace/Settings) chrome.
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
    this.registry.register(coreApplication);
  }
}
