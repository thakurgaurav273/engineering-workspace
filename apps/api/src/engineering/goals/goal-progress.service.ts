import { Injectable, Logger } from '@nestjs/common';
import { GoalStatus, IssueStateCategory } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/** How far a goal's linked work has got - the same rule as a project's progress. */
export interface GoalWork {
  /** Linked issues, counted once even when also in a linked project. */
  total: number;
  done: number;
  canceled: number;
  /** Issues that count: everything but canceled. */
  scope: number;
  /** 0..100, rounded. */
  percent: number;
}

interface LinkedGoal {
  id: string;
  status: GoalStatus;
  progress: number;
  completedAt: Date | null;
  projects: { id: string }[];
  issues: { id: string }[];
}

/** Pure roll-up: done / (all but canceled), over the distinct issues a goal reaches. */
export function workFrom(categories: IssueStateCategory[]): GoalWork {
  const total = categories.length;
  const done = categories.filter((c) => c === 'COMPLETED').length;
  const canceled = categories.filter((c) => c === 'CANCELED').length;
  const scope = total - canceled;
  return { total, done, canceled, scope, percent: scope > 0 ? Math.round((done / scope) * 100) : 0 };
}

/**
 * A goal with linked work (projects and/or issues) is measured by that work: its progress is
 * the share of linked issues done, it completes when all of them are, and it reopens if work
 * reopens. Goals with nothing linked keep manual progress and are left alone here.
 *
 * Progress is stored (not just computed on read) so the dashboard, People and leaderboard -
 * which read goals directly - stay consistent. The tracker calls `syncOrg` after anything
 * that can move an issue between categories (create, update, delete, status edits).
 */
@Injectable()
export class GoalProgressService {
  private readonly logger = new Logger(GoalProgressService.name);

  constructor(private prisma: PrismaService) {}

  /** Linked work for the given goals, without writing anything. */
  async workFor(goals: Pick<LinkedGoal, 'id' | 'projects' | 'issues'>[]): Promise<Map<string, GoalWork>> {
    const linked = goals.filter((g) => g.projects.length || g.issues.length);
    const result = new Map<string, GoalWork>();
    if (!linked.length) return result;

    const projectIds = [...new Set(linked.flatMap((g) => g.projects.map((p) => p.id)))];
    const issueIds = [...new Set(linked.flatMap((g) => g.issues.map((i) => i.id)))];
    const rows = await this.prisma.issue.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
          ...(issueIds.length ? [{ id: { in: issueIds } }] : []),
        ],
      },
      select: { id: true, projectId: true, state: { select: { category: true } } },
    });

    for (const goal of linked) {
      const projects = new Set(goal.projects.map((p) => p.id));
      const direct = new Set(goal.issues.map((i) => i.id));
      const reached = rows.filter((r) => direct.has(r.id) || (r.projectId && projects.has(r.projectId)));
      result.set(goal.id, workFrom(reached.map((r) => r.state.category)));
    }
    return result;
  }

  /** Re-measures every goal in the org that has linked work, storing what changed. */
  async syncOrg(orgId: string): Promise<void> {
    try {
      const goals = await this.prisma.goal.findMany({
        where: {
          orgId,
          status: { not: GoalStatus.archived },
          OR: [{ projects: { some: {} } }, { issues: { some: {} } }],
        },
        select: {
          id: true,
          status: true,
          progress: true,
          completedAt: true,
          projects: { select: { id: true } },
          issues: { select: { id: true } },
        },
      });
      await this.apply(goals);
    } catch (error) {
      // Never fail the tracker write that triggered this; the next sync catches up.
      this.logger.error(`Goal sync failed for org ${orgId}`, error as Error);
    }
  }

  /** Re-measures specific goals (after their links change). */
  async syncGoals(goalIds: string[]): Promise<void> {
    if (!goalIds.length) return;
    const goals = await this.prisma.goal.findMany({
      where: { id: { in: goalIds }, status: { not: GoalStatus.archived } },
      select: {
        id: true,
        status: true,
        progress: true,
        completedAt: true,
        projects: { select: { id: true } },
        issues: { select: { id: true } },
      },
    });
    await this.apply(goals.filter((g) => g.projects.length || g.issues.length));
  }

  private async apply(goals: LinkedGoal[]): Promise<void> {
    const work = await this.workFor(goals);
    for (const goal of goals) {
      const w = work.get(goal.id);
      if (!w) continue;
      const finished = w.scope > 0 && w.done === w.scope;
      const status = finished ? GoalStatus.completed : GoalStatus.active;
      if (goal.progress === w.percent && goal.status === status) continue;

      const note =
        status !== goal.status
          ? finished
            ? `Completed - all ${w.scope} linked issues are done`
            : `Reopened - ${w.scope - w.done} of ${w.scope} linked issues ${w.scope - w.done === 1 ? 'is' : 'are'} open again`
          : `From linked work: ${w.done} of ${w.scope} issues done`;
      await this.prisma.$transaction([
        this.prisma.goal.update({
          where: { id: goal.id },
          data: {
            progress: w.percent,
            status,
            completedAt: finished ? (goal.completedAt ?? new Date()) : null,
          },
        }),
        this.prisma.goalHistory.create({ data: { goalId: goal.id, progress: w.percent, note } }),
      ]);
    }
  }
}
