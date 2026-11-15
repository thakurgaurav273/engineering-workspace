import type { IssueStateCategory, ProjectStatus } from "@/applications/engineering/lib/issues";

// Goals are outcomes. Linked to projects and/or issues, a goal is measured by that work: its
// progress is the share of linked issues done (canceled ones don't count) and it completes
// when they all are - see apps/api/src/engineering/goals/goal-progress.service.ts. Without
// linked work, progress is set by hand.

export type GoalStatus = "active" | "completed" | "archived";

export interface GoalWork {
  total: number;
  done: number;
  canceled: number;
  /** Issues that count: everything but canceled. */
  scope: number;
  percent: number;
}

export interface GoalProjectLink {
  id: string;
  name: string;
  status: ProjectStatus;
}

export interface GoalIssueLink {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; color: string; category: IssueStateCategory };
}

export interface GoalItem {
  id: string;
  title: string;
  description?: string | null;
  progress: number;
  status: GoalStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  orgId: string;
  visibility: "personal" | "team";
  assignedById?: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  assignedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  } | null;
  projects: GoalProjectLink[];
  issues: GoalIssueLink[];
  /** How far the linked work has got; null when progress is set by hand. */
  work: GoalWork | null;
}

/** A goal summary as a project shows it ("serves …"). */
export interface ProjectGoalRef {
  id: string;
  title: string;
  status: GoalStatus;
  progress: number;
}

export function isLinked(goal: Pick<GoalItem, "projects" | "issues">): boolean {
  return goal.projects.length > 0 || goal.issues.length > 0;
}
