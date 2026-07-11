import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Business Operations - Dashboard. Read-only analytics aggregation over existing
 * tables. No models, no numbering, no tax.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
