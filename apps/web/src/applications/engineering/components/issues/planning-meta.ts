import type { CycleState, ProjectStatus } from "@/applications/engineering/lib/issues";

type Tone = "neutral" | "info" | "success" | "warning";

export const PROJECT_STATUS_TONE: Record<ProjectStatus, Tone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "info",
  PAUSED: "warning",
  COMPLETED: "success",
  CANCELED: "neutral",
};

export const CYCLE_STATE_LABEL: Record<CycleState, string> = {
  current: "Current",
  upcoming: "Upcoming",
  past: "Ended",
  completed: "Completed",
};

export const CYCLE_STATE_TONE: Record<CycleState, Tone> = {
  current: "info",
  upcoming: "neutral",
  past: "warning",
  completed: "success",
};

/** yyyy-mm-dd in local time, for <input type="date">. */
export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
