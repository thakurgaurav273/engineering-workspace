import { Injectable, Logger } from '@nestjs/common';
import { GoalStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diff);
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
  }

  async getDashboard(userId: string, orgId: string) {
    const weekStart = this.getWeekStart();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [
      totalUsers,
      weekCheckIns,
      blockedCount,
      pendingReviews,
      activeGoals,
      weekRecognitions,
      avgRatingResult,
      goalDistribution,
      recentRecognitions,
      dailyCounts,
    ] = await Promise.all([
      // Total active users in org
      this.prisma.user.count({ where: { orgId, isActive: true } }),

      // Check-ins this week
      this.prisma.checkIn.count({
        where: { orgId, date: { gte: weekStart } },
      }),

      // Blocked members (latest check-in status = blocked)
      this.prisma.checkIn.count({
        where: { orgId, date: today, status: 'blocked' },
      }),

      // Pending reviews for current user
      this.prisma.weeklyReview.count({
        where: { reviewerId: userId, orgId, status: ReviewStatus.draft },
      }),

      // Active goals count
      this.prisma.goal.count({ where: { orgId, status: GoalStatus.active } }),

      // Recognitions this week
      this.prisma.recognition.count({
        where: { orgId, createdAt: { gte: weekStart } },
      }),

      // Avg performance rating (last 30 days submitted reviews)
      this.prisma.weeklyReview.aggregate({
        where: {
          orgId,
          status: ReviewStatus.submitted,
          submittedAt: { gte: thirtyDaysAgo },
          rating: { not: null },
        },
        _avg: { rating: true },
      }),

      // Goal distribution by status
      this.prisma.goal.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      }),

      // Recent recognitions (last 5)
      this.prisma.recognition.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          note: true,
          createdAt: true,
          author: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          recipient: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      }),

      // Daily check-in counts for last 7 days
      this.prisma.checkIn.groupBy({
        by: ['date'],
        where: { orgId, date: { gte: sevenDaysAgo } },
        _count: true,
        orderBy: { date: 'asc' },
      }),
    ]);

    // Compute check-in rate for this week
    const possibleCheckIns = totalUsers * 5; // Mon-Fri
    const checkInRate =
      possibleCheckIns > 0 ? Math.round((weekCheckIns / possibleCheckIns) * 100) : 0;

    // Build goal distribution map
    const goalDist = { active: 0, completed: 0, archived: 0 };
    for (const g of goalDistribution) {
      goalDist[g.status as keyof typeof goalDist] = g._count;
    }

    // Compute top contributors (by check-in streak and goal completion)
    const topContributors = await this.computeTopContributors(orgId, sevenDaysAgo);

    return {
      checkInRate,
      blockedMembers: blockedCount,
      pendingReviews,
      activeGoals,
      recognitionCount: weekRecognitions,
      avgPerformanceScore: Math.round((avgRatingResult._avg.rating ?? 0) * 10) / 10,
      weeklyTrends: dailyCounts.map((d) => ({ date: d.date, count: d._count })),
      goalDistribution: goalDist,
      recentRecognitions,
      topContributors,
    };
  }

  private async computeTopContributors(orgId: string, since: Date) {
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
      take: 20,
    });

    const contributors = await Promise.all(
      users.map(async (user) => {
        const [checkInCount, completedGoals, totalGoals] = await Promise.all([
          this.prisma.checkIn.count({ where: { userId: user.id, orgId, date: { gte: since } } }),
          this.prisma.goal.count({
            where: { userId: user.id, orgId, status: GoalStatus.completed },
          }),
          this.prisma.goal.count({ where: { userId: user.id, orgId } }),
        ]);

        const goalCompletion = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

        return {
          user,
          checkInStreak: checkInCount,
          goalCompletion,
          score: checkInCount * 10 + goalCompletion,
        };
      }),
    );

    return contributors
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score: _score, ...c }) => c);
  }
}
