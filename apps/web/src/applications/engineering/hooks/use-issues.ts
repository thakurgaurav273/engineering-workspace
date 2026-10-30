import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAuthenticated } from "@/platform/auth/auth";
import {
  cyclesApi,
  issuesApi,
  labelsApi,
  projectsApi,
  teamsApi,
  type CreateIssueInput,
  type Issue,
  type ListIssuesParams,
  type ProjectInput,
  type TeamRole,
  type UpdateIssueInput,
} from "@/applications/engineering/lib/issues";
import type { Paginated } from "@/shared/lib/api";

// Every Issues query lives under ["issues", ...] so a write can refresh the whole app
// (lists, detail, project/cycle progress, My Workspace's issue section) in one call.
const ROOT = ["issues"] as const;

function useInvalidateIssues() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT });
}

const onError = (err: Error) => toast.error(err.message);

// ---------------------------------------------------------------- issues

export function useIssues(params: ListIssuesParams, enabled = true) {
  return useQuery({
    queryKey: [...ROOT, "list", params],
    queryFn: () => issuesApi.list(params),
    enabled: isAuthenticated() && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useMyIssues(enabled = true) {
  return useQuery({
    queryKey: [...ROOT, "mine"],
    queryFn: () => issuesApi.mine(),
    enabled: isAuthenticated() && enabled,
  });
}

export function useIssue(idOrIdentifier: string) {
  return useQuery({
    queryKey: [...ROOT, "detail", idOrIdentifier],
    queryFn: () => issuesApi.getOne(idOrIdentifier),
    enabled: isAuthenticated() && !!idOrIdentifier,
  });
}

export function useCreateIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: (body: CreateIssueInput) => issuesApi.create(body),
    onSuccess: (issue) => {
      invalidate();
      toast.success(`${issue.identifier} created`);
    },
    onError,
  });
}

/**
 * Patches an issue. Lists are updated optimistically (status/priority/assignee changes from
 * the board and inline pickers feel instant) and rolled back on failure.
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateIssueInput & { id: string }) => issuesApi.update(id, body),
    onMutate: async ({ id, ...body }) => {
      await queryClient.cancelQueries({ queryKey: [...ROOT, "list"] });
      const snapshot = queryClient.getQueriesData<Paginated<Issue>>({
        queryKey: [...ROOT, "list"],
      });
      const simple = Object.fromEntries(
        Object.entries(body).filter(([key]) =>
          ["status", "priority", "sortOrder", "dueDate", "estimate"].includes(key),
        ),
      );
      for (const [key, page] of snapshot) {
        if (!page) continue;
        queryClient.setQueryData<Paginated<Issue>>(key, {
          ...page,
          data: page.data.map((issue) => (issue.id === id ? { ...issue, ...simple } : issue)),
        });
      }
      return { snapshot };
    },
    onError: (err: Error, _vars, context) => {
      for (const [key, page] of context?.snapshot ?? []) queryClient.setQueryData(key, page);
      onError(err);
    },
    onSettled: () => invalidate(),
  });
}

export function useArchiveIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? issuesApi.archive(id) : issuesApi.unarchive(id),
    onSuccess: (issue, { archived }) => {
      invalidate();
      toast.success(`${issue.identifier} ${archived ? "archived" : "restored"}`);
    },
    onError,
  });
}

export function useDeleteIssue() {
  const invalidate = useInvalidateIssues();
  return useMutation({
    mutationFn: (id: string) => issuesApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success("Issue deleted");
    },
    onError,
  });
}

export function useIssueComments(id: string) {
  return useQuery({
    queryKey: [...ROOT, "detail", id, "comments"],
    queryFn: () => issuesApi.comments(id),
    enabled: isAuthenticated() && !!id,
  });
}

export function useIssueCommentMutations(id: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...ROOT, "detail", id] });
  return {
    add: useMutation({
      mutationFn: (body: string) => issuesApi.addComment(id, body),
      onSuccess: refresh,
      onError,
    }),
    edit: useMutation({
      mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
        issuesApi.editComment(id, commentId, body),
      onSuccess: refresh,
      onError,
    }),
    remove: useMutation({
      mutationFn: (commentId: string) => issuesApi.deleteComment(id, commentId),
      onSuccess: refresh,
      onError,
    }),
  };
}

// ---------------------------------------------------------------- teams

export function useTeams(includeArchived = false) {
  return useQuery({
    queryKey: [...ROOT, "teams", includeArchived],
    queryFn: () => teamsApi.list(includeArchived),
    enabled: isAuthenticated(),
    staleTime: 60 * 1000,
  });
}

export function useTeam(id: string | null) {
  return useQuery({
    queryKey: [...ROOT, "teams", "detail", id],
    queryFn: () => teamsApi.getOne(id!),
    enabled: isAuthenticated() && !!id,
  });
}

export function useTeamMutations() {
  const invalidate = useInvalidateIssues();
  const done = (message: string) => () => {
    invalidate();
    toast.success(message);
  };
  return {
    create: useMutation({
      mutationFn: teamsApi.create,
      onSuccess: (team) => done(`Team ${team.name} created`)(),
      onError,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: string;
        name?: string;
        key?: string;
        description?: string;
      }) => teamsApi.update(id, body),
      onSuccess: done("Team updated"),
      onError,
    }),
    archive: useMutation({
      mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
        archived ? teamsApi.archive(id) : teamsApi.unarchive(id),
      onSuccess: (_team, { archived }) => done(archived ? "Team archived" : "Team restored")(),
      onError,
    }),
    addMember: useMutation({
      mutationFn: ({ id, userId, role }: { id: string; userId: string; role?: TeamRole }) =>
        teamsApi.addMember(id, { userId, role }),
      onSuccess: done("Member updated"),
      onError,
    }),
    removeMember: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) =>
        teamsApi.removeMember(id, userId),
      onSuccess: done("Member removed"),
      onError,
    }),
  };
}

// ---------------------------------------------------------------- projects

export function useProjects(params: { teamId?: string; includeArchived?: boolean } = {}) {
  return useQuery({
    queryKey: [...ROOT, "projects", params],
    queryFn: () => projectsApi.list(params),
    enabled: isAuthenticated(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...ROOT, "projects", "detail", id],
    queryFn: () => projectsApi.getOne(id),
    enabled: isAuthenticated() && !!id,
  });
}

export function useProjectMutations() {
  const invalidate = useInvalidateIssues();
  return {
    create: useMutation({
      mutationFn: (body: ProjectInput & { name: string }) => projectsApi.create(body),
      onSuccess: (project) => {
        invalidate();
        toast.success(`Project ${project.name} created`);
      },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: ProjectInput & { id: string }) => projectsApi.update(id, body),
      onSuccess: invalidate,
      onError,
    }),
    archive: useMutation({
      mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
        archived ? projectsApi.archive(id) : projectsApi.unarchive(id),
      onSuccess: (_p, { archived }) => {
        invalidate();
        toast.success(archived ? "Project archived" : "Project restored");
      },
      onError,
    }),
  };
}

// ---------------------------------------------------------------- cycles

export function useCycles(teamId: string | null) {
  return useQuery({
    queryKey: [...ROOT, "cycles", teamId],
    queryFn: () => cyclesApi.list(teamId!),
    enabled: isAuthenticated() && !!teamId,
  });
}

export function useCycle(id: string) {
  return useQuery({
    queryKey: [...ROOT, "cycles", "detail", id],
    queryFn: () => cyclesApi.getOne(id),
    enabled: isAuthenticated() && !!id,
  });
}

export function useCycleMutations() {
  const invalidate = useInvalidateIssues();
  return {
    create: useMutation({
      mutationFn: cyclesApi.create,
      onSuccess: () => {
        invalidate();
        toast.success("Cycle created");
      },
      onError,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: string;
        name?: string | null;
        startsAt?: string;
        endsAt?: string;
      }) => cyclesApi.update(id, body),
      onSuccess: invalidate,
      onError,
    }),
    complete: useMutation({
      mutationFn: ({ id, rolloverToCycleId }: { id: string; rolloverToCycleId?: string }) =>
        cyclesApi.complete(id, rolloverToCycleId),
      onSuccess: () => {
        invalidate();
        toast.success("Cycle completed");
      },
      onError,
    }),
  };
}

// ---------------------------------------------------------------- labels

export function useLabels(teamId?: string) {
  return useQuery({
    queryKey: [...ROOT, "labels", teamId ?? "all"],
    queryFn: () => labelsApi.list(teamId),
    enabled: isAuthenticated(),
    staleTime: 60 * 1000,
  });
}

export function useLabelMutations() {
  const invalidate = useInvalidateIssues();
  return {
    create: useMutation({ mutationFn: labelsApi.create, onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; color?: string }) =>
        labelsApi.update(id, body),
      onSuccess: invalidate,
      onError,
    }),
    remove: useMutation({ mutationFn: labelsApi.remove, onSuccess: invalidate, onError }),
  };
}
