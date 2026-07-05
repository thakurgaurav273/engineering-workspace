import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoalStatus, ReviewStatus, MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { LinearIntegrationService } from '@/platform/integrations/linear/linear-integration.service';

type Period = 'week' | 'month' | 'quarter';
type Trend = 'up' | 'down' | 'same';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private prisma: PrismaService,
    private linear: LinearIntegrationService,
  ) {}

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

  async getLeaderboard(
    orgId: string,
    period: Period = 'week',
    search?: string,
    department?: string,
  ) {
    const periodStart = this.getPeriodStart(period);
    const now = new Date();
    const possibleDays = this.getPossibleCheckInDays(periodStart, now);

    const trimmedSearch = search?.trim();

    const [memberships, deptRows] = await Promise.all([
      this.prisma.membership.findMany({
        where: {
          orgId,
          status: MembershipStatus.ACTIVE,
          ...(department && department !== 'all' ? { department } : {}),
          ...(trimmedSearch
            ? {
                OR: [
                  { user: { firstName: { contains: trimmedSearch, mode: 'insensitive' } } },
                  { user: { lastName: { contains: trimmedSearch, mode: 'insensitive' } } },
                  { department: { contains: trimmedSearch, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: {
          jobTitle: true,
          department: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      // Full department list for the filter dropdown - independent of the current
      // search/department filter so switching departments doesn't shrink the list
      // of departments you can switch to.
      this.prisma.membership.findMany({
        where: { orgId, status: MembershipStatus.ACTIVE, department: { not: null } },
        select: { department: true },
        distinct: ['department'],
      }),
    ]);
    const availableDepartments = deptRows
      .map((d) => d.department)
      .filter((d): d is string => !!d)
      .sort();
    const users = memberships.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.jobTitle,
      department: m.department,
    }));

    // One workspace-wide fetch, not one per user - Linear metrics are grouped
    // by assignee email in-memory below. Null means no Linear connection (or
    // the fetch failed), in which case scoring falls back to the original formula.
    const linearByEmail = await this.linear.getCompletedIssuesByEmail(orgId, periodStart);

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

        const linearMetric = linearByEmail?.get(user.email);
        const linearIssuesCompleted = linearMetric?.count ?? 0;
        const linearPoints = linearMetric?.points ?? 0;
        // 10 completed issues (or 10 story points, whichever this team actually tracks) maxes the score.
        const linearScore = linearByEmail
          ? Math.min(100, (linearPoints > 0 ? linearPoints : linearIssuesCompleted) * 10)
          : null;

        // Weighted 40/40/20 (check-in/goal/recognition) by default. Orgs with Linear
        // connected get a rebalanced 30/30/20/20 formula that folds in Linear activity.
        const totalScore = linearScore !== null
          ? Math.round(checkInScore * 0.3 + goalScore * 0.3 + recognitionScore * 0.2 + linearScore * 0.2)
          : Math.round(checkInScore * 0.4 + goalScore * 0.4 + recognitionScore * 0.2);

        return {
          user,
          checkInScore,
          goalScore,
          recognitionScore,
          linearScore,
          linearIssuesCompleted,
          linearPoints,
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

    return { rankings: ranked, period, periodStart, computedAt: new Date(), availableDepartments };
  }
}
