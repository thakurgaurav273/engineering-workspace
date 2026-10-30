"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hexagon, Plus } from "lucide-react";
import { cn, fmtDate } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, EmptyState, PageBody, PageHeader, Skeleton } from "@grovyn/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import { Switch } from "@grovyn/ui/components/switch";
import { useProjects, useTeams } from "@/applications/engineering/hooks/use-issues";
import { PROJECT_STATUS_LABEL, type Project } from "@/applications/engineering/lib/issues";
import { PROJECT_STATUS_TONE } from "@/applications/engineering/components/issues/planning-meta";
import { IssuesNav, ProgressBar } from "@/applications/engineering/components/issues/issue-views";
import { PersonAvatar } from "@/applications/engineering/components/issues/issue-ui";
import { ProjectDialog } from "@/applications/engineering/components/issues/project-dialog";

const ALL = "__all__";

function ProjectRow({ project }: { project: Project }) {
  const router = useRouter();
  const scope = project.progress.total - project.progress.canceled;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/issues/projects/${project.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/issues/projects/${project.id}`)}
      className={cn(
        "flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-4 py-3 text-[13px] last:border-b-0 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
        project.archivedAt && "opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 basis-[220px] items-center gap-2.5">
        <Hexagon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">{project.name}</span>
        {project.archivedAt && <Badge>Archived</Badge>}
      </div>
      <Badge tone={PROJECT_STATUS_TONE[project.status]} className="shrink-0">
        {PROJECT_STATUS_LABEL[project.status]}
      </Badge>
      <span className="hidden w-[90px] shrink-0 truncate font-mono-num text-[11.5px] text-muted-foreground md:inline">
        {project.teams.map((t) => t.key).join(", ") || "-"}
      </span>
      <span className="hidden shrink-0 sm:inline" title={project.lead ? "Lead" : "No lead"}>
        <PersonAvatar person={project.lead} />
      </span>
      <span
        className="hidden w-[64px] shrink-0 font-mono-num text-[11.5px] text-muted-foreground sm:inline"
        title="Target date"
      >
        {fmtDate(project.targetDate)}
      </span>
      <div className="flex w-full items-center gap-3 sm:w-[200px] sm:shrink-0">
        <ProgressBar done={project.progress.done} total={scope} className="flex-1" />
        <span className="w-9 text-right font-mono-num text-[11.5px] text-muted-foreground">
          {Math.round(project.progress.percent * 100)}%
        </span>
      </div>
    </div>
  );
}

export function IssueProjectsPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: teams = [] } = useTeams();
  const {
    data: projects,
    isLoading,
    isError,
  } = useProjects({
    teamId: teamId === ALL ? undefined : teamId,
    includeArchived: showArchived,
  });

  return (
    <AppShell>
      <PageHeader
        title="Projects"
        description="Group issues across teams toward a shared outcome, with a lead and a target date."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        }
      />
      <PageBody className="space-y-4">
        <IssuesNav />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Hexagon className="h-5 w-5" />}
            title="Couldn't load projects"
            description="Try refreshing the page."
          />
        ) : !projects?.length ? (
          <EmptyState
            icon={<Hexagon className="h-5 w-5" />}
            title="No projects yet"
            description="Projects collect related issues - possibly from several teams - and track progress toward a target date."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New project
              </Button>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="hidden items-center gap-4 border-b border-border bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:flex">
              <span className="flex-1">Name</span>
              <span className="w-[200px] text-right">Progress</span>
            </div>
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </div>
        )}
      </PageBody>
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(p) => router.push(`/issues/projects/${p.id}`)}
      />
    </AppShell>
  );
}
