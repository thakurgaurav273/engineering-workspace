import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoalStatus, MembershipStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { contributionFor, workdaysBetween } from './contribution-score';

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

  async getLeaderboard(
    orgId: string,
    period: Period = 'week',
    search?: string,
    department?: string,
  ) {
    const periodStart = this.getPeriodStart(period);
    const now = new Date();
    const possibleDays = workdaysBetween(periodStart, now);

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

    // Scored by the shared contribution formula (contribution-score.ts): delivery on assigned
    // issues 70%, check-ins / issue updates / recognition 10% each.
    const rankings = await Promise.all(
      users.map(async (user) => {
        const [c, completedGoals, totalGoals] = await Promise.all([
          contributionFor(this.prisma, { orgId, userId: user.id, since: periodStart, now, possibleDays }),
          // Goal completion is shown on People cards; it isn't part of the score.
          this.prisma.goal.count({
            where: { userId: user.id, orgId, status: GoalStatus.completed, completedAt: { gte: periodStart } },
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
        ]);
        return {
          user,
          totalScore: c.total,
          deliveryScore: c.delivery.score,
          issuesCompleted: c.delivery.completed,
          issuesOnTime: c.delivery.onTime,
          issuesLate: c.delivery.late,
          issuesOverdue: c.delivery.overdue,
          checkInScore: c.checkIns.score,
          checkInCount: c.checkIns.count,
          updateScore: c.updates.score,
          updateDays: c.updates.days,
          recognitionScore: c.recognition.score,
          recognitionCount: c.recognition.count,
          goalScore: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
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
