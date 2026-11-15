import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalProgressService } from './goal-progress.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GoalsController],
  providers: [GoalsService, GoalProgressService],
  // The tracker re-measures linked goals whenever issues move.
  exports: [GoalProgressService],
})
export class GoalsModule {}
