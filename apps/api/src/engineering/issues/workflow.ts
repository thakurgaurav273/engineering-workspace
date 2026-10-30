import { IssueStateCategory, Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";

/** Categories that still count as open work (excluded: COMPLETED, CANCELED). */
export const OPEN_CATEGORIES: IssueStateCategory[] = ["BACKLOG", "UNSTARTED", "STARTED"];

/** Workflow order of the categories; a team's states sort by this, then by position. */
export const CATEGORY_ORDER: IssueStateCategory[] = ["BACKLOG", "UNSTARTED", "STARTED", "COMPLETED", "CANCELED"];

/** Seeded for every new team (the migration gave existing teams the same set). */
export const DEFAULT_STATES: { name: string; color: string; category: IssueStateCategory; position: number }[] = [
  { name: "Backlog", color: "#94a3b8", category: "BACKLOG", position: 0 },
  { name: "Todo", color: "#94a3b8", category: "UNSTARTED", position: 0 },
  { name: "In Progress", color: "#f59e0b", category: "STARTED", position: 0 },
  { name: "In Review", color: "#10b981", category: "STARTED", position: 1 },
  { name: "Done", color: "#6366f1", category: "COMPLETED", position: 0 },
  { name: "Canceled", color: "#64748b", category: "CANCELED", position: 0 },
];

export const stateSelect = {
  id: true,
  teamId: true,
  name: true,
  color: true,
  category: true,
  position: true,
} satisfies Prisma.IssueStateSelect;

export function sortStates<T extends { category: IssueStateCategory; position: number }>(states: T[]): T[] {
  return [...states].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.position - b.position,
  );
}

export type IssueProgress = {
  total: number;
  done: number;
  started: number;
  canceled: number;
  /** done / (total - canceled), 0..1 */
  percent: number;
};

export function progressFrom(counts: Partial<Record<IssueStateCategory, number>>): IssueProgress {
  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const done = counts.COMPLETED ?? 0;
  const canceled = counts.CANCELED ?? 0;
  const started = counts.STARTED ?? 0;
  const scope = total - canceled;
  return { total, done, started, canceled, percent: scope > 0 ? done / scope : 0 };
}

/** Progress of the issues grouped under each project or cycle id. */
export async function progressBy(
  prisma: PrismaService,
  key: "projectId" | "cycleId",
  ids: string[],
): Promise<Map<string, IssueProgress>> {
  if (!ids.length) return new Map();
  const rows = await prisma.issue.groupBy({
    by: [key, "stateId"],
    where: { [key]: { in: ids }, deletedAt: null },
    _count: { _all: true },
  });
  const states = await prisma.issueState.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.stateId))] } },
    select: { id: true, category: true },
  });
  const categoryOf = new Map(states.map((s) => [s.id, s.category]));
  const counts = new Map<string, Partial<Record<IssueStateCategory, number>>>();
  for (const row of rows) {
    const owner = row[key] as string;
    const category = categoryOf.get(row.stateId)!;
    const entry = counts.get(owner) ?? {};
    entry[category] = (entry[category] ?? 0) + row._count._all;
    counts.set(owner, entry);
  }
  return new Map(ids.map((id) => [id, progressFrom(counts.get(id) ?? {})]));
}
