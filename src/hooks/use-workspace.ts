import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAuthenticated } from "@/lib/auth";
import {
  workspaceApi,
  type ListWorkspaceItemsParams,
  type WorkspaceBoard,
  type WorkspaceItem,
  type WorkspaceStatus,
  type CreateWorkspaceItemInput,
  type UpdateWorkspaceItemInput,
} from "@/lib/workspace";

const BOARD_KEY = ["workspace", "board"];
const SUMMARY_KEY = (userId?: string) => ["workspace", "summary", userId ?? "me"];

export function useWorkspaceBoard() {
  return useQuery({
    queryKey: BOARD_KEY,
    queryFn: () => workspaceApi.board(),
    enabled: isAuthenticated(),
  });
}

export function useWorkspaceList(params: ListWorkspaceItemsParams, enabled = true) {
  return useQuery({
    queryKey: ["workspace", "list", params],
    queryFn: () => workspaceApi.list(params),
    enabled: isAuthenticated() && enabled,
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

// Drag & drop — optimistically moves the card between board columns immediately,
// then reconciles with the server response (or rolls back on failure).
export function useMoveWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkspaceStatus }) =>
      workspaceApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: BOARD_KEY });
      const previous = queryClient.getQueryData<WorkspaceBoard>(BOARD_KEY);

      if (previous) {
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
        queryClient.setQueryData(BOARD_KEY, next);
      }

      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(BOARD_KEY, context.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: BOARD_KEY });
      queryClient.invalidateQueries({ queryKey: ["workspace", "summary"] });
    },
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
