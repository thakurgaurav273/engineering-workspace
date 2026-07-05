import { Module } from '@nestjs/common';
import { CheckInsModule } from './check-ins/check-ins.module';
import { GoalsModule } from './goals/goals.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RecognitionModule } from './recognition/recognition.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PeopleModule } from './people/people.module';
import { TaskUpdatesModule } from './task-updates/task-updates.module';
import { SearchModule } from './search/search.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    CheckInsModule,
    GoalsModule,
    ReviewsModule,
    RecognitionModule,
    DashboardModule,
    LeaderboardModule,
    PeopleModule,
    TaskUpdatesModule,
    SearchModule,
    RemindersModule,
  ],
})
export class EngineeringModule {}
