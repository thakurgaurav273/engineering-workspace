"use client";
import { usePeople } from "@/applications/engineering/hooks/use-org-members";
import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarDays,
  Hexagon,
  Pencil,
  Plus,
} from "lucide-react";
import { fmtDate, fullName } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, Card, EmptyState, PageBody, Skeleton } from "@grovyn/ui/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import {
  useIssues,
  useProject,
  useProjectMutations,
} from "@/applications/engineering/hooks/use-issues";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type IssueStatus,
  type ProjectStatus,
} from "@/applications/engineering/lib/issues";
import {
  IssueBoard,
  IssueList,
  IssuesNav,
  ProgressBar,
} from "@/applications/engineering/components/issues/issue-views";
import { PersonAvatar } from "@/applications/engineering/components/issues/issue-ui";
import { ProjectDialog } from "@/applications/engineering/components/issues/project-dialog";
import {
  CreateIssueDialog,
  type CreateIssueDefaults,
} from "@/applications/engineering/components/issues/create-issue-dialog";
import {
  LayoutToggle,
  type IssueLayout,
} from "@/applications/engineering/components/issues/layout-toggle";
import { RichContent } from "@/applications/engineering/components/rich-content";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-num text-[18px] font-semibold">{value}</div>
    </div>
  );
}

export function IssueProjectDetailPage({ projectId }: { projectId: string }) {
  const { data: project, isLoading, isError } = useProject(projectId);
  const { data: issuesPage, isLoading: issuesLoading } = useIssues({ projectId, limit: 500 });
  const { update, archive } = useProjectMutations();
  const people = usePeople();
  const [layout, setLayout] = useState<IssueLayout>("list");
  const [editOpen, setEditOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<CreateIssueDefaults | null>(null);

  const openCreate = (status?: IssueStatus) =>
    setCreateDefaults({
      projectId,
      status,
      teamId: project?.teams.length === 1 ? project.teams[0].id : undefined,
    });

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </PageBody>
      </AppShell>
    );
  }
  if (isError || !project) {
    return (
      <AppShell>
        <PageBody>
          <EmptyState
            icon={<Hexagon className="h-5 w-5" />}
            title="Project not found"
            description="It may have been removed, or the link is wrong."
            action={
              <Link href="/issues/projects">
                <Button variant="secondary">Back to projects</Button>
              </Link>
            }
          />
        </PageBody>
      </AppShell>
    );
  }

  const issues = issuesPage?.data ?? [];
  const { progress } = project;

  return (
    <AppShell>
      <PageBody className="space-y-5">
        <IssuesNav />
        <Link
          href="/issues/projects"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Hexagon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-[22px] font-semibold tracking-tight">{project.name}</h1>
              {project.archivedAt && <Badge>Archived</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
              <Select
                value={project.status}
                onValueChange={(v) => update.mutate({ id: project.id, status: v as ProjectStatus })}
              >
                <SelectTrigger className="h-7 w-[140px] text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="inline-flex items-center gap-1.5">
                <PersonAvatar person={project.lead} />
                {project.lead ? fullName(project.lead.firstName, project.lead.lastName) : "No lead"}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono-num">
                <CalendarDays className="h-3.5 w-3.5" />
                {fmtDate(project.startDate)} → {fmtDate(project.targetDate)}
              </span>
              {project.teams.length > 0 && (
                <span className="font-mono-num">{project.teams.map((t) => t.key).join(", ")}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="secondary"
              disabled={archive.isPending}
              onClick={() => archive.mutate({ id: project.id, archived: !project.archivedAt })}
            >
              {project.archivedAt ? (
                <>
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </>
              )}
            </Button>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat label="Scope" value={progress.total - progress.canceled} />
            <Stat label="Started" value={progress.started} />
            <Stat label="Done" value={progress.done} />
            <div className="min-w-[200px] flex-1">
              <div className="mb-1.5 text-right font-mono-num text-[12px] text-muted-foreground">
                {Math.round(progress.percent * 100)}%
              </div>
              <ProgressBar done={progress.done} total={progress.total - progress.canceled} />
            </div>
          </div>
          {project.description?.trim() && (
            <RichContent body={project.description} className="mt-4 border-t border-border pt-4" />
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">
            Issues <span className="font-mono-num text-muted-foreground">{issues.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <Button onClick={() => openCreate()}>
              <Plus className="h-3.5 w-3.5" /> New issue
            </Button>
          </div>
        </div>

        {issuesLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : issues.length === 0 ? (
          <EmptyState
            icon={<Hexagon className="h-5 w-5" />}
            title="No issues in this project"
            description="Create one here, or add existing issues from their Project property."
          />
        ) : layout === "list" ? (
          <IssueList
            issues={issues}
            people={people}
            onCreate={openCreate}
            showTeam={project.teams.length > 1}
          />
        ) : (
          <IssueBoard issues={issues} onCreate={openCreate} />
        )}
      </PageBody>
      <ProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <CreateIssueDialog
        open={!!createDefaults}
        onOpenChange={(open) => !open && setCreateDefaults(null)}
        defaults={createDefaults ?? undefined}
      />
    </AppShell>
  );
}
