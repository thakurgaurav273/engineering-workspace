import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { WorkspaceRemindersService } from './workspace-reminders.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceRemindersService],
})
export class WorkspaceModule {}
