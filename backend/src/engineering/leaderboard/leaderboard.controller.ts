import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '@/common/decorators/current-user.decorator';

@ApiTags('leaderboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get computed org leaderboard for a given period' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  getLeaderboard(
    @CurrentUser() user: JwtPayload,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'week',
  ) {
    return this.leaderboardService.getLeaderboard(user.orgId, period);
  }
}
