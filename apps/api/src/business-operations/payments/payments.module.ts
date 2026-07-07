import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * Business Operations — Payments. Self-contained: operates directly on Invoice +
 * Payment via Prisma. No Tax Engine, no numbering — the Invoice owns totals.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
