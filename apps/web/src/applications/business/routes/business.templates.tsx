import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, FileText, MoreHorizontal, Plus, Star } from "lucide-react";
import { cn, relativeTime } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, EmptyState, PageBody, PageHeader, Skeleton } from "@grovyn/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@grovyn/ui/components/dropdown-menu";
import { Switch } from "@grovyn/ui/components/switch";
import { flags } from "@/shared/lib/flags";
import { getStoredAuth } from "@/platform/auth/auth";
import { useApplication } from "@/platform/registry/application-context";
import { NewTemplateDialog } from "@/applications/business/components/new-template-dialog";
import {
  DOCUMENT_TYPE_LABEL,
  TEMPLATED_TYPES,
  useTemplateMutations,
  useTemplates,
  type TemplatedType,
  type TemplateSummary,
} from "@/applications/business/lib/business-document-templates";

type Scope = "org" | "platform";

function StatusBadge({ t }: { t: TemplateSummary }) {
  if (t.status === "ARCHIVED") return <Badge>Archived</Badge>;
  if (t.liveVersion) return <Badge tone="success">Published v{t.liveVersion}</Badge>;
  return <Badge tone="info">Draft</Badge>;
}

function TemplateRow({ t, canEdit }: { t: TemplateSummary; canEdit: boolean }) {
  const navigate = useRouter();
  const { setDefault, archive, create } = useTemplateMutations();
  const duplicate = () =>
    create.mutate(
      { documentType: t.documentType, name: `${t.name} copy`, source: `template:${t.id}` },
      { onSuccess: (copy) => navigate.push(`/business/templates/${copy.id}`) },
    );
  const open = () => navigate.push(`/business/templates/${t.id}`);
  const archived = t.status === "ARCHIVED";
  const canDefault = canEdit && !!t.liveVersion && !t.isDefault && !archived && t.orgId !== null;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
        archived && "opacity-70",
      )}
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">{t.name}</span>
          {t.isDefault && (
            <Badge tone="warning">
              <Star className="h-2.5 w-2.5" /> Default
            </Badge>
          )}
          <StatusBadge t={t} />
          {t.hasUnpublishedChanges && !!t.liveVersion && !archived && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              Unpublished changes
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
          <span>Updated {relativeTime(t.updatedAt)}</span>
          {t.description && <span className="hidden truncate md:inline">· {t.description}</span>}
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Actions for ${t.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={open}>
              <FileText className="h-3.5 w-3.5" /> Open
            </DropdownMenuItem>
            {canEdit && t.orgId !== null && (
              <DropdownMenuItem onClick={duplicate} disabled={create.isPending}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
            )}
            {canDefault && (
              <DropdownMenuItem onClick={() => setDefault.mutate(t.id)}>
                <Star className="h-3.5 w-3.5" /> Make default
              </DropdownMenuItem>
            )}
            {canEdit && !t.isDefault && (
              <DropdownMenuItem onClick={() => archive.mutate({ id: t.id, archived: !archived })}>
                {archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                {archived ? "Restore" : "Archive"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-5">
      {[3, 2].map((rows, g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {Array.from({ length: rows }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className={cn("h-3.5", i % 2 ? "w-40" : "w-56")} />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TemplatesPage() {
  const navigate = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const available = applications.some((a) => a.key === "business-operations");
  // Only super admins receive the platform-admin app (same signal as AdminPage).
  const isSuperAdmin = applications.some((a) => a.key === "platform-admin");
  const role = getStoredAuth()?.user?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";

  useEffect(() => {
    if (!flags.platformShell) navigate.replace("/");
    else if (!appsLoading && !available) navigate.replace("/apps");
  }, [appsLoading, available, navigate]);

  const [scope, setScope] = useState<Scope>("org");
  const [typeFilter, setTypeFilter] = useState<TemplatedType | "ALL">("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const { data: templates, isLoading } = useTemplates({
    includeArchived: showArchived,
    platform: scope === "platform" || undefined,
  });

  if (!flags.platformShell || appsLoading || !available) return null;

  const canCreate = scope === "platform" ? isSuperAdmin : canEdit;
  const list = templates ?? [];
  const types = typeFilter === "ALL" ? TEMPLATED_TYPES : [typeFilter];
  const nothingYet = !isLoading && list.length === 0 && !showArchived;

  return (
    <AppShell>
      <PageHeader
        title="Templates"
        description="Design the PDFs for invoices, quotations, proposals and offer letters. Publish a template and make it the default - new and re-downloaded documents use it."
        actions={
          canCreate && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-3.5 w-3.5" />{" "}
              {scope === "platform" ? "New starter" : "New template"}
            </Button>
          )
        }
      />
      <PageBody className="space-y-5">
        {isSuperAdmin && (
          <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            {(["org", "platform"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={cn(
                  "rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                  scope === s
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "org" ? "Organization" : "Platform starters"}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...TEMPLATED_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  typeFilter === t
                    ? "border-foreground/30 bg-surface text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "ALL" ? "All" : DOCUMENT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
          </label>
        </div>

        {isLoading ? (
          <RowsSkeleton />
        ) : nothingYet ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title={scope === "platform" ? "No platform starters yet" : "No templates yet"}
            description={
              scope === "platform"
                ? "Starters you publish here show up for every organization under New template."
                : "Documents use the built-in Classic layouts. Create a template from one to change the design."
            }
            action={
              canCreate && (
                <Button onClick={() => setNewOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Create from a starter
                </Button>
              )
            }
          />
        ) : (
          types.map((type) => {
            const items = list.filter((t) => t.documentType === type);
            const hasDefault = items.some(
              (t) => t.isDefault && t.liveVersion && t.status !== "ARCHIVED",
            );
            return (
              <section key={type} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[13px] font-semibold text-foreground">
                    {DOCUMENT_TYPE_LABEL[type]}
                  </h2>
                  {scope === "org" && !hasDefault && (
                    <span className="text-[11.5px] text-muted-foreground">
                      Using the built-in Classic layout
                    </span>
                  )}
                </div>
                {items.length ? (
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {items.map((t) => (
                      <TemplateRow
                        key={t.id}
                        t={t}
                        canEdit={scope === "platform" ? isSuperAdmin : canEdit}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground">
                    No {DOCUMENT_TYPE_LABEL[type].toLowerCase()} templates
                    {showArchived ? "" : " (archived ones are hidden)"}.
                  </div>
                )}
              </section>
            );
          })
        )}
      </PageBody>

      <NewTemplateDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultType={typeFilter === "ALL" ? undefined : typeFilter}
        platform={scope === "platform"}
      />
    </AppShell>
  );
}
