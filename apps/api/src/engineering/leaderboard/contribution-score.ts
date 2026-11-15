import { IssueStateCategory } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Contribution score - the one formula behind the Leaderboard, People rankings and the
 * dashboard's top contributors, so a person shows the same score everywhere.
 *
 *   70% delivery     - issues assigned to them in our own tracker: done, and done on time
 *   10% check-ins    - share of working days with a check-in
 *   10% updates      - share of working days they posted an update (comment) on an issue
 *   10% recognition  - recognitions received (10 maxes it out)
 */
export const SCORE_WEIGHTS = { delivery: 0.7, checkIns: 0.1, updates: 0.1, recognition: 0.1 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN: IssueStateCategory[] = ['BACKLOG', 'UNSTARTED', 'STARTED'];

/** Weekdays from `since` through `now` (UTC), at least 1 so scores never divide by zero. */
export function workdaysBetween(since: Date, now: Date): number {
  let count = 0;
  const cur = new Date(since);
  while (cur <= now) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Math.max(count, 1);
}

export interface DeliveryInput {
  /** Assigned issues completed in the period. */
  completed: { completedAt: Date | null; dueDate: Date | null }[];
  /** Assigned issues still open whose due date fell in the period and has passed. */
  overdueOpen: number;
}

/**
 * Due-date-aware delivery. Each issue judged this period earns: done on time (or with no
 * due date) 1, done late 0.5, still open past its due date 0. Due dates are calendar days,
 * so finishing any time on the due date counts as on time. Nothing judged scores 0.
 */
export function deliveryScore({ completed, overdueOpen }: DeliveryInput) {
  const onTime = completed.filter(
    (i) => !i.dueDate || (i.completedAt !== null && i.completedAt.getTime() < i.dueDate.getTime() + DAY_MS),
  ).length;
  const late = completed.length - onTime;
  const judged = completed.length + overdueOpen;
  const score = judged > 0 ? Math.round(((onTime + late * 0.5) / judged) * 100) : 0;
  return { score, completed: completed.length, onTime, late, overdue: overdueOpen };
}

/** Share of working days with at least one event (a weekend post still counts; capped at 100). */
export function cadenceScore(timestamps: Date[], possibleDays: number) {
  const days = new Set(timestamps.map((t) => t.toISOString().slice(0, 10))).size;
  return { score: Math.min(100, Math.round((days / possibleDays) * 100)), days };
}

export function recognitionScore(count: number): number {
  return Math.min(100, count * 10);
}

export function totalScore(parts: { delivery: number; checkIns: number; updates: number; recognition: number }) {
  return Math.round(
    parts.delivery * SCORE_WEIGHTS.delivery +
      parts.checkIns * SCORE_WEIGHTS.checkIns +
      parts.updates * SCORE_WEIGHTS.updates +
      parts.recognition * SCORE_WEIGHTS.recognition,
  );
}

/** Loads one person's activity for the period and scores it. */
export async function contributionFor(
  prisma: PrismaService,
  args: { orgId: string; userId: string; since: Date; now: Date; possibleDays: number },
) {
  const { orgId, userId, since, now, possibleDays } = args;
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [checkInCount, recognitionCount, completed, overdueOpen, updates] = await Promise.all([
    prisma.checkIn.count({ where: { userId, orgId, date: { gte: since } } }),
    prisma.recognition.count({ where: { recipientId: userId, orgId, createdAt: { gte: since } } }),
    prisma.issue.findMany({
      where: {
        orgId,
        assigneeId: userId,
        deletedAt: null,
        completedAt: { gte: since },
        state: { category: 'COMPLETED' },
      },
      select: { completedAt: true, dueDate: true },
    }),
    // Overdue = due date already passed. Only due dates inside the period are judged, so an
    // old miss doesn't drag every future period down.
    prisma.issue.count({
      where: {
        orgId,
        assigneeId: userId,
        deletedAt: null,
        archivedAt: null,
        dueDate: { gte: since, lt: startOfToday },
        state: { category: { in: OPEN } },
      },
    }),
    prisma.issueComment.findMany({
      where: { authorId: userId, createdAt: { gte: since }, issue: { orgId, deletedAt: null } },
      select: { createdAt: true },
    }),
  ]);

  const delivery = deliveryScore({ completed, overdueOpen });
  const checkIns = { score: Math.min(100, Math.round((checkInCount / possibleDays) * 100)), count: checkInCount };
  const issueUpdates = cadenceScore(
    updates.map((u) => u.createdAt),
    possibleDays,
  );
  const recognition = { score: recognitionScore(recognitionCount), count: recognitionCount };

  return {
    delivery,
    checkIns,
    updates: { ...issueUpdates, count: updates.length },
    recognition,
    total: totalScore({
      delivery: delivery.score,
      checkIns: checkIns.score,
      updates: issueUpdates.score,
      recognition: recognition.score,
    }),
  };
}
