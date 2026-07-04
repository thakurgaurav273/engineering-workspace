import { Module } from '@nestjs/common';
import { LinearIntegrationController } from './linear-integration.controller';
import { LinearIntegrationService } from './linear-integration.service';
import { LinearSyncService } from './linear-sync.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LinearIntegrationController],
  providers: [LinearIntegrationService, LinearSyncService],
  exports: [LinearIntegrationService, LinearSyncService],
})
export class LinearIntegrationModule {}
