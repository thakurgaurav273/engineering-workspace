import { Module, OnModuleInit } from '@nestjs/common';
import { RegistryService } from '../kernel/registry/registry.service';
import { engineeringApplication } from './engineering.manifest';
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
export class EngineeringModule implements OnModuleInit {
  constructor(private readonly registry: RegistryService) {}

  onModuleInit(): void {
    this.registry.register(engineeringApplication);
  }
}
