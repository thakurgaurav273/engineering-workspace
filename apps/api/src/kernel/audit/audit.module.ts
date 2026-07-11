import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global audit kernel. Exports {@link AuditService} so any privileged controller can record an
 * event without re-importing. Reads are exposed via the platform-admin controller.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
