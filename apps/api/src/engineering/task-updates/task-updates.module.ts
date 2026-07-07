import { Module } from '@nestjs/common';
import { TaskUpdatesController } from './task-updates.controller';
import { TaskUpdatesService } from './task-updates.service';
import { LinearIntegrationModule } from '@/platform/integrations/linear/linear-integration.module';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [LinearIntegrationModule, NotificationsModule],
  controllers: [TaskUpdatesController],
  providers: [TaskUpdatesService],
})
export class TaskUpdatesModule {}
