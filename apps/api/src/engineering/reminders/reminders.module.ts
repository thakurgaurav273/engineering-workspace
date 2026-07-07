import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { NotificationsModule } from '@/platform/notifications/notifications.module';
import { ReviewsModule } from '@/engineering/reviews/reviews.module';
import { DashboardModule } from '@/engineering/dashboard/dashboard.module';

@Module({
  imports: [NotificationsModule, ReviewsModule, DashboardModule],
  providers: [RemindersService],
})
export class RemindersModule {}
