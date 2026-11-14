import type { ComponentType } from "react";
import { TeamsSidebarSection } from "@/applications/engineering/components/teams/teams-sidebar-section";
import { isTeamScopedPage, trackerCrumb } from "@/applications/engineering/lib/team-pages";

/**
 * Sections an application adds to the sidebar below its own nav items - things a static
 * manifest can't describe because they depend on the person (Agile Workspace's "Your teams").
 * The shell stays app-agnostic: it renders whatever the active app registers here.
 */

/** The bits of the URL query a section reads (Next's ReadonlyURLSearchParams fits). */
export type SidebarSearch = Pick<URLSearchParams, "get" | "has">;

export interface SidebarSectionProps {
  pathname: string;
  /** Null while the query isn't readable yet (static pre-render) - render without highlights. */
  search: SidebarSearch | null;
  /** Called when a link is followed (closes the mobile drawer). */
  onNavigate: () => void;
}

export interface AppSidebarSection {
  Section: ComponentType<SidebarSectionProps>;
  /**
   * True when the section owns the current page, so the app's own items don't highlight it
   * too (a team's Issues, not the app-wide Issues item).
   */
  claims?: (pathname: string, search: SidebarSearch) => boolean;
  /** Breadcrumb label for pages under the app that aren't nav items of their own. */
  crumb?: (pathname: string) => string | undefined;
}

/** Keyed by application key. */
export const APP_SIDEBAR_SECTIONS: Record<string, AppSidebarSection> = {
  // Agile Workspace: "Your teams", each opening into its Issues, Cycles and Projects.
  engineering: { Section: TeamsSidebarSection, claims: isTeamScopedPage, crumb: trackerCrumb },
};
