import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoalStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

type Period = 'week' | 'month' | 'quarter';
type Trend = 'up' | 'down' | 'same';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private prisma: PrismaService) {}

  private getPeriodStart(period: Period): Date {
    const now = new Date();
    switch (period) {
      case 'week': {
        const day = now.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day;
        const d = new Date(now);
        d.setUTCDate(now.getUTCDate() + diff);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      case 'month': {
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      }
      case 'quarter': {
        const q = Math.floor(now.getUTCMonth() / 3);
        return new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
      }
      default:
        throw new BadRequestException('Invalid period. Use: week, month, or quarter');
    }
  }

  private getPossibleCheckInDays(periodStart: Date, now: Date): number {
    let count = 0;
    const cur = new Date(periodStart);
    while (cur <= now) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return Math.max(count, 1);
  }

  async getLeaderboard(orgId: string, period: Period = 'week') {
    const periodStart = this.getPeriodStart(period);
    const now = new Date();
    const possibleDays = this.getPossibleCheckInDays(periodStart, now);

    const users = await this.prisma.user.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        jobTitle: true,
        department: true,
      },
    });

    const rankings = await Promise.all(
      users.map(async (user) => {
        const [checkInCount, completedGoals, totalGoals, recognitionCount] = await Promise.all([
          this.prisma.checkIn.count({
            where: { userId: user.id, orgId, date: { gte: periodStart } },
          }),
          this.prisma.goal.count({
            where: {
              userId: user.id,
              orgId,
              status: GoalStatus.completed,
              completedAt: { gte: periodStart },
            },
          }),
          this.prisma.goal.count({
            where: {
              userId: user.id,
              orgId,
              createdAt: { lte: now },
              OR: [
                { status: GoalStatus.active },
                { status: GoalStatus.completed },
                { completedAt: { gte: periodStart } },
              ],
            },
          }),
          this.prisma.recognition.count({
            where: { recipientId: user.id, orgId, createdAt: { gte: periodStart } },
          }),
        ]);

        const checkInScore = Math.min(
          100,
          Math.round((checkInCount / possibleDays) * 100),
        );
        const goalScore =
          totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
        const recognitionScore = Math.min(100, recognitionCount * 10);

        // Weighted: 40% check-in + 40% goal + 20% recognition
        const totalScore = Math.round(
          checkInScore * 0.4 + goalScore * 0.4 + recognitionScore * 0.2,
        );

        return {
          user,
          checkInScore,
          goalScore,
          recognitionScore,
          totalScore,
        };
      }),
    );

    // Sort by total score descending
    rankings.sort((a, b) => b.totalScore - a.totalScore);

    // Add rank and compute trend (simplified: no historical data, default 'same')
    const ranked = rankings.map((entry, index) => ({
      rank: index + 1,
      ...entry,
      trend: 'same' as Trend,
    }));

    this.logger.log(`Leaderboard computed for org ${orgId}, period ${period}`);

    return { rankings: ranked, period, periodStart, computedAt: new Date() };
  }
}
