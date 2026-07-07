import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { LinearIntegrationModule } from '@/platform/integrations/linear/linear-integration.module';

@Module({
  imports: [LinearIntegrationModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
