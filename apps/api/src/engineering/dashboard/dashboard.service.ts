import { Injectable, Logger } from '@nestjs/common';
import { GoalStatus, ReviewStatus, MembershipStatus } from '@prisma/client';
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

  private async getReportUserIds(managerUserId: string, orgId: string): Promise<string[]> {
    const managerMembership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: managerUserId, orgId } },
    });
    if (!managerMembership) return [];
    const reports = await this.prisma.membership.findMany({
      where: { managerId: managerMembership.id },
      select: { userId: true },
    });
    return reports.map((r) => r.userId);
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

    const reportIds = await this.getReportUserIds(userId, orgId);

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
      recentTaskUpdates,
      workspacePending,
      workspaceInProgress,
      workspaceOverdue,
      workspaceDueToday,
    ] = await Promise.all([
      // Total active users in org
      this.prisma.membership.count({ where: { orgId, status: MembershipStatus.ACTIVE } }),

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

      // Recent task updates from this user's direct reports (empty if they have none)
      this.prisma.taskUpdate.findMany({
        where: { orgId, isDeleted: false, authorId: { in: reportIds } },
        select: {
          id: true,
          body: true,
          status: true,
          progress: true,
          createdAt: true,
          author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          issue: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // My Workspace widget - this user's own action items only.
      this.prisma.workspaceItem.count({
        where: { orgId, ownerId: userId, deletedAt: null, archivedAt: null, status: 'PENDING' },
      }),
      this.prisma.workspaceItem.count({
        where: { orgId, ownerId: userId, deletedAt: null, archivedAt: null, status: 'IN_PROGRESS' },
      }),
      this.prisma.workspaceItem.count({
        where: {
          orgId,
          ownerId: userId,
          deletedAt: null,
          archivedAt: null,
          status: { not: 'DONE' },
          dueDate: { lt: today },
        },
      }),
      this.prisma.workspaceItem.count({
        where: {
          orgId,
          ownerId: userId,
          deletedAt: null,
          archivedAt: null,
          dueDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
        },
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
      recentTaskUpdates,
      recentRecognitions,
      topContributors,
      workspace: {
        pending: workspacePending,
        inProgress: workspaceInProgress,
        overdue: workspaceOverdue,
        dueToday: workspaceDueToday,
      },
    };
  }

  // Quotes a field only when it contains something that would otherwise break the
  // CSV grammar (comma, quote, or newline) - keeps plain fields readable unquoted.
  private csvField(value: string | number): string {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  private csvRow(fields: (string | number)[]): string {
    return fields.map((f) => this.csvField(f)).join(',');
  }

  async exportCsv(userId: string, orgId: string): Promise<string> {
    const dash = await this.getDashboard(userId, orgId);
    const lines: string[] = [];

    lines.push('Summary metric,Value');
    lines.push(this.csvRow(['Check-in rate (%)', dash.checkInRate]));
    lines.push(this.csvRow(['Blocked today', dash.blockedMembers]));
    lines.push(this.csvRow(['Pending reviews', dash.pendingReviews]));
    lines.push(this.csvRow(['Open goals', dash.activeGoals]));
    lines.push(this.csvRow(['Recognitions this week', dash.recognitionCount]));
    lines.push(this.csvRow(['Avg performance score (30d)', dash.avgPerformanceScore]));
    lines.push('');

    lines.push('Goal distribution,Count');
    lines.push(this.csvRow(['Active', dash.goalDistribution.active]));
    lines.push(this.csvRow(['Completed', dash.goalDistribution.completed]));
    lines.push(this.csvRow(['Archived', dash.goalDistribution.archived]));
    lines.push('');

    lines.push('Date,Check-ins');
    for (const t of dash.weeklyTrends) {
      const date = t.date instanceof Date ? t.date.toISOString().slice(0, 10) : String(t.date);
      lines.push(this.csvRow([date, t.count]));
    }
    lines.push('');

    lines.push('Top contributor,Job title,Department,Check-in streak (7d),Goal completion (%)');
    for (const c of dash.topContributors) {
      lines.push(
        this.csvRow([
          `${c.user.firstName} ${c.user.lastName}`,
          c.user.jobTitle ?? '',
          c.user.department ?? '',
          c.checkInStreak,
          c.goalCompletion,
        ]),
      );
    }
    lines.push('');

    lines.push('Recent recognition recipient,From,Title,Date');
    for (const r of dash.recentRecognitions) {
      lines.push(
        this.csvRow([
          `${r.recipient.firstName} ${r.recipient.lastName}`,
          `${r.author.firstName} ${r.author.lastName}`,
          r.title,
          r.createdAt.toISOString(),
        ]),
      );
    }

    return lines.join('\n');
  }

  private async computeTopContributors(orgId: string, since: Date) {
    const memberships = await this.prisma.membership.findMany({
      where: { orgId, status: MembershipStatus.ACTIVE },
      select: {
        jobTitle: true,
        department: true,
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      take: 20,
    });
    const users = memberships.map((m) => ({
      id: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      avatarUrl: m.user.avatarUrl,
      jobTitle: m.jobTitle,
      department: m.department,
    }));

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
