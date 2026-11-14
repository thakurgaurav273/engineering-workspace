import { getStoredAuth } from "@/platform/auth/auth";
import type { TeamRole } from "@/applications/engineering/lib/issues";

// Helpers shared by the Teams list and team settings pages (Workspace → Teams).

export const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-60";

/** What the API accepts as a team identifier. */
export const KEY_PATTERN = /^[A-Z0-9]{2,10}$/;

/** Keeps a typed identifier to what the API accepts: A-Z and 0-9, at most 10. */
export function normalizeKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

/** Suggests an identifier from the team name ("Platform Team" -> "PT"), the way Linear does. */
export function suggestKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return normalizeKey(
    words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3),
  );
}

/** "Oct 12, 2026" - team rows and headers show the full date, like Linear. */
export function formatCreated(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The caller's rights on a team, mirroring the API: admins manage every team, a lead manages
 * their own, and anyone may join or leave.
 */
export function teamAccess(myRole: TeamRole | null | undefined) {
  const me = getStoredAuth()?.user ?? null;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  return { me, isAdmin, canManage: isAdmin || myRole === "LEAD" };
}
