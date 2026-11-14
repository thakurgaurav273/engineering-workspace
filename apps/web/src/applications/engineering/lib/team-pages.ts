import { Hexagon, RefreshCcw, SquareKanban, type LucideIcon } from "lucide-react";

// The tracker pages each team opens into in the sidebar ("Your teams"), and the rules that tie
// a URL back to them. Pages carry the team in the query (`?team=`), so every link here - and
// "View issues" elsewhere - lands on the same filtered view.

export interface TeamPage {
  key: "issues" | "cycles" | "projects";
  label: string;
  icon: LucideIcon;
  path: string;
  /** Extra query for the link (a team's Issues opens on all its issues, not just mine). */
  query: string;
}

export const TEAM_PAGES: TeamPage[] = [
  { key: "issues", label: "Issues", icon: SquareKanban, path: "/issues", query: "&view=all" },
  { key: "cycles", label: "Cycles", icon: RefreshCcw, path: "/issues/cycles", query: "" },
  { key: "projects", label: "Projects", icon: Hexagon, path: "/issues/projects", query: "" },
];

/** A team's page in the tracker. */
export function teamPageHref(key: TeamPage["key"], teamId: string): string {
  const page = TEAM_PAGES.find((p) => p.key === key)!;
  return `${page.path}?team=${teamId}${page.query}`;
}

/** A team-scoped tracker page belongs to that team's entry, not the app-wide Issues item. */
export function isTeamScopedPage(pathname: string, search: { has(name: string): boolean }) {
  return pathname.startsWith("/issues") && search.has("team");
}

/** Breadcrumb label for tracker pages that aren't top-level nav items. */
export function trackerCrumb(pathname: string): string | undefined {
  if (pathname.startsWith("/issues/cycles")) return "Cycles";
  if (pathname.startsWith("/issues/projects")) return "Projects";
  return undefined;
}
