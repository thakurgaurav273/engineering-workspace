import { api, type Paginated } from "@/shared/lib/api";

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
  parentId: string | null;
  teamId: string | null;
  parent: { id: string; title: string } | null;
  team: { id: string; name: string; key: string } | null;
  /** Live (non-deleted) sub-item count, present on every list/board/detail row. */
  _count?: { children: number };
  /** Only returned by the single-item endpoint. */
  subItems?: WorkspaceSubItem[];
  subItemProgress?: SubItemProgress;
}

export interface WorkspaceSubItem {
  id: string;
  title: string;
  status: WorkspaceStatus;
  priority: WorkspacePriority;
  dueDate: string | null;
  completedAt: string | null;
  ownerId: string;
  owner: WorkspaceItemPerson;
}

export interface SubItemProgress {
  done: number;
  total: number;
}

export type TeamRole = "LEAD" | "MEMBER";

export interface Team {
  id: string;
  orgId: string;
  name: string;
  key: string;
  description: string | null;
  createdAt: string;
  archivedAt: string | null;
  _count?: { members?: number; items?: number };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  user: WorkspaceItemPerson;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export interface CreateTeamInput {
  name: string;
  key: string;
  description?: string;
}

export type UpdateTeamInput = Partial<CreateTeamInput>;

export interface WorkspaceBoard {
  PENDING: WorkspaceItem[];
  IN_PROGRESS: WorkspaceItem[];
  DONE: WorkspaceItem[];
}

export interface WorkspaceCommentAttachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
}

export interface WorkspaceComment {
  id: string;
  body: string;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  author: WorkspaceItemPerson;
  attachments: WorkspaceCommentAttachment[];
}

export interface AddCommentInput {
  body: string;
  mentionedUserIds?: string[];
  attachments?: { url: string; fileName: string; mimeType: string; sizeBytes: number }[];
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
  /** Hide sub-items - only items without a parent. */
  topLevelOnly?: boolean;
  teamId?: string;
}

export interface CreateWorkspaceItemInput {
  title: string;
  description?: string;
  priority?: WorkspacePriority;
  dueDate?: string;
  source?: WorkspaceSource;
  ownerId?: string;
  isClientProject?: boolean;
  parentId?: string;
  teamId?: string;
}

export interface UpdateWorkspaceItemInput {
  title?: string;
  description?: string;
  priority?: WorkspacePriority;
  dueDate?: string | null;
  source?: WorkspaceSource;
  isClientProject?: boolean;
  /** Parent item id, or null to detach. */
  parentId?: string | null;
  /** Team id, or null to unassign. */
  teamId?: string | null;
}

function buildQuery(params: ListWorkspaceItemsParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export type BoardQueryParams = Pick<
  ListWorkspaceItemsParams,
  "search" | "priority" | "source" | "topLevelOnly"
>;

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
  subItems: (id: string) =>
    api.get<{ data: WorkspaceSubItem[]; progress: SubItemProgress }>(`/workspace/${id}/sub-items`),
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
  addComment: (id: string, input: AddCommentInput) =>
    api.post<WorkspaceComment>(`/workspace/${id}/comments`, input),
  editComment: (id: string, commentId: string, input: AddCommentInput) =>
    api.patch<WorkspaceComment>(`/workspace/${id}/comments/${commentId}`, input),
  deleteComment: (id: string, commentId: string) =>
    api.delete<{ message: string }>(`/workspace/${id}/comments/${commentId}`),
};

export const teamsApi = {
  list: (includeArchived = false) =>
    api.get<Team[]>(`/workspace/teams${includeArchived ? "?includeArchived=true" : ""}`),
  getOne: (id: string) => api.get<TeamDetail>(`/workspace/teams/${id}`),
  items: (id: string, params: ListWorkspaceItemsParams = {}) =>
    api.get<Paginated<WorkspaceItem>>(`/workspace/teams/${id}/items${buildQuery(params)}`),
  create: (body: CreateTeamInput) => api.post<Team>("/workspace/teams", body),
  update: (id: string, body: UpdateTeamInput) => api.patch<Team>(`/workspace/teams/${id}`, body),
  archive: (id: string) => api.patch<Team>(`/workspace/teams/${id}/archive`),
  addMember: (id: string, body: { userId: string; role?: TeamRole }) =>
    api.post<TeamMember>(`/workspace/teams/${id}/members`, body),
  removeMember: (id: string, userId: string) =>
    api.delete<{ message: string }>(`/workspace/teams/${id}/members/${userId}`),
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
