import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/app-shell";
import {
  PageBody,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Button,
  Skeleton,
  Kbd,
} from "@/components/primitives";
import { WorkspaceItemDialog } from "@/components/workspace-item-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useWorkspaceItem,
  useWorkspaceComments,
  useAddWorkspaceComment,
  useUpdateWorkspaceItem,
  useMoveWorkspaceItem,
  useArchiveWorkspaceItem,
  useDeleteWorkspaceItem,
} from "@/hooks/use-workspace";
import { getStoredAuth } from "@/lib/auth";
import { avatarColor, userInitials, fullName, relativeTime, fmtDate } from "@/lib/transforms";
import {
  workspacePriorityLabel,
  workspaceSourceLabel,
  workspaceStatusLabel,
  type WorkspaceStatus,
} from "@/lib/workspace";
import { ArrowLeft, Pencil, Trash2, Archive as ArchiveIcon, Calendar, Send } from "lucide-react";

export const Route = createFileRoute("/workspace/$itemId")({ component: WorkspaceItemDetailPage });

const STATUSES: WorkspaceStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];

// Tailwind's preflight strips default list/link styling, and this project doesn't pull
// in @tailwindcss/typography — so markdown elements need explicit classes to look like
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

function WorkspaceItemDetailPage() {
  const { itemId } = Route.useParams();
  const navigate = useNavigate();
  const me = getStoredAuth()?.user;

  const { data: item, isLoading } = useWorkspaceItem(itemId);
  const { data: comments, isLoading: commentsLoading } = useWorkspaceComments(itemId);
  const addComment = useAddWorkspaceComment(itemId);
  const updateMutation = useUpdateWorkspaceItem();
  const moveMutation = useMoveWorkspaceItem();
  const archiveMutation = useArchiveWorkspaceItem();
  const deleteMutation = useDeleteWorkspaceItem();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const handleSubmitComment = () => {
    if (!commentBody.trim()) return;
    addComment.mutate(commentBody, { onSuccess: () => setCommentBody("") });
  };

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
            <Link to="/workspace" className="underline">
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
        <Link
          to="/workspace"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Workspace
        </Link>

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
              <span className="ml-auto">Created {relativeTime(item.createdAt)}</span>
            </div>
          </div>
        </Card>

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
                {comments.map((c) => (
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
                      </div>
                      <p className="mt-1 text-[12.5px] text-foreground whitespace-pre-wrap">
                        {c.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <div className="flex items-start gap-2 border-t border-border pt-4">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                  placeholder="Add a comment…"
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentBody.trim() || addComment.isPending}
                >
                  <Send className="h-3.5 w-3.5" /> Send <Kbd>⌘⏎</Kbd>
                </Button>
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
        onCreate={() => {}}
        onUpdate={(id, body) =>
          updateMutation.mutate({ id, body }, { onSuccess: () => setEditOpen(false) })
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
                deleteMutation.mutate(item.id, { onSuccess: () => navigate({ to: "/workspace" }) });
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
