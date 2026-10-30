import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive as ArchiveIcon,
  ArchiveRestore,
  ChevronRight,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  CornerLeftUp,
  X,
} from "lucide-react";
import { cn, fullName, relativeTime } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Button, EmptyState, PageBody, Skeleton } from "@grovyn/ui/primitives";
import { MarkdownEditor } from "@grovyn/ui/markdown-editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@grovyn/ui/components/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@grovyn/ui/components/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@grovyn/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@grovyn/ui/components/command";
import { getStoredAuth } from "@/platform/auth/auth";
import { uploadWorkspaceCommentImage } from "@/shared/lib/uploads";
import {
  RichCommentComposer,
  type ComposerSubmit,
} from "@/applications/engineering/components/rich-comment-composer";
import { RichContent } from "@/applications/engineering/components/rich-content";
import { useOrgMembers, usePeople } from "@/applications/engineering/hooks/use-org-members";
import {
  useArchiveIssue,
  useCycles,
  useDeleteIssue,
  useIssue,
  useIssueCommentMutations,
  useIssueComments,
  useIssues,
  useTeams,
  useUpdateIssue,
} from "@/applications/engineering/hooks/use-issues";
import {
  type IssueActivity,
  type IssueComment,
  type IssueDetail,
  type UpdateIssueInput,
} from "@/applications/engineering/lib/issues";
import {
  AssigneePicker,
  CyclePicker,
  DueDateInput,
  LabelChip,
  LabelsPicker,
  PersonAvatar,
  PriorityPicker,
  ProjectPicker,
  PropertyButton,
  StatusIcon,
  StatusPicker,
} from "@/applications/engineering/components/issues/issue-ui";
import {
  IssueListSkeleton,
  IssueRow,
  ProgressBar,
} from "@/applications/engineering/components/issues/issue-views";
import { CreateIssueDialog } from "@/applications/engineering/components/issues/create-issue-dialog";

const ESTIMATES = [0, 1, 2, 3, 5, 8, 13];

/** Composer images are appended to the body as markdown - issue comments have no attachment table. */
function composeBody({ body, attachments }: ComposerSubmit): string {
  const images = attachments.map((a) => `![${a.fileName}](${a.url})`).join("\n");
  return [body.trim(), images].filter(Boolean).join("\n\n");
}

function activityText(a: IssueActivity): ReactNode {
  const from = a.fromValue ? <b className="font-medium text-foreground">{a.fromValue}</b> : null;
  const to = a.toValue ? <b className="font-medium text-foreground">{a.toValue}</b> : null;
  switch (a.field) {
    case "created":
      return "created the issue";
    case "archived":
      return "archived the issue";
    case "unarchived":
      return "restored the issue";
    case "description":
      return "updated the description";
    case "title":
      return <>renamed the issue to {to}</>;
    case "status":
      return (
        <>
          moved from {from} to {to}
        </>
      );
    case "priority":
      return <>set priority to {to}</>;
    case "assignee":
      return to ? <>assigned to {to}</> : <>removed assignee {from}</>;
    case "labels":
      return to ? <>set labels to {to}</> : "removed all labels";
    case "project":
      return to ? <>added to project {to}</> : <>removed from project {from}</>;
    case "cycle":
      return to ? <>added to {to}</> : "removed from the cycle";
    case "parent":
      return to ? <>made it a sub-issue of {to}</> : "removed the parent issue";
    case "dueDate":
      return to ? <>set due date to {to}</> : "removed the due date";
    case "estimate":
      return to ? <>set estimate to {to}</> : "removed the estimate";
    case "team":
      return (
        <>
          moved {from} to {to}
        </>
      );
    default:
      return `changed ${a.field}`;
  }
}

function SidebarRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-center gap-2">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ParentPicker({
  issue,
  onChange,
}: {
  issue: IssueDetail;
  onChange: (parentId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useIssues({ teamId: issue.teamId, limit: 500, orderBy: "updated" }, open);
  // An issue can't adopt itself or one of its own sub-issues (the API also guards deeper loops).
  const blocked = new Set([issue.id, ...issue.subIssues.map((s) => s.id)]);
  const candidates = (data?.data ?? []).filter((i) => !blocked.has(i.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PropertyButton>
          <CornerLeftUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">{issue.parent ? issue.parent.identifier : "Set parent"}</span>
        </PropertyButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search issues…" className="text-[12.5px]" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
              No issues
            </CommandEmpty>
            <CommandGroup>
              {issue.parent && (
                <CommandItem
                  value="__remove__ remove parent"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="gap-2 text-[12.5px]"
                >
                  <X className="h-3.5 w-3.5" /> Remove parent
                </CommandItem>
              )}
              {candidates.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.identifier} ${c.title}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="gap-2 text-[12.5px]"
                >
                  <StatusIcon state={c.state} />
                  <span className="font-mono-num text-muted-foreground">{c.identifier}</span>
                  <span className="truncate">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function IssueDetailPage({ issueId }: { issueId: string }) {
  const router = useRouter();
  const me = getStoredAuth()?.user;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";

  const { data: issue, isLoading, error } = useIssue(issueId);
  const { data: comments = [] } = useIssueComments(issueId);
  const commentMutations = useIssueCommentMutations(issueId);
  const update = useUpdateIssue();
  const archive = useArchiveIssue();
  const remove = useDeleteIssue();

  const { data: teams = [] } = useTeams();
  const { data: cycles = [] } = useCycles(issue?.teamId ?? null);
  const people = usePeople();
  const { data: membersPage } = useOrgMembers();
  const mentionMembers = (membersPage?.data ?? []).map((m) => ({
    id: m.id,
    label: fullName(m.firstName, m.lastName),
    avatarUrl: m.avatarUrl,
    sublabel: m.jobTitle ?? null,
  }));

  const [title, setTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [subIssueOpen, setSubIssueOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [composerKey, setComposerKey] = useState(0);

  useEffect(() => {
    if (issue) setTitle(issue.title);
  }, [issue?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Comments and field changes in one chronological feed, like Linear's activity column.
  const timeline = useMemo(() => {
    const items: (
      | { kind: "activity"; at: string; activity: IssueActivity }
      | { kind: "comment"; at: string; comment: IssueComment }
    )[] = [
      ...(issue?.activity ?? []).map((activity) => ({
        kind: "activity" as const,
        at: activity.createdAt,
        activity,
      })),
      ...comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
    ];
    return items.sort((a, b) => a.at.localeCompare(b.at));
  }, [issue?.activity, comments]);

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4" aria-busy aria-label="Loading issue">
          <Skeleton className="h-3.5 w-48" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-[92%]" />
                <Skeleton className="h-3 w-[60%]" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <IssueListSkeleton rows={2} />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-3.5 w-20" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className={i === 1 ? "h-3 w-1/2" : "h-3 w-1/3"} />
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden space-y-3.5 rounded-lg border border-border bg-card p-4 lg:block">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[88px_1fr] items-center gap-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-7 w-28 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </PageBody>
      </AppShell>
    );
  }

  if (!issue) {
    return (
      <AppShell>
        <PageBody>
          <EmptyState
            icon={<X className="h-5 w-5" />}
            title="Issue not found"
            description={(error as Error | null)?.message ?? "It may have been deleted."}
            action={
              <Link href="/issues">
                <Button variant="secondary">Back to issues</Button>
              </Link>
            }
          />
        </PageBody>
      </AppShell>
    );
  }

  const patch = (body: UpdateIssueInput) => update.mutate({ id: issue.id, ...body });
  const canDelete = isAdmin || issue.creatorId === me?.id;

  const saveTitle = () => {
    const next = title.trim();
    if (!next) setTitle(issue.title);
    else if (next !== issue.title) patch({ title: next });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/issues/${issue.identifier}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const properties = (
    <div className="space-y-3">
      <SidebarRow label="Status">
        <StatusPicker
          teamId={issue.teamId}
          value={issue.state}
          onChange={(state) =>
            update.mutate({ id: issue.id, stateId: state.id, optimisticState: state })
          }
        />
      </SidebarRow>
      <SidebarRow label="Priority">
        <PriorityPicker value={issue.priority} onChange={(priority) => patch({ priority })} />
      </SidebarRow>
      <SidebarRow label="Assignee">
        <AssigneePicker
          value={issue.assignee}
          people={people}
          onChange={(assigneeId) => patch({ assigneeId })}
        />
      </SidebarRow>
      <SidebarRow label="Labels">
        <div className="flex flex-wrap items-center gap-1.5">
          {issue.labels.map((l) => (
            <LabelChip
              key={l.id}
              label={l}
              onRemove={() =>
                patch({ labelIds: issue.labels.filter((x) => x.id !== l.id).map((x) => x.id) })
              }
            />
          ))}
          <LabelsPicker
            teamId={issue.teamId}
            value={issue.labels.map((l) => l.id)}
            onChange={(labelIds) => patch({ labelIds })}
            trigger={
              <button
                className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground"
                aria-label="Edit labels"
              >
                <Plus className="h-3 w-3" />
              </button>
            }
          />
        </div>
      </SidebarRow>
      <SidebarRow label="Project">
        <ProjectPicker value={issue.project} onChange={(projectId) => patch({ projectId })} />
      </SidebarRow>
      <SidebarRow label="Cycle">
        <CyclePicker
          value={issue.cycle}
          cycles={cycles}
          onChange={(cycleId) => patch({ cycleId })}
        />
      </SidebarRow>
      <SidebarRow label="Due date">
        <DueDateInput
          value={issue.dueDate}
          onChange={(date) => patch({ dueDate: date ? new Date(date).toISOString() : null })}
        />
      </SidebarRow>
      <SidebarRow label="Estimate">
        <select
          value={issue.estimate ?? ""}
          onChange={(e) =>
            patch({ estimate: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="h-7 rounded-md border border-border bg-surface px-2 text-[12px] outline-none"
          aria-label="Estimate"
        >
          <option value="">No estimate</option>
          {ESTIMATES.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "point" : "points"}
            </option>
          ))}
        </select>
      </SidebarRow>
      <SidebarRow label="Parent">
        <ParentPicker issue={issue} onChange={(parentId) => patch({ parentId })} />
      </SidebarRow>
      <SidebarRow label="Team">
        <select
          value={issue.teamId}
          onChange={(e) => {
            const target = teams.find((t) => t.id === e.target.value);
            if (
              target &&
              window.confirm(
                `Move to ${target.name}? The issue gets a new ${target.key}- identifier.`,
              )
            ) {
              patch({ teamId: target.id });
            }
          }}
          className="h-7 max-w-full rounded-md border border-border bg-surface px-2 text-[12px] outline-none"
          aria-label="Team"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.key})
            </option>
          ))}
        </select>
      </SidebarRow>
      <div className="border-t border-border pt-3 text-[11.5px] text-muted-foreground">
        Created by {fullName(issue.creator.firstName, issue.creator.lastName)}{" "}
        {relativeTime(issue.createdAt)}
        <br />
        Updated {relativeTime(issue.updatedAt)}
      </div>
    </div>
  );

  return (
    <AppShell>
      <PageBody className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <nav className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Link href="/issues" className="hover:text-foreground">
              Issues
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link
              href={`/issues?team=${issue.teamId}&view=all`}
              className="truncate hover:text-foreground"
            >
              {issue.team.name}
            </Link>
            {issue.parent && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <Link
                  href={`/issues/${issue.parent.id}`}
                  className="truncate hover:text-foreground"
                >
                  {issue.parent.identifier}
                </Link>
              </>
            )}
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="font-mono-num text-foreground">{issue.identifier}</span>
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Issue actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyLink}>
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => archive.mutate({ id: issue.id, archived: !issue.archivedAt })}
              >
                {issue.archivedAt ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <ArchiveIcon className="h-3.5 w-3.5" />
                )}
                {issue.archivedAt ? "Restore" : "Archive"}
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteOpen(true)}
                    className="text-rose-600 focus:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {issue.archivedAt && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
            This issue is archived and hidden from lists.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setTitle(issue.title);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                maxLength={255}
                aria-label="Title"
                className="w-full rounded-md bg-transparent text-[22px] font-semibold tracking-tight text-foreground outline-none focus:bg-surface/60"
              />

              {editingDescription ? (
                <div className="space-y-2">
                  <div className="rounded-md border border-border px-3 py-2">
                    <MarkdownEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="Add description…"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingDescription(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        patch({ description: description.trim() });
                        setEditingDescription(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setDescription(issue.description ?? "");
                    setEditingDescription(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setDescription(issue.description ?? "");
                      setEditingDescription(true);
                    }
                  }}
                  className="group relative -mx-2 cursor-text rounded-md px-2 py-1.5 hover:bg-surface/60"
                >
                  {issue.description ? (
                    <RichContent
                      body={issue.description}
                      className="[&_img]:max-w-full [&_img]:rounded-md"
                    />
                  ) : (
                    <p className="text-[13px] text-muted-foreground">Add description…</p>
                  )}
                  <Pencil className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              )}
            </div>

            {/* On small screens the properties sit above the fold instead of in a sidebar. */}
            <div className="rounded-lg border border-border bg-card p-4 lg:hidden">
              {properties}
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-semibold">Sub-issues</h2>
                <Button variant="ghost" size="sm" onClick={() => setSubIssueOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add sub-issue
                </Button>
              </div>
              {issue.subIssues.length > 0 ? (
                <>
                  <ProgressBar
                    done={issue.subIssueProgress.done}
                    total={issue.subIssueProgress.total}
                    className="max-w-xs"
                  />
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {issue.subIssues.map((sub) => (
                      <IssueRow key={sub.id} issue={sub} people={people} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  Break this down into smaller pieces of work - each sub-issue is tracked on its
                  own.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-[13px] font-semibold">Activity</h2>
              <ol className="space-y-3">
                {timeline.map((entry) =>
                  entry.kind === "activity" ? (
                    <li
                      key={`a-${entry.activity.id}`}
                      className="flex items-center gap-2 pl-1 text-[12px] text-muted-foreground"
                    >
                      <PersonAvatar person={entry.activity.actor} />
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">
                          {fullName(entry.activity.actor.firstName, entry.activity.actor.lastName)}
                        </span>{" "}
                        {activityText(entry.activity)}
                        <span className="ml-1.5">· {relativeTime(entry.at)}</span>
                      </span>
                    </li>
                  ) : (
                    <li
                      key={`c-${entry.comment.id}`}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-2 text-[12px]">
                        <PersonAvatar person={entry.comment.author} />
                        <span className="font-medium">
                          {fullName(entry.comment.author.firstName, entry.comment.author.lastName)}
                        </span>
                        <span className="text-muted-foreground">
                          {relativeTime(entry.comment.createdAt)}
                          {entry.comment.editedAt && " (edited)"}
                        </span>
                        {(entry.comment.author.id === me?.id || isAdmin) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent"
                                aria-label="Comment actions"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {entry.comment.author.id === me?.id && (
                                <DropdownMenuItem
                                  onClick={() => setEditingCommentId(entry.comment.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => commentMutations.remove.mutate(entry.comment.id)}
                                className="text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {editingCommentId === entry.comment.id ? (
                        <div className="mt-2">
                          <RichCommentComposer
                            members={mentionMembers}
                            uploadFn={uploadWorkspaceCommentImage}
                            placeholder="Edit your comment…"
                            submitLabel="Save"
                            initialBody={entry.comment.body}
                            isSubmitting={commentMutations.edit.isPending}
                            onCancel={() => setEditingCommentId(null)}
                            onSubmit={(payload) =>
                              commentMutations.edit.mutate(
                                { commentId: entry.comment.id, body: composeBody(payload) },
                                { onSuccess: () => setEditingCommentId(null) },
                              )
                            }
                          />
                        </div>
                      ) : (
                        <RichContent
                          body={entry.comment.body}
                          className="mt-1.5 [&_img]:max-w-full [&_img]:rounded-md"
                        />
                      )}
                    </li>
                  ),
                )}
              </ol>
              <RichCommentComposer
                key={composerKey}
                members={mentionMembers}
                uploadFn={uploadWorkspaceCommentImage}
                placeholder="Leave a comment… use @ to mention"
                isSubmitting={commentMutations.add.isPending}
                onSubmit={(payload) =>
                  commentMutations.add.mutate(composeBody(payload), {
                    onSuccess: () => setComposerKey((k) => k + 1),
                  })
                }
              />
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-lg border border-border bg-card p-4">
              {properties}
            </div>
          </aside>
        </div>
      </PageBody>

      <CreateIssueDialog
        open={subIssueOpen}
        onOpenChange={setSubIssueOpen}
        defaults={{
          teamId: issue.teamId,
          parentId: issue.id,
          parentLabel: issue.identifier,
          projectId: issue.projectId,
          cycleId: issue.cycleId,
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {issue.identifier}?</AlertDialogTitle>
            <AlertDialogDescription>
              The issue disappears from every list.
              {issue.subIssues.length > 0 &&
                ` Its ${issue.subIssues.length} sub-issue(s) stay, as top-level issues.`}{" "}
              To keep it out of the way but recoverable, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-rose-600 text-white hover:bg-rose-600/90")}
              onClick={() => remove.mutate(issue.id, { onSuccess: () => router.push("/issues") })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
