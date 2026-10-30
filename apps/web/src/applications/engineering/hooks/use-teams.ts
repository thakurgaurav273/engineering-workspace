import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAuthenticated } from "@/platform/auth/auth";
import {
  teamsApi,
  type CreateTeamInput,
  type TeamRole,
  type UpdateTeamInput,
} from "@/applications/engineering/lib/workspace";

const TEAMS_KEY = ["workspace", "teams"] as const;

export function useTeams(enabled = true, includeArchived = false) {
  return useQuery({
    queryKey: [...TEAMS_KEY, "list", includeArchived],
    queryFn: () => teamsApi.list(includeArchived),
    enabled: isAuthenticated() && enabled,
    staleTime: 60 * 1000,
  });
}

// Read-only for team members: the API 403s anyone outside the team who isn't an admin.
export function useTeamItems(id: string | null, params: Parameters<typeof teamsApi.items>[1] = {}) {
  return useQuery({
    queryKey: [...TEAMS_KEY, "items", id, params],
    queryFn: () => teamsApi.items(id as string, params),
    enabled: isAuthenticated() && !!id,
    retry: false,
  });
}

export function useTeam(id: string | null) {
  return useQuery({
    queryKey: [...TEAMS_KEY, "detail", id],
    queryFn: () => teamsApi.getOne(id as string),
    enabled: isAuthenticated() && !!id,
  });
}

// Every team mutation refreshes the whole teams subtree (list + open detail), and the
// item queries too, since items embed their team's name/key.
function useTeamInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: TEAMS_KEY });
    queryClient.invalidateQueries({ queryKey: ["workspace", "item"] });
  };
}

export function useCreateTeam() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: CreateTeamInput) => teamsApi.create(body),
    onSuccess: () => {
      invalidate();
      toast.success("Team created");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTeam() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTeamInput }) => teamsApi.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("Team updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useArchiveTeam() {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (id: string) => teamsApi.archive(id),
    onSuccess: () => {
      invalidate();
      toast.success("Team archived");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddTeamMember(teamId: string) {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: { userId: string; role?: TeamRole }) => teamsApi.addMember(teamId, body),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveTeamMember(teamId: string) {
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (userId: string) => teamsApi.removeMember(teamId, userId),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message),
  });
}
