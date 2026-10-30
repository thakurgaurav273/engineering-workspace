import { api, type Paginated } from "@/shared/lib/api";

// Mirrors apps/api/src/engineering/issues. The built-in, Linear-style tracker used by orgs
// that haven't connected Linear (those keep Task Updates).

export type IssueStateCategory = "BACKLOG" | "UNSTARTED" | "STARTED" | "COMPLETED" | "CANCELED";
export type IssuePriority = "NONE" | "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type ProjectStatus = "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELED";
export type TeamRole = "LEAD" | "MEMBER";
export type CycleState = "upcoming" | "current" | "past" | "completed";

/** Workflow order of the categories behind every team's custom statuses. */
export const STATE_CATEGORIES: IssueStateCategory[] = [
  "BACKLOG",
  "UNSTARTED",
  "STARTED",
  "COMPLETED",
  "CANCELED",
];
export const OPEN_CATEGORIES: IssueStateCategory[] = ["BACKLOG", "UNSTARTED", "STARTED"];
/** Linear's menu order: urgent first, "No priority" last. */
export const ISSUE_PRIORITIES: IssuePriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];
export const PROJECT_STATUSES: ProjectStatus[] = [
  "PLANNED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "CANCELED",
];

export const CATEGORY_LABEL: Record<IssueStateCategory, string> = {
  BACKLOG: "Backlog",
  UNSTARTED: "Unstarted",
  STARTED: "Started",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
  NONE: "No priority",
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_RANK: Record<IssuePriority, number> = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  NONE: 5,
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

/** One of a team's workflow statuses. */
export interface IssueState {
  id: string;
  teamId: string;
  name: string;
  color: string;
  category: IssueStateCategory;
  position: number;
  issueCount?: number;
}

export interface IssueLabel {
  id: string;
  name: string;
  color: string;
  teamId?: string | null;
}

export interface Issue {
  id: string;
  identifier: string;
  number: number;
  teamId: string;
  title: string;
  stateId: string;
  state: IssueState;
  priority: IssuePriority;
  estimate: number | null;
  dueDate: string | null;
  sortOrder: number;
  creatorId: string;
  assigneeId: string | null;
  projectId: string | null;
  cycleId: string | null;
  parentId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  team: { id: string; key: string; name: string };
  assignee: Person | null;
  creator: Person;
  project: { id: string; name: string } | null;
  cycle: { id: string; number: number; name: string | null } | null;
  parent: { id: string; title: string; identifier: string } | null;
  labels: IssueLabel[];
  _count: { children: number };
}

export interface IssueActivity {
  id: string;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
  actor: Person;
}

export interface IssueDetail extends Issue {
  description: string | null;
  subIssues: Issue[];
  subIssueProgress: { done: number; total: number };
  activity: IssueActivity[];
}

export interface IssueComment {
  id: string;
  issueId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Person;
}

export interface Team {
  id: string;
  name: string;
  key: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  myRole: TeamRole | null;
  memberCount: number;
  openIssueCount: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  user: Person;
}

export interface TeamDetail extends Omit<Team, "myRole" | "memberCount" | "openIssueCount"> {
  members: TeamMember[];
}

export interface IssueProgress {
  total: number;
  done: number;
  started: number;
  canceled: number;
  /** 0..1 */
  percent: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  leadId: string | null;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  lead: Person | null;
  teams: { id: string; key: string; name: string }[];
  progress: IssueProgress;
}

export interface Cycle {
  id: string;
  teamId: string;
  number: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  completedAt: string | null;
  state: CycleState;
  progress: IssueProgress;
  team?: { id: string; key: string; name: string };
}

export interface ListIssuesParams {
  teamId?: string;
  stateId?: string[];
  category?: IssueStateCategory[];
  priority?: IssuePriority[];
  /** user id, "me" or "none" */
  assigneeId?: string;
  creatorId?: string;
  /** project id or "none" */
  projectId?: string;
  /** cycle id, "current" (with teamId) or "none" */
  cycleId?: string;
  labelId?: string;
  parentId?: string;
  search?: string;
  topLevelOnly?: boolean;
  activeOnly?: boolean;
  archived?: boolean;
  orderBy?: "priority" | "updated" | "created" | "dueDate" | "manual";
  limit?: number;
}

export interface CreateIssueInput {
  teamId: string;
  title: string;
  description?: string;
  /** Defaults to the team's first unstarted status. */
  stateId?: string;
  priority?: IssuePriority;
  estimate?: number | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  cycleId?: string | null;
  parentId?: string | null;
  labelIds?: string[];
}

export type UpdateIssueInput = Partial<CreateIssueInput> & { sortOrder?: number };

export interface ProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  leadId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  teamIds?: string[];
}

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const issuesApi = {
  list: (params: ListIssuesParams = {}) => api.get<Paginated<Issue>>(`/issues${query(params)}`),
  mine: () => api.get<{ assigned: Issue[]; delegated: Issue[] }>("/issues/mine"),
  getOne: (idOrIdentifier: string) => api.get<IssueDetail>(`/issues/${idOrIdentifier}`),
  create: (body: CreateIssueInput) => api.post<Issue>("/issues", body),
  update: (id: string, body: UpdateIssueInput) => api.patch<Issue>(`/issues/${id}`, body),
  archive: (id: string) => api.patch<Issue>(`/issues/${id}/archive`),
  unarchive: (id: string) => api.patch<Issue>(`/issues/${id}/unarchive`),
  remove: (id: string) => api.delete<{ message: string }>(`/issues/${id}`),
  comments: (id: string) => api.get<IssueComment[]>(`/issues/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.post<IssueComment>(`/issues/${id}/comments`, { body }),
  editComment: (id: string, commentId: string, body: string) =>
    api.patch<IssueComment>(`/issues/${id}/comments/${commentId}`, { body }),
  deleteComment: (id: string, commentId: string) =>
    api.delete<{ message: string }>(`/issues/${id}/comments/${commentId}`),
};

export const teamsApi = {
  list: (includeArchived = false) => api.get<Team[]>(`/issues/teams${query({ includeArchived })}`),
  getOne: (id: string) => api.get<TeamDetail>(`/issues/teams/${id}`),
  create: (body: { name: string; key: string; description?: string }) =>
    api.post<Team>("/issues/teams", body),
  update: (id: string, body: { name?: string; key?: string; description?: string }) =>
    api.patch<Team>(`/issues/teams/${id}`, body),
  archive: (id: string) => api.patch<Team>(`/issues/teams/${id}/archive`),
  unarchive: (id: string) => api.patch<Team>(`/issues/teams/${id}/unarchive`),
  addMember: (id: string, body: { userId: string; role?: TeamRole }) =>
    api.post<TeamMember>(`/issues/teams/${id}/members`, body),
  removeMember: (id: string, userId: string) =>
    api.delete<{ message: string }>(`/issues/teams/${id}/members/${userId}`),
};

export const projectsApi = {
  list: (params: { teamId?: string; includeArchived?: boolean } = {}) =>
    api.get<Project[]>(`/issues/projects${query(params)}`),
  getOne: (id: string) => api.get<Project>(`/issues/projects/${id}`),
  create: (body: ProjectInput & { name: string }) => api.post<Project>("/issues/projects", body),
  update: (id: string, body: ProjectInput) => api.patch<Project>(`/issues/projects/${id}`, body),
  archive: (id: string) => api.patch<Project>(`/issues/projects/${id}/archive`),
  unarchive: (id: string) => api.patch<Project>(`/issues/projects/${id}/unarchive`),
};

export const cyclesApi = {
  list: (teamId: string) => api.get<Cycle[]>(`/issues/cycles${query({ teamId })}`),
  getOne: (id: string) => api.get<Cycle>(`/issues/cycles/${id}`),
  create: (body: { teamId: string; name?: string; startsAt: string; endsAt: string }) =>
    api.post<Cycle>("/issues/cycles", body),
  update: (id: string, body: { name?: string | null; startsAt?: string; endsAt?: string }) =>
    api.patch<Cycle>(`/issues/cycles/${id}`, body),
  complete: (id: string, rolloverToCycleId?: string) =>
    api.post<Cycle>(`/issues/cycles/${id}/complete`, { rolloverToCycleId }),
};

export const statesApi = {
  /** One team's workflow, or all teams' when `teamId` is omitted. */
  list: (teamId?: string) => api.get<IssueState[]>(`/issues/states${query({ teamId })}`),
  create: (body: { teamId: string; name: string; category: IssueStateCategory; color?: string }) =>
    api.post<IssueState>("/issues/states", body),
  update: (
    id: string,
    body: { name?: string; category?: IssueStateCategory; color?: string; position?: number },
  ) => api.patch<IssueState>(`/issues/states/${id}`, body),
  remove: (id: string, replacementStateId?: string) =>
    api.post<{ message: string }>(`/issues/states/${id}/delete`, { replacementStateId }),
};

export const labelsApi = {
  list: (teamId?: string) => api.get<IssueLabel[]>(`/issues/labels${query({ teamId })}`),
  create: (body: { name: string; color?: string; teamId?: string }) =>
    api.post<IssueLabel>("/issues/labels", body),
  update: (id: string, body: { name?: string; color?: string }) =>
    api.patch<IssueLabel>(`/issues/labels/${id}`, body),
  remove: (id: string) => api.delete<{ message: string }>(`/issues/labels/${id}`),
};

export function cycleLabel(cycle: { number: number; name: string | null }): string {
  return cycle.name ? cycle.name : `Cycle ${cycle.number}`;
}

export function isIssueOverdue(issue: Pick<Issue, "dueDate" | "state">): boolean {
  return (
    !!issue.dueDate &&
    OPEN_CATEGORIES.includes(issue.state.category) &&
    new Date(issue.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
  );
}

const CATEGORY_RANK = Object.fromEntries(STATE_CATEGORIES.map((c, i) => [c, i])) as Record<
  IssueStateCategory,
  number
>;

/** Workflow order: by category, then the team's own position. */
export function sortStates<T extends Pick<IssueState, "category" | "position">>(states: T[]): T[] {
  return [...states].sort(
    (a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] || a.position - b.position,
  );
}
