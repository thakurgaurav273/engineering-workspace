import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoalStatus, ReviewStatus, MembershipStatus, WorkspaceStatus } from '@prisma/client';
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

    // Linear connection is org-wide; the card's Linear stat is only shown when connected.
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { linearApiKey: true },
    });
    const linearConnected = !!org?.linearApiKey;

    const rankings = await Promise.all(
      users.map(async (user) => {
        const [
          checkInCount,
          completedGoals,
          totalGoals,
          recognitionCount,
          taskUpdateCount,
          completedItems,
          linearIssuesAssigned,
        ] = await Promise.all([
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
          // Regular task-update postings authored this period (deleted ones don't count).
          this.prisma.taskUpdate.count({
            where: { authorId: user.id, orgId, isDeleted: false, createdAt: { gte: periodStart } },
          }),
          // Workspace items this person completed this period, with the data we need to
          // judge whether each was delivered on time (completedAt vs its dueDate).
          this.prisma.workspaceItem.findMany({
            where: {
              ownerId: user.id,
              orgId,
              deletedAt: null,
              status: WorkspaceStatus.DONE,
              completedAt: { gte: periodStart },
            },
            select: { completedAt: true, dueDate: true },
          }),
          // Currently-assigned Linear tickets (mirrors the person-detail list, by assigneeId).
          linearConnected
            ? this.prisma.linearIssue.count({
                where: { orgId, assigneeId: user.id, archivedAt: null },
              })
            : Promise.resolve(0),
        ]);

        const checkInScore = Math.min(100, Math.round((checkInCount / possibleDays) * 100));
        const goalScore = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
        const recognitionScore = Math.min(100, recognitionCount * 10);
        // Five substantive updates in the period maxes this out.
        const taskUpdateScore = Math.min(100, taskUpdateCount * 20);

        // On-time delivery: share of completed items finished on or before their due date.
        // Items with no due date count as on time. Zero completions scores zero.
        const totalCompleted = completedItems.length;
        const onTimeCompleted = completedItems.filter(
          (i) => !i.dueDate || (i.completedAt !== null && i.completedAt <= i.dueDate),
        ).length;
        const onTimeCompletionScore =
          totalCompleted > 0 ? Math.round((onTimeCompleted / totalCompleted) * 100) : 0;

        // Delivery-focused: on-time completion 40%, task updates / check-ins / recognition 20% each.
        const totalScore = Math.round(
          onTimeCompletionScore * 0.4 +
            taskUpdateScore * 0.2 +
            checkInScore * 0.2 +
            recognitionScore * 0.2,
        );

        return {
          user,
          checkInScore,
          goalScore,
          recognitionScore,
          taskUpdateScore,
          taskUpdateCount,
          onTimeCompletionScore,
          workspaceCompleted: totalCompleted,
          // Kept non-null only as the "Linear connected" signal the card gates on.
          linearScore: linearConnected ? Math.min(100, linearIssuesAssigned * 10) : null,
          linearIssuesAssigned,
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
