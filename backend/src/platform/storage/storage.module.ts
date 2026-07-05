import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global so any feature module can inject StorageService without re-importing.
 * Keep it generic - feature-specific key layout and authorization live in the
 * feature service, not here.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
