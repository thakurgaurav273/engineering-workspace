"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Paginated } from "@/shared/lib/api";
import { isAuthenticated } from "@/platform/auth/auth";
import type { Person } from "@/applications/engineering/lib/issues";

export interface OrgMember {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  managerId?: string | null;
}

/**
 * The org roster, used to drive @mention autocomplete. Reuses GET /people?limit=100
 * (the same endpoint the workspace dialog uses for the assignee picker).
 */
export function useOrgMembers(enabled = true) {
  return useQuery<Paginated<OrgMember>>({
    queryKey: ["people", "org-members"],
    queryFn: () => api.get("/people?limit=100"),
    enabled: isAuthenticated() && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** The org roster as `Person`s, for the Issues assignee/lead pickers. */
export function usePeople(enabled = true): Person[] {
  const { data } = useOrgMembers(enabled);
  return useMemo(
    () =>
      (data?.data ?? []).map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        avatarUrl: m.avatarUrl ?? null,
      })),
    [data],
  );
}
