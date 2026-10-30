import { useEffect, useMemo, useState } from "react";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, Loader2, Plus, Search, SquareKanban } from "lucide-react";
import { cn } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Button, EmptyState, Kbd, PageBody, PageHeader, Skeleton } from "@grovyn/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import { getStoredAuth } from "@/platform/auth/auth";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import {
  useIssues,
  useLabels,
  useProjects,
  useTeams,
} from "@/applications/engineering/hooks/use-issues";
import {
  ISSUE_PRIORITIES,
  PRIORITY_LABEL,
  type IssuePriority,
  type IssueStatus,
  type ListIssuesParams,
} from "@/applications/engineering/lib/issues";
import {
  CreateIssueDialog,
  type CreateIssueDefaults,
} from "@/applications/engineering/components/issues/create-issue-dialog";
import {
  IssueBoard,
  IssueList,
  IssuesNav,
} from "@/applications/engineering/components/issues/issue-views";
import { LabelFilter, PriorityIcon } from "@/applications/engineering/components/issues/issue-ui";

const VIEWS = [
  { key: "assigned", label: "My issues" },
  { key: "created", label: "Created by me" },
  { key: "active", label: "Active" },
  { key: "backlog", label: "Backlog" },
  { key: "all", label: "All issues" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

type Layout = "list" | "board";
type OrderBy = NonNullable<ListIssuesParams["orderBy"]>;

const LAYOUT_KEY = "grovyn_issues_layout";
const ALL = "all";

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

const VIEW_PARAMS: Record<ViewKey, ListIssuesParams> = {
  assigned: { assigneeId: "me" },
  created: { creatorId: "me" },
  active: { activeOnly: true },
  backlog: { status: ["BACKLOG"] },
  all: {},
};

export function IssuesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = ["OWNER", "ADMIN"].includes(getStoredAuth()?.user?.role ?? "");

  // View and team live in the URL so they can be linked to (My Workspace, team cards).
  const view = (VIEWS.find((v) => v.key === searchParams.get("view"))?.key ??
    "assigned") as ViewKey;
  const teamId = searchParams.get("team") ?? ALL;
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [layout, setLayout] = useState<Layout>("list");
  useEffect(() => setLayout(readLayout()), []);
  const changeLayout = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<IssuePriority | typeof ALL>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [labelId, setLabelId] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [orderBy, setOrderBy] = useState<OrderBy>("priority");
  const [hideSubIssues, setHideSubIssues] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateIssueDefaults | undefined>();
  const openCreate = (status?: IssueStatus) => {
    setCreateDefaults({
      teamId: teamId !== ALL ? teamId : undefined,
      status,
      assigneeId: view === "assigned" ? getStoredAuth()?.user?.id : undefined,
    });
    setCreateOpen(true);
  };

  // C opens "New issue", as in Linear - unless typing or a dialog is already open.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key.toLowerCase() === "c" && !typing && !createOpen && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openCreate();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, teamId, view]);

  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: labels = [] } = useLabels(teamId !== ALL ? teamId : undefined);
  const { data: projects = [] } = useProjects(teamId !== ALL ? { teamId } : {});
  const people = usePeople();

  const params: ListIssuesParams = useMemo(
    () => ({
      ...VIEW_PARAMS[view],
      teamId: teamId !== ALL ? teamId : undefined,
      priority: priority !== ALL ? [priority] : undefined,
      ...(assignee !== ALL && view !== "assigned" && { assigneeId: assignee }),
      labelId: labelId !== ALL ? labelId : undefined,
      projectId: projectId !== ALL ? projectId : undefined,
      search: debouncedSearch || undefined,
      topLevelOnly: hideSubIssues || undefined,
      orderBy,
      limit: 500,
    }),
    [view, teamId, priority, assignee, labelId, projectId, debouncedSearch, hideSubIssues, orderBy],
  );
  const { data, isLoading, isFetching } = useIssues(params, (teams?.length ?? 0) > 0);
  const issues = data?.data ?? [];
  const isFiltered =
    priority !== ALL ||
    assignee !== ALL ||
    labelId !== ALL ||
    projectId !== ALL ||
    !!debouncedSearch ||
    hideSubIssues;

  const clearFilters = () => {
    setSearch("");
    setPriority(ALL);
    setAssignee(ALL);
    setLabelId(ALL);
    setProjectId(ALL);
    setHideSubIssues(false);
  };

  const noTeams = !teamsLoading && (teams?.length ?? 0) === 0;

  return (
    <AppShell>
      <PageHeader
        title="Issues"
        description="Plan and track engineering work: issues, projects and cycles for every team."
        actions={
          !noTeams && (
            <Button onClick={() => openCreate()}>
              <Plus className="h-3.5 w-3.5" /> New issue <Kbd>C</Kbd>
            </Button>
          )
        }
      />
      <PageBody className="space-y-4">
        <IssuesNav />

        {noTeams ? (
          <EmptyState
            icon={<SquareKanban className="h-5 w-5" />}
            title="Set up your first team"
            description={
              isAdmin
                ? "Issues belong to a team (Engineering, Platform…), which gives them identifiers like ENG-42 and its own cycles."
                : "Issues belong to a team. Ask an admin to create one, then you can start filing issues."
            }
            action={
              isAdmin && (
                <Link href="/issues/teams">
                  <Button>
                    <Plus className="h-3.5 w-3.5" /> Create a team
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full items-center gap-1 overflow-x-auto rounded-md border border-border bg-surface p-0.5 lg:w-fit">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setParam("view", v.key === "assigned" ? null : v.key)}
                    className={cn(
                      "shrink-0 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      view === v.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={teamId}
                  onValueChange={(v) => setParam("team", v === ALL ? null : v)}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All teams</SelectItem>
                    {teams?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} <span className="text-muted-foreground">({t.key})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
                  {(["list", "board"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => changeLayout(l)}
                      aria-label={l === "list" ? "List layout" : "Board layout"}
                      aria-pressed={layout === l}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded transition-colors",
                        layout === l
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {l === "list" ? (
                        <List className="h-3.5 w-3.5" />
                      ) : (
                        <Columns3 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title or ENG-42"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                {isFetching && !isLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as IssuePriority | typeof ALL)}
                >
                  <SelectTrigger className="sm:w-[130px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Any priority</SelectItem>
                    {ISSUE_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="flex items-center gap-2">
                          <PriorityIcon priority={p} /> {PRIORITY_LABEL[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {view !== "assigned" && (
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="sm:w-[150px]">
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Anyone</SelectItem>
                      <SelectItem value="me">Me</SelectItem>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <LabelFilter
                  value={labelId !== ALL ? labelId : null}
                  labels={labels}
                  onChange={(id) => setLabelId(id ?? ALL)}
                />
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="sm:w-[150px]">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Any project</SelectItem>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={orderBy} onValueChange={(v) => setOrderBy(v as OrderBy)}>
                  <SelectTrigger className="sm:w-[140px]">
                    <SelectValue placeholder="Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="updated">Last updated</SelectItem>
                    <SelectItem value="created">Newest</SelectItem>
                    <SelectItem value="dueDate">Due date</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setHideSubIssues((v) => !v)}
                  aria-pressed={hideSubIssues}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    hideSubIssues
                      ? "border-foreground/30 bg-surface text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  Hide sub-issues
                </button>
              </div>
            </div>

            {isLoading || teamsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : issues.length === 0 ? (
              <EmptyState
                icon={<SquareKanban className="h-5 w-5" />}
                title={isFiltered ? "No issues match these filters" : "No issues here yet"}
                description={
                  isFiltered
                    ? "Try a different search or clear the filters."
                    : view === "assigned"
                      ? "Nothing is assigned to you. Issues you pick up or get assigned show up here."
                      : "Create an issue to start tracking work."
                }
                action={
                  isFiltered ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => openCreate()}>
                      <Plus className="h-3.5 w-3.5" /> New issue
                    </Button>
                  )
                }
              />
            ) : layout === "board" ? (
              <IssueBoard issues={issues} onCreate={openCreate} />
            ) : (
              <IssueList
                issues={issues}
                people={people}
                onCreate={openCreate}
                showTeam={teamId === ALL}
              />
            )}
            {data && data.total > issues.length && (
              <p className="text-center text-[12px] text-muted-foreground">
                Showing {issues.length} of {data.total} - narrow the filters to see the rest.
              </p>
            )}
          </>
        )}
      </PageBody>
      <CreateIssueDialog open={createOpen} onOpenChange={setCreateOpen} defaults={createDefaults} />
    </AppShell>
  );
}
