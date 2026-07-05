import { api, type Paginated } from "./api";

export type WorkspaceStatus = "PENDING" | "IN_PROGRESS" | "DONE";
export type WorkspacePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type WorkspaceSource =
  "MANUAL" | "LINEAR" | "SLACK" | "WHATSAPP" | "EMAIL" | "MEETING" | "PHONE_CALL" | "OTHER";

export interface WorkspaceItemPerson {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

export interface WorkspaceItem {
  id: string;
  title: string;
  description: string | null;
  status: WorkspaceStatus;
  priority: WorkspacePriority;
  dueDate: string | null;
  source: WorkspaceSource;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  orgId: string;
  ownerId: string;
  assignedById: string | null;
  isClientProject: boolean;
  watcherIds: string[];
  owner: WorkspaceItemPerson;
  assignedBy: WorkspaceItemPerson | null;
}

export interface WorkspaceBoard {
  PENDING: WorkspaceItem[];
  IN_PROGRESS: WorkspaceItem[];
  DONE: WorkspaceItem[];
}

export interface WorkspaceComment {
  id: string;
  body: string;
  createdAt: string;
  author: WorkspaceItemPerson;
}

export interface WorkspaceSummary {
  pending: number;
  inProgress: number;
  done: number;
  overdue: number;
  dueToday: number;
  total: number;
  completionRate: number;
}

export interface ListWorkspaceItemsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: WorkspaceStatus;
  priority?: WorkspacePriority;
  source?: WorkspaceSource;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "priority" | "title";
  sortOrder?: "asc" | "desc";
  overdue?: boolean;
  dueToday?: boolean;
  includeArchived?: boolean;
}

export interface CreateWorkspaceItemInput {
  title: string;
  description?: string;
  priority?: WorkspacePriority;
  dueDate?: string;
  source?: WorkspaceSource;
  ownerId?: string;
  isClientProject?: boolean;
}

export interface UpdateWorkspaceItemInput {
  title?: string;
  description?: string;
  priority?: WorkspacePriority;
  dueDate?: string | null;
  source?: WorkspaceSource;
  isClientProject?: boolean;
}

function buildQuery(params: ListWorkspaceItemsParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export type BoardQueryParams = Pick<ListWorkspaceItemsParams, "search" | "priority" | "source">;

export const workspaceApi = {
  list: (params: ListWorkspaceItemsParams = {}) =>
    api.get<Paginated<WorkspaceItem>>(`/workspace${buildQuery(params)}`),
  board: (params: BoardQueryParams = {}) =>
    api.get<WorkspaceBoard>(`/workspace/board${buildQuery(params)}`),
  assignedByMe: (params: ListWorkspaceItemsParams = {}) =>
    api.get<Paginated<WorkspaceItem>>(`/workspace/assigned${buildQuery(params)}`),
  summary: (userId?: string) =>
    api.get<WorkspaceSummary>(`/workspace/summary${userId ? `?userId=${userId}` : ""}`),
  getOne: (id: string) => api.get<WorkspaceItem>(`/workspace/${id}`),
  create: (body: CreateWorkspaceItemInput) => api.post<WorkspaceItem>("/workspace", body),
  update: (id: string, body: UpdateWorkspaceItemInput) =>
    api.patch<WorkspaceItem>(`/workspace/${id}`, body),
  updateStatus: (id: string, status: WorkspaceStatus) =>
    api.patch<WorkspaceItem>(`/workspace/${id}/status`, { status }),
  archive: (id: string) => api.patch<WorkspaceItem>(`/workspace/${id}/archive`),
  delegate: (id: string, ownerId: string) =>
    api.patch<WorkspaceItem>(`/workspace/${id}/delegate`, { ownerId }),
  remove: (id: string) => api.delete<{ message: string }>(`/workspace/${id}`),
  listComments: (id: string) => api.get<WorkspaceComment[]>(`/workspace/${id}/comments`),
  addComment: (id: string, body: string) =>
    api.post<WorkspaceComment>(`/workspace/${id}/comments`, { body }),
};

export function workspacePriorityLabel(p: WorkspacePriority): string {
  return { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" }[p];
}

export function workspaceSourceLabel(s: WorkspaceSource): string {
  return {
    MANUAL: "Manual",
    LINEAR: "Linear",
    SLACK: "Slack",
    WHATSAPP: "WhatsApp",
    EMAIL: "Email",
    MEETING: "Meeting",
    PHONE_CALL: "Phone call",
    OTHER: "Other",
  }[s];
}

export function workspaceStatusLabel(s: WorkspaceStatus): string {
  return { PENDING: "Pending", IN_PROGRESS: "In Progress", DONE: "Done" }[s];
}
