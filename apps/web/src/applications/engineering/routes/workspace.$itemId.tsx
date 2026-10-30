import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageBody,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Button,
  Skeleton,
} from "@grovyn/ui/primitives";
import { WorkspaceItemDialog } from "@/applications/engineering/components/workspace-item-dialog";
import { RichCommentComposer } from "@/applications/engineering/components/rich-comment-composer";
import { RichContent } from "@/applications/engineering/components/rich-content";
import { SubItemsSection } from "@/applications/engineering/components/sub-items-section";
import { AttachmentGallery } from "@/applications/engineering/components/attachment-gallery";
import { useOrgMembers } from "@/applications/engineering/hooks/use-org-members";
import { uploadWorkspaceCommentImage } from "@/shared/lib/uploads";
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
import {
  useWorkspaceItem,
  useWorkspaceComments,
  useAddWorkspaceComment,
  useEditWorkspaceComment,
  useDeleteWorkspaceComment,
  useUpdateWorkspaceItem,
  useMoveWorkspaceItem,
  useArchiveWorkspaceItem,
  useDeleteWorkspaceItem,
  useDelegateWorkspaceItem,
} from "@/applications/engineering/hooks/use-workspace";
import { getStoredAuth } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName, relativeTime, fmtDate } from "@grovyn/utils";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  workspaceStatusLabel,
  type WorkspaceStatus,
} from "@/applications/engineering/lib/workspace";
import { ArrowLeft, Pencil, Trash2, Archive as ArchiveIcon, Calendar } from "lucide-react";


const STATUSES: WorkspaceStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

// Tailwind's preflight strips default list/link styling, and this project doesn't pull
// in @tailwindcss/typography - so markdown elements need explicit classes to look like
// markdown rather than plain stacked text.
const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mt-4 text-[17px] font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-4 text-[15px] font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-3 text-[13.5px] font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-info underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface px-1 py-0.5 font-mono-num text-[12px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-surface p-3 text-[12px] first:mt-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-border pl-3 text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  input: ({ checked }) => (
    <input type="checkbox" checked={!!checked} disabled className="mr-1.5 align-middle" />
  ),
};

export function WorkspaceItemDetailPage({ itemId }: { itemId: string }) {
  const navigate = useRouter();
  const me = getStoredAuth()?.user;

  const { data: item, isLoading } = useWorkspaceItem(itemId);
  const { data: comments, isLoading: commentsLoading } = useWorkspaceComments(itemId);
  const addComment = useAddWorkspaceComment(itemId);
  const editComment = useEditWorkspaceComment(itemId);
  const deleteComment = useDeleteWorkspaceComment(itemId);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const updateMutation = useUpdateWorkspaceItem();
  const moveMutation = useMoveWorkspaceItem();
  const archiveMutation = useArchiveWorkspaceItem();
  const deleteMutation = useDeleteWorkspaceItem();
  const delegateMutation = useDelegateWorkspaceItem();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: membersPage } = useOrgMembers();
  const mentionMembers = (membersPage?.data ?? []).map((m) => ({
    id: m.id,
    label: fullName(m.firstName, m.lastName),
    avatarUrl: m.avatarUrl,
    sublabel: m.jobTitle ?? null,
  }));

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4 max-w-3xl">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </PageBody>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <PageBody>
          <p className="text-[12.5px] text-muted-foreground">
            Action item not found or you don't have access.{" "}
            <Link href="/workspace" className="underline">
              Back to workspace
            </Link>
          </p>
        </PageBody>
      </AppShell>
    );
  }

  const isOwner = me?.id === item.ownerId;
  const isAssigner = me?.id === item.assignedById;
  const isAdmin = me?.role === "OWNER" || me?.role === "ADMIN";
  const canManage = isOwner || isAssigner || isAdmin;

  return (
    <AppShell>
      <PageBody className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Workspace
          </Link>
          {item.parent && (
            <Link
              href={`/workspace/${item.parent.id}`}
              className="inline-flex min-w-0 items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <span aria-hidden>/</span>
              <span className="truncate">Sub-issue of {item.parent.title}</span>
            </Link>
          )}
        </div>

        <Card>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-[19px] font-semibold text-foreground">{item.title}</h1>
              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {item.status === "DONE" && !item.archivedAt && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => archiveMutation.mutate(item.id)}
                    >
                      <ArchiveIcon className="h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="info">{workspacePriorityLabel(item.priority)}</Badge>
              <Badge>{workspaceSourceLabel(item.source)}</Badge>
              {item.isClientProject && <Badge tone="success">Client</Badge>}
              {item.team && <Badge>{item.team.name}</Badge>}
              {item.dueDate && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Due {fmtDate(item.dueDate)}
                </span>
              )}
              {canManage ? (
                <select
                  value={item.status}
                  onChange={(e) =>
                    moveMutation.mutate({ id: item.id, status: e.target.value as WorkspaceStatus })
                  }
                  className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-[12px] outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {workspaceStatusLabel(s)}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge className="ml-auto">{workspaceStatusLabel(item.status)}</Badge>
              )}
            </div>

            {item.description ? (
              <div className="mt-4 text-[13px] leading-relaxed text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {item.description}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="mt-4 text-[12.5px] italic text-muted-foreground">No notes added.</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-[11.5px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar
                  initials={userInitials(item.owner.firstName, item.owner.lastName)}
                  color={avatarColor(item.owner.id)}
                  size="xs"
                  src={item.owner.avatarUrl}
                />
                {fullName(item.owner.firstName, item.owner.lastName)}'s workspace
              </div>
              {item.assignedBy && (
                <div className="flex items-center gap-1.5">
                  <Avatar
                    initials={userInitials(item.assignedBy.firstName, item.assignedBy.lastName)}
                    color={avatarColor(item.assignedBy.id)}
                    size="xs"
                    src={item.assignedBy.avatarUrl}
                  />
                  Assigned by {fullName(item.assignedBy.firstName, item.assignedBy.lastName)}
                </div>
              )}
              {item.watcherIds.length > 0 && (
                <Badge>
                  +{item.watcherIds.length} watcher{item.watcherIds.length === 1 ? "" : "s"} from
                  earlier delegation
                </Badge>
              )}
              <span className="ml-auto">Created {relativeTime(item.createdAt)}</span>
            </div>
          </div>
        </Card>

        <SubItemsSection item={item} canManage={canManage} />

        <Card>
          <CardHeader
            title="Comments"
            subtitle="Notifies the owner and whoever assigned this item."
          />
          <div className="p-5 space-y-4">
            {commentsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ) : !comments?.length ? (
              <p className="text-[12.5px] text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => {
                  const isCommentAuthor = c.author.id === me?.id;
                  const canEdit = isCommentAuthor;
                  const canDelete = isCommentAuthor || isAdmin;
                  return (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <Avatar
                        initials={userInitials(c.author.firstName, c.author.lastName)}
                        color={avatarColor(c.author.id)}
                        size="sm"
                        src={c.author.avatarUrl}
                      />
                      <div className="min-w-0 flex-1 rounded-md bg-surface p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[12.5px] font-medium">
                            {fullName(c.author.firstName, c.author.lastName)}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground">
                            {relativeTime(c.createdAt)}
                          </span>
                          {c.isEdited && (
                            <span className="text-[10.5px] text-muted-foreground">(edited)</span>
                          )}
                          {editingCommentId !== c.id && (canEdit || canDelete) && (
                            <div className="ml-auto flex items-center gap-3 text-[10.5px]">
                              {canEdit && (
                                <button
                                  onClick={() => setEditingCommentId(c.id)}
                                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => deleteComment.mutate(c.id)}
                                  className="text-muted-foreground underline underline-offset-2 hover:text-rose-600 dark:hover:text-rose-400"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {editingCommentId === c.id ? (
                          <div className="mt-2">
                            <RichCommentComposer
                              members={mentionMembers}
                              uploadFn={uploadWorkspaceCommentImage}
                              placeholder="Edit your comment…"
                              submitLabel="Save"
                              isSubmitting={editComment.isPending}
                              initialBody={c.body}
                              initialAttachments={(c.attachments ?? []).map((a) => ({
                                url: a.url,
                                fileName: a.fileName,
                                mimeType: a.mimeType,
                                sizeBytes: a.sizeBytes,
                              }))}
                              onCancel={() => setEditingCommentId(null)}
                              onSubmit={(payload) =>
                                editComment.mutate(
                                  { commentId: c.id, input: payload },
                                  { onSuccess: () => setEditingCommentId(null) },
                                )
                              }
                            />
                          </div>
                        ) : (
                          <>
                            {c.body && <RichContent body={c.body} className="mt-1" />}
                            <AttachmentGallery attachments={c.attachments ?? []} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {canManage ? (
              <div className="border-t border-border pt-4">
                <RichCommentComposer
                  members={mentionMembers}
                  uploadFn={uploadWorkspaceCommentImage}
                  placeholder="Add a comment… use @ to mention"
                  isSubmitting={addComment.isPending}
                  onSubmit={(payload) => addComment.mutate(payload)}
                />
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-[11.5px] text-muted-foreground">
                Only the owner, the assigner, or an admin can comment on this item.
              </p>
            )}
          </div>
        </Card>
      </PageBody>

      <WorkspaceItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={item}
        isSaving={updateMutation.isPending}
        isDelegating={delegateMutation.isPending}
        onCreate={() => {}}
        onUpdate={(id, body) =>
          updateMutation.mutate({ id, body }, { onSuccess: () => setEditOpen(false) })
        }
        onDelegate={(id, ownerId) =>
          delegateMutation.mutate({ id, ownerId }, { onSuccess: () => setEditOpen(false) })
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this action item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{item.title}" will be removed. This can't be undone from the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate(item.id, { onSuccess: () => navigate.push("/workspace") });
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
