import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { WorkspaceRemindersService } from './workspace-reminders.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TeamController, WorkspaceController],
  providers: [WorkspaceService, WorkspaceRemindersService, TeamService],
})
export class WorkspaceModule {}
