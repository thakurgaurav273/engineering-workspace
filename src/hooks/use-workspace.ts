import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import {
  workspaceApi,
  type BoardQueryParams,
  type ListWorkspaceItemsParams,
  type WorkspaceBoard,
  type WorkspaceItem,
  type WorkspaceStatus,
  type CreateWorkspaceItemInput,
  type UpdateWorkspaceItemInput,
} from "@/lib/workspace";

const SUMMARY_KEY = (userId?: string) => ["workspace", "summary", userId ?? "me"];

export function useWorkspaceBoard(params: BoardQueryParams = {}) {
  return useQuery({
    queryKey: ["workspace", "board", params],
    queryFn: () => workspaceApi.board(params),
    enabled: isAuthenticated(),
    placeholderData: keepPreviousData,
  });
}

export function useWorkspaceList(params: ListWorkspaceItemsParams, enabled = true) {
  return useQuery({
    queryKey: ["workspace", "list", params],
    queryFn: () => workspaceApi.list(params),
    enabled: isAuthenticated() && enabled,
  });
}

export function useWorkspaceAssignedByMe(params: ListWorkspaceItemsParams = {}, enabled = true) {
  return useQuery({
    queryKey: ["workspace", "assigned", params],
    queryFn: () => workspaceApi.assignedByMe(params),
    enabled: isAuthenticated() && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useWorkspaceItem(id: string) {
  return useQuery({
    queryKey: ["workspace", "item", id],
    queryFn: () => workspaceApi.getOne(id),
    enabled: isAuthenticated() && !!id,
  });
}

export function useWorkspaceComments(id: string) {
  return useQuery({
    queryKey: ["workspace", "item", id, "comments"],
    queryFn: () => workspaceApi.listComments(id),
    enabled: isAuthenticated() && !!id,
  });
}

export function useAddWorkspaceComment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => workspaceApi.addComment(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "item", id, "comments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWorkspaceSummary(userId?: string, enabled = true) {
  return useQuery({
    queryKey: SUMMARY_KEY(userId),
    queryFn: () => workspaceApi.summary(userId),
    enabled: isAuthenticated() && enabled,
  });
}

export function useCreateWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkspaceItemInput) => workspaceApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Action item created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWorkspaceItemInput }) =>
      workspaceApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Action item updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Drag & drop - optimistically moves the card between board columns immediately,
// then reconciles with the server response (or rolls back on failure). The board query
// key is now parameterized by the active search/priority/source filters, so this
// patches every cached board variant (getQueriesData prefix-matches ["workspace",
// "board"]) rather than a single fixed key.
export function useMoveWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkspaceStatus }) =>
      workspaceApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["workspace", "board"] });
      const entries = queryClient.getQueriesData<WorkspaceBoard>({ queryKey: ["workspace", "board"] });

      for (const [key, previous] of entries) {
        if (!previous) continue;
        const next: WorkspaceBoard = { PENDING: [], IN_PROGRESS: [], DONE: [] };
        let moved: WorkspaceItem | undefined;
        for (const col of Object.keys(previous) as WorkspaceStatus[]) {
          for (const item of previous[col]) {
            if (item.id === id) {
              moved = { ...item, status };
            } else {
              next[col].push(item);
            }
          }
        }
        if (moved) next[status] = [moved, ...next[status]];
        queryClient.setQueryData(key, next);
      }

      return { previous: entries };
    },
    onError: (err: Error, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        if (data) queryClient.setQueryData(key, data);
      });
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", "board"] });
      queryClient.invalidateQueries({ queryKey: ["workspace", "summary"] });
    },
  });
}

export function useDelegateWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) =>
      workspaceApi.delegate(id, ownerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Item delegated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useArchiveWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspaceApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Action item archived");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspaceApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Action item deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
