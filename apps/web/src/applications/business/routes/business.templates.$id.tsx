import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArchiveRestore,
  Archive as ArchiveIcon,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  Play,
  RotateCcw,
  Rocket,
  Save,
  Star,
  TriangleAlert,
  WrapText,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn, relativeTime } from "@grovyn/utils";
import { AppShell } from "@/platform/shell/app-shell";
import { Badge, Button, Card, EmptyState, PageBody, Skeleton } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@grovyn/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import { Switch } from "@grovyn/ui/components/switch";
import { getStoredAuth } from "@/platform/auth/auth";
import { ApiError } from "@/shared/lib/api";
import { COMMENT_IMAGE_ACCEPT, uploadTemplateImage } from "@/shared/lib/uploads";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import {
  DOCUMENT_TYPE_LABEL,
  issuesFrom,
  previewPdfUrl,
  templatesApi,
  useTemplate,
  useTemplateCatalog,
  useTemplateEvents,
  useTemplateMutations,
  useTemplateVersions,
  versionPdfUrl,
  type TemplateCatalog,
  type TemplateDetail,
  type TemplateIssue,
  type TemplatedType,
  type VarSpec,
} from "@/applications/business/lib/business-document-templates";
import { useInvoices } from "@/applications/business/lib/business-invoices";
import { useQuotations } from "@/applications/business/lib/business-quotations";
import { useProposals } from "@/applications/business/lib/business-proposals";
import { useOfferLetters } from "@/applications/business/lib/business-offer-letters";
import type { TemplateEditorApi } from "@/applications/business/components/template-code-editor";
import { RichTextEditor } from "@/shared/components/rich-text-editor";

// CodeMirror touches `document`, so it only ever loads in the browser.
const TemplateCodeEditor = dynamic(
  () => import("@/applications/business/components/template-code-editor"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);

type Tab = "design" | "wording" | "variables" | "versions" | "details";
const TABS: { key: Tab; label: string; only?: TemplatedType }[] = [
  { key: "design", label: "Design" },
  { key: "wording", label: "Wording", only: "OFFER_LETTER" },
  { key: "variables", label: "Variables" },
  { key: "versions", label: "Versions" },
  { key: "details", label: "Details" },
];

const SAMPLE = "__sample__";
/** A4 at 96 dpi - the browser preview is laid out at this width, then scaled to fit. */
const A4_WIDTH = 794;

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  details_updated: "Details updated",
  draft_discarded: "Draft discarded",
  published: "Published",
  rolled_back: "Rolled back",
  set_default: "Made default",
  archived: "Archived",
  restored: "Restored",
};

// ---------------------------------------------------------------- helpers

function itemAlias(listKey: string): string {
  if (listKey.endsWith("ies")) return `${listKey.slice(0, -3)}y`;
  if (listKey.endsWith("xes")) return listKey.slice(0, -2);
  if (listKey.endsWith("s")) return listKey.slice(0, -1);
  return "item";
}

/** Recent real documents of a type, for "Preview with". Only the matching hook fetches. */
function usePreviewDocuments(type: TemplatedType | undefined) {
  const params = { limit: 20, sort: "createdAt" as const, order: "desc" as const };
  const invoices = useInvoices(params, type === "INVOICE");
  const quotations = useQuotations(params, type === "QUOTATION");
  const proposals = useProposals(params, type === "PROPOSAL");
  const offers = useOfferLetters(params, type === "OFFER_LETTER");
  return useMemo(() => {
    switch (type) {
      case "INVOICE":
        return (invoices.data?.data ?? []).map((d) => ({
          id: d.id,
          label: `${d.number ?? "Draft"} · ${d.clientName ?? ""}`.trim(),
        }));
      case "QUOTATION":
        return (quotations.data?.data ?? []).map((d) => ({
          id: d.id,
          label: `${d.number ?? "Draft"} · ${d.clientName ?? ""}`.trim(),
        }));
      case "PROPOSAL":
        return (proposals.data?.data ?? []).map((d) => ({
          id: d.id,
          label: d.reference ? `${d.reference} · ${d.title}` : d.title,
        }));
      case "OFFER_LETTER":
        return (offers.data?.data ?? []).map((d) => ({
          id: d.id,
          label: `${d.number ?? "Draft"} · ${d.candidateName}`,
        }));
      default:
        return [];
    }
  }, [type, invoices.data, quotations.data, proposals.data, offers.data]);
}

function statusBadge(t: TemplateDetail) {
  if (t.status === "ARCHIVED") return <Badge>Archived</Badge>;
  if (!t.liveVersion) return <Badge tone="info">Draft</Badge>;
  return <Badge tone="success">Published · v{t.liveVersion}</Badge>;
}

function IssueList({
  issues,
  onPick,
  compact,
}: {
  issues: TemplateIssue[];
  onPick?: (issue: TemplateIssue) => void;
  compact?: boolean;
}) {
  return (
    <ul className={cn("divide-y divide-border", compact && "text-[12px]")}>
      {issues.map((issue, i) => (
        <li key={`${issue.code}-${issue.line}-${i}`}>
          <button
            type="button"
            disabled={!issue.line || !onPick}
            onClick={() => onPick?.(issue)}
            className="flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-accent/50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            {issue.severity === "error" ? (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            ) : (
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
            <span className="min-w-0 flex-1">{issue.message}</span>
            {issue.line && (
              <span className="shrink-0 font-mono-num text-[11px] text-muted-foreground">
                Ln {issue.line}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- preview pane

function PreviewPane({
  template,
  html,
  documentId,
  onDocumentChange,
  renderSignal,
}: {
  template: TemplateDetail;
  html: string;
  documentId: string;
  onDocumentChange: (id: string) => void;
  /** Bumped by Cmd/Ctrl-Enter in the editor: render the PDF now. */
  renderSignal: number;
}) {
  const [mode, setMode] = useState<"pdf" | "browser">("pdf");
  const [auto, setAuto] = useState(true);
  const documents = usePreviewDocuments(template.documentType);
  const docParam = documentId === SAMPLE ? undefined : documentId;

  // ---- browser (instant HTML)
  const debouncedHtml = useDebouncedValue(html, 400);
  const [browserHtml, setBrowserHtml] = useState<string | null>(null);
  const [browserError, setBrowserError] = useState<{
    message: string;
    issues: TemplateIssue[];
  } | null>(null);
  useEffect(() => {
    if (mode !== "browser") return;
    let cancelled = false;
    templatesApi
      .previewHtml({
        documentType: template.documentType,
        html: debouncedHtml,
        documentId: docParam,
      })
      .then((r) => {
        if (cancelled) return;
        setBrowserHtml(r.html);
        setBrowserError(null);
      })
      .catch(
        (err: Error) =>
          !cancelled && setBrowserError({ message: err.message, issues: issuesFrom(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [mode, debouncedHtml, docParam, template.documentType]);

  // Scale the A4-wide document to the pane width.
  const frameBox = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = frameBox.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setScale(Math.min(1, entry.contentRect.width / A4_WIDTH)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);

  // ---- real PDF
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<{ message: string; issues: TemplateIssue[] } | null>(
    null,
  );
  const [rendering, setRendering] = useState(false);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const currentKey = `${documentId}\u0000${html}`;
  const stale = renderedKey !== null && renderedKey !== currentKey;
  const urlRef = useRef<string | null>(null);

  const render = useCallback(async () => {
    const key = `${documentId}\u0000${html}`;
    setRendering(true);
    try {
      const url = await previewPdfUrl({
        documentType: template.documentType,
        html,
        documentId: docParam,
      });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setPdfUrl(url);
      setPdfError(null);
    } catch (err) {
      setPdfError({ message: (err as Error).message, issues: issuesFrom(err) });
    } finally {
      setRenderedKey(key);
      setRendering(false);
    }
  }, [documentId, html, docParam, template.documentType]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (renderSignal === 0) return;
    setMode("pdf");
    void render();
    // Only an explicit request (the signal) triggers this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderSignal]);

  const debouncedKey = useDebouncedValue(currentKey, 1500);
  useEffect(() => {
    if (mode === "pdf" && auto && debouncedKey !== renderedKey && !rendering) void render();
    // Only the debounced source should trigger an auto render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, auto, debouncedKey]);

  return (
    <Card className="flex h-full min-h-[480px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {(["pdf", "browser"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-2.5 py-1 text-[12px] font-medium transition-colors",
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "pdf" ? "PDF" : "Browser"}
            </button>
          ))}
        </div>
        <Select value={documentId} onValueChange={onDocumentChange}>
          <SelectTrigger className="h-8 w-[200px] text-[12px]">
            <SelectValue placeholder="Preview with" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SAMPLE}>Sample data</SelectItem>
            {documents.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mode === "pdf" && (
          <div className="ml-auto flex items-center gap-2">
            {stale && !rendering && (
              <span className="text-[11.5px] text-amber-600 dark:text-amber-400">Out of date</span>
            )}
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Switch checked={auto} onCheckedChange={setAuto} /> Auto
            </label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void render()}
              disabled={rendering}
            >
              {rendering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}{" "}
              Render
            </Button>
          </div>
        )}
      </div>
      <p className="border-b border-border px-3 py-1.5 text-[11.5px] text-muted-foreground">
        {mode === "pdf"
          ? "The real PDF, rendered on the server - page size, margins and page numbers as sent."
          : "Instant and approximate - no page breaks or page numbers. Scripts never run."}
      </p>

      <div className="relative min-h-0 flex-1 bg-surface/60">
        {mode === "pdf" ? (
          <>
            {pdfError && (
              <div className="absolute inset-x-0 top-0 z-10 border-b border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                <p className="px-3 pt-2 text-[12px] font-medium">{pdfError.message}</p>
                {pdfError.issues.length > 0 && <IssueList issues={pdfError.issues} compact />}
              </div>
            )}
            {pdfUrl ? (
              <iframe title="PDF preview" src={pdfUrl} className="h-full w-full border-0" />
            ) : (
              <div className="grid h-full place-items-center text-[12.5px] text-muted-foreground">
                {rendering ? <Loader2 className="h-5 w-5 animate-spin" /> : "Render to see the PDF"}
              </div>
            )}
            {rendering && pdfUrl && (
              <div className="absolute right-3 top-3 rounded-md bg-card/90 p-1.5 shadow">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div ref={frameBox} className="h-full overflow-auto p-3">
            {browserError && (
              <div className="mb-2 rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                <p className="px-3 pt-2 text-[12px] font-medium">{browserError.message}</p>
                {browserError.issues.length > 0 && (
                  <IssueList issues={browserError.issues} compact />
                )}
              </div>
            )}
            {browserHtml !== null && (
              <div
                style={{ width: A4_WIDTH * scale, height: 1123 * scale }}
                className="mx-auto overflow-hidden bg-white shadow"
              >
                <iframe
                  title="Browser preview"
                  sandbox=""
                  srcDoc={browserHtml}
                  style={{
                    width: A4_WIDTH,
                    height: 1123,
                    transform: `scale(${scale})`,
                    transformOrigin: "0 0",
                  }}
                  className="border-0 bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- variables tab

function VariableNode({
  spec,
  path,
  depth,
  onInsert,
}: {
  spec: VarSpec;
  path: string;
  depth: number;
  onInsert: (snippet: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!spec.children?.length;
  const alias = itemAlias(spec.key);
  const insert = () => {
    if (spec.type === "list")
      onInsert(
        `{% for ${alias} in ${path} %}\n  {{ ${alias}.${spec.children?.[0]?.key ?? "name"} }}\n{% endfor %}`,
      );
    else if (spec.type === "html") onInsert(`{{ ${path} | html }}`);
    else if (spec.type === "money") onInsert(`{{ ${path} | money }}`);
    else if (spec.type === "date") onInsert(`{{ ${path} | date_format }}`);
    else if (spec.type === "image") onInsert(`<img src="{{ ${path} }}" alt="">`);
    else onInsert(`{{ ${path} }}`);
  };
  return (
    <li>
      <div
        className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 text-muted-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <button
          type="button"
          onClick={insert}
          className="min-w-0 flex-1 text-left"
          title="Insert at cursor"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">{spec.label}</span>
            <code className="font-mono text-[11.5px] text-muted-foreground">{path}</code>
            <Badge>{spec.type}</Badge>
          </span>
          {spec.description && (
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              {spec.description}
            </span>
          )}
        </button>
      </div>
      {hasChildren && open && (
        <ul>
          {spec.children!.map((child) => (
            <VariableNode
              key={child.key}
              spec={child}
              path={spec.type === "list" ? `${alias}.${child.key}` : `${path}.${child.key}`}
              depth={depth + 1}
              onInsert={onInsert}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function VariablesTab({
  catalog,
  type,
  onInsert,
}: {
  catalog: TemplateCatalog | undefined;
  type: TemplatedType;
  onInsert: (snippet: string) => void;
}) {
  if (!catalog) return <Skeleton className="h-64 w-full" />;
  const cheats: [string, string][] = [
    ["Print a value", "{{ invoice.number }}"],
    ["Fallback when empty", '{{ client.email | default: "-" }}'],
    ["Condition", "{% if invoice.due_date %} … {% else %} … {% endif %}"],
    ["Loop over a list", "{% for line in lines %} {{ line.description }} {% endfor %}"],
    ["Rich text from the app", "{{ section.content | html }}"],
    ["Page numbers", '<meta name="page-numbers" content="bottom-right">'],
    ["Page size & margins", "@page { size: A4; margin: 12mm; }"],
    ["Keep together on a page", "tr, .block { page-break-inside: avoid; }"],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">Variables</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            What a {DOCUMENT_TYPE_LABEL[type].toLowerCase()} can print. Click one to insert it at
            the cursor in the Design tab.
          </p>
        </div>
        <ul className="p-2">
          {catalog.variables[type].map((spec) => (
            <VariableNode
              key={spec.key}
              spec={spec}
              path={spec.key}
              depth={0}
              onInsert={onInsert}
            />
          ))}
        </ul>
      </Card>
      <div className="space-y-4">
        <Card>
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-[13px] font-semibold">Formatters</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Pipe a value through these: {"{{ value | money }}"}.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {catalog.filters.map((f) => (
              <li key={f.name} className="px-5 py-2.5">
                <button
                  type="button"
                  onClick={() => onInsert(f.example)}
                  className="block w-full text-left"
                  title="Insert example"
                >
                  <code className="font-mono text-[12px] font-semibold">{f.name}</code>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {f.description}
                  </span>
                  <code className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    {f.example}
                  </code>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-[13px] font-semibold">Cheat sheet</h3>
          </div>
          <ul className="divide-y divide-border">
            {cheats.map(([label, code]) => (
              <li key={label} className="px-5 py-2.5">
                <div className="text-[12px] text-muted-foreground">{label}</div>
                <code className="mt-0.5 block break-all font-mono text-[11.5px]">{code}</code>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-5 py-3 text-[11.5px] text-muted-foreground">
            Scripts never run. Images and fonts load only from{" "}
            {catalog.limits.allowedAssetHosts.join(", ")}. Use the Image button above the code to
            upload one, or <code className="font-mono">{"{{ company.logo_url }}"}</code> for your
            logo.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- versions tab

function VersionsTab({
  template,
  canEdit,
  dirty,
  onRolledBack,
}: {
  template: TemplateDetail;
  canEdit: boolean;
  dirty: boolean;
  onRolledBack: () => void;
}) {
  const { data: versions, isLoading } = useTemplateVersions(template.id);
  const { data: events } = useTemplateEvents(template.id);
  const { rollback } = useTemplateMutations();
  const [target, setTarget] = useState<number | null>(null);

  const openPdf = async (version: number) => {
    const win = window.open("", "_blank");
    try {
      const url = await versionPdfUrl(template.id, version);
      if (win) win.location.href = url;
      else window.open(url, "_blank");
    } catch (err) {
      win?.close();
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">Versions</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Published versions never change. Issued documents keep the version they were first
            rendered with.
          </p>
        </div>
        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !versions?.length ? (
          <div className="p-5">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Not published yet"
              description="Publish the draft to create version 1."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="font-mono-num text-[13px] font-semibold">v{v.version}</span>
                {v.version === template.liveVersion && <Badge tone="success">Live</Badge>}
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">
                  {v.notes || "No notes"}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {relativeTime(v.createdAt)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => void openPdf(v.version)}>
                  <ExternalLink className="h-3.5 w-3.5" /> Preview PDF
                </Button>
                {canEdit && v.version !== template.liveVersion && (
                  <Button size="sm" variant="secondary" onClick={() => setTarget(v.version)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Roll back
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[13px] font-semibold">Activity</h3>
        </div>
        <ol className="space-y-3 px-5 py-4">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground/50" />
              <div>
                <div className="text-[13px] font-medium">
                  {EVENT_LABEL[e.action] ?? e.action}
                  {e.version ? ` · v${e.version}` : ""}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {relativeTime(e.createdAt)}
                  {e.notes ? ` · ${e.notes}` : ""}
                </div>
              </div>
            </li>
          ))}
          {!events?.length && (
            <li className="text-[12.5px] text-muted-foreground">No activity yet.</li>
          )}
        </ol>
      </Card>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back to v{target}?</AlertDialogTitle>
            <AlertDialogDescription>
              v{target} is republished as v{(template.liveVersion ?? 0) + 1} and goes live for new
              documents. The draft is replaced with it
              {dirty ? " - your unsaved changes will be lost" : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                target !== null &&
                rollback.mutate(
                  { id: template.id, version: target },
                  {
                    onSuccess: () => {
                      setTarget(null);
                      onRolledBack();
                    },
                  },
                )
              }
            >
              Roll back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------- details tab

function DetailsTab({ template, canEdit }: { template: TemplateDetail; canEdit: boolean }) {
  const { update } = useTemplateMutations();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const changed = name.trim() !== template.name || description !== (template.description ?? "");
  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40 disabled:opacity-60";

  return (
    <Card className="max-w-2xl">
      <div className="space-y-4 p-5">
        <div className="space-y-1.5">
          <label htmlFor="tpl-name" className="text-[12.5px] font-medium">
            Name
          </label>
          <input
            id="tpl-name"
            value={name}
            disabled={!canEdit}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tpl-desc" className="text-[12.5px] font-medium">
            Description
          </label>
          <textarea
            id="tpl-desc"
            value={description}
            disabled={!canEdit}
            maxLength={2000}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <dt className="text-muted-foreground">Document type</dt>
            <dd>{DOCUMENT_TYPE_LABEL[template.documentType]}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{relativeTime(template.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scope</dt>
            <dd>{template.orgId ? "This organization" : "Platform starter"}</dd>
          </div>
        </dl>
        {canEdit && (
          <div className="flex justify-end">
            <Button
              disabled={!changed || !name.trim() || update.isPending}
              onClick={() => update.mutate({ id: template.id, name: name.trim(), description })}
            >
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save details
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Offer letters only: the clause wording a new offer starts from when it uses this template.
 * Saved straight away (no publish step) - it's copied into each offer at creation, so issued
 * letters never change with it.
 */
function WordingTab({
  template,
  catalog,
  canEdit,
}: {
  template: TemplateDetail;
  catalog: TemplateCatalog | undefined;
  canEdit: boolean;
}) {
  const { update } = useTemplateMutations();
  const standard = catalog?.offerLetterBodies.FULL_TIME ?? "";
  const [body, setBody] = useState(template.defaultBody ?? standard);
  useEffect(() => {
    if (!template.defaultBody && standard) setBody(standard);
  }, [template.defaultBody, standard]);
  const changed = body !== (template.defaultBody ?? standard);

  return (
    <Card className="max-w-4xl">
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          The clauses a new offer using this template starts with. Placeholders like{" "}
          <code className="font-mono">{"{{position}}"}</code>,{" "}
          <code className="font-mono">{"{{startDate}}"}</code> and{" "}
          <code className="font-mono">{"{{ctc}}"}</code> are filled from the offer, and each offer
          can still edit its own copy. Need different wording per role? Make a copy of this template
          (e.g. “Engineering offer”) and pick it on the offer.
        </p>
        {!template.defaultBody && (
          <p className="text-[12px] text-muted-foreground">
            Using the standard wording - offers get the version for their employment type until you
            save your own.
          </p>
        )}
        <RichTextEditor value={body} onChange={setBody} editable={canEdit} />
        {canEdit && (
          <div className="flex justify-end gap-2">
            {template.defaultBody && (
              <Button
                variant="ghost"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: template.id, defaultBody: "" },
                    { onSuccess: () => setBody(standard) },
                  )
                }
              >
                <RotateCcw className="h-3.5 w-3.5" /> Use standard wording
              </Button>
            )}
            <Button
              disabled={!changed || update.isPending}
              onClick={() => update.mutate({ id: template.id, defaultBody: body })}
            >
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save wording
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- page

export function TemplateEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = (TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "design") as Tab;
  const setTab = (next: Tab) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (next === "design") qs.delete("tab");
    else qs.set("tab", next);
    const q = qs.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const role = getStoredAuth()?.user?.role;
  const { data: template, isLoading, error, refetch } = useTemplate(id);
  const { data: catalog } = useTemplateCatalog();
  const mutations = useTemplateMutations();
  const canEdit = (role === "OWNER" || role === "ADMIN") && template?.status !== "ARCHIVED";

  // Local working copy of the draft. `revision`/`savedHtml` track what's on the server.
  const [html, setHtml] = useState("");
  const [savedHtml, setSavedHtml] = useState("");
  const [revision, setRevision] = useState(0);
  const [issues, setIssues] = useState<TemplateIssue[]>([]);
  const [conflict, setConflict] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [documentId, setDocumentId] = useState(SAMPLE);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState("");
  const [publishIssues, setPublishIssues] = useState<TemplateIssue[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [renderSignal, setRenderSignal] = useState(0);
  const editorApi = useRef<TemplateEditorApi | null>(null);
  const dirty = html !== savedHtml;

  /** Adopt the server's draft (first load, discard, rollback, reload after a conflict). */
  const adopt = useCallback((t: TemplateDetail) => {
    setHtml(t.draftHtml);
    setSavedHtml(t.draftHtml);
    setRevision(t.draftRevision);
    setIssues(t.issues);
    setConflict(false);
  }, []);

  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (template && loadedId.current !== template.id) {
      loadedId.current = template.id;
      adopt(template);
    }
  }, [template, adopt]);

  const reload = async () => {
    const { data } = await refetch();
    if (data) adopt(data);
  };

  // Debounced validation of the unsaved HTML (lint + sample render).
  const debouncedHtml = useDebouncedValue(html, 1000);
  useEffect(() => {
    if (!template || !debouncedHtml) return;
    let cancelled = false;
    templatesApi
      .validate({ documentType: template.documentType, html: debouncedHtml })
      .then((r) => !cancelled && setIssues(r.issues))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedHtml, template]);

  const save = useCallback(async (): Promise<number | null> => {
    if (!template || !canEdit) return null;
    if (!dirty) return revision;
    try {
      const saved = await mutations.saveDraft.mutateAsync({
        id: template.id,
        expectedRevision: revision,
        html,
      });
      setRevision(saved.draftRevision);
      setSavedHtml(html);
      setIssues(saved.issues);
      return saved.draftRevision;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else toast.error((err as Error).message);
      return null;
    }
  }, [template, canEdit, dirty, revision, html, mutations.saveDraft]);

  // Cmd/Ctrl-S anywhere on the page (the editor handles it itself when focused).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && !e.defaultPrevented) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const publish = async () => {
    if (!template) return;
    const rev = await save();
    if (rev === null) return;
    try {
      await mutations.publish.mutateAsync({
        id: template.id,
        expectedRevision: rev,
        notes: publishNotes.trim() || undefined,
      });
      setPublishOpen(false);
      setPublishNotes("");
      setPublishIssues([]);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
        setPublishOpen(false);
        return;
      }
      setPublishIssues(issuesFrom(err));
      toast.error((err as Error).message);
    }
  };

  const imageInput = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadTemplateImage(file);
      editorApi.current?.insert(`<img src="${url}" alt="" style="max-width: 100%;">`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the image");
    } finally {
      setUploadingImage(false);
    }
  };

  const insert = (snippet: string) => {
    setTab("design");
    // The editor stays mounted across tabs; wait a frame for the Design pane to show.
    requestAnimationFrame(() => editorApi.current?.insert(snippet));
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.length - errorCount;

  if (isLoading) {
    return (
      <AppShell>
        <PageBody className="space-y-4">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-8 w-72" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[60vh] w-full" />
            <Skeleton className="h-[60vh] w-full" />
          </div>
        </PageBody>
      </AppShell>
    );
  }

  if (!template) {
    return (
      <AppShell>
        <PageBody>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Template not found"
            description={(error as Error | null)?.message}
            action={
              <Link href="/business/templates">
                <Button variant="secondary">Back to templates</Button>
              </Link>
            }
          />
        </PageBody>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageBody className="space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <nav className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Link href="/business/templates" className="hover:text-foreground">
              Templates
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="truncate text-foreground">{template.name}</span>
          </nav>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {DOCUMENT_TYPE_LABEL[template.documentType]}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">
                  {template.name}
                </h1>
                {statusBadge(template)}
                {template.isDefault && (
                  <Badge tone="success">
                    <Star className="h-3 w-3" /> Default
                  </Badge>
                )}
                {template.liveVersion && template.hasUnpublishedChanges && (
                  <Badge tone="warning">Unpublished changes</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(template.key);
                    toast.success("Key copied");
                  }}
                  className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[11.5px] hover:text-foreground"
                >
                  {template.key} <Copy className="h-3 w-3" />
                </button>
                <span>{dirty ? "Unsaved changes" : `Saved · revision ${revision}`}</span>
                {!template.orgId && (
                  <span>· Platform starter - only super admins can save changes</span>
                )}
                {!canEdit && template.orgId && <span>· Read only</span>}
              </div>
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void save()}
                  disabled={!dirty || mutations.saveDraft.isPending}
                >
                  {mutations.saveDraft.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save draft
                </Button>
                <Button
                  onClick={() => {
                    setPublishIssues([]);
                    setPublishOpen(true);
                  }}
                  disabled={!dirty && !template.hasUnpublishedChanges && !!template.liveVersion}
                >
                  <Rocket className="h-3.5 w-3.5" /> Publish
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!template.liveVersion || template.isDefault || !template.orgId}
                      onClick={() => mutations.setDefault.mutate(template.id)}
                    >
                      <Star className="h-3.5 w-3.5" /> Make default
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!template.liveVersion}
                      onClick={() => setDiscardOpen(true)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Discard draft
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={template.isDefault}
                      onClick={() => mutations.archive.mutate({ id: template.id, archived: true })}
                    >
                      <ArchiveIcon className="h-3.5 w-3.5" /> Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {template.status === "ARCHIVED" && (role === "OWNER" || role === "ADMIN") && (
              <Button
                variant="secondary"
                onClick={() => mutations.archive.mutate({ id: template.id, archived: false })}
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Restore
              </Button>
            )}
          </div>
        </div>

        {conflict && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="flex-1">
              Someone else saved this template - reload to get their changes. Your edits here will
              be replaced.
            </span>
            <Button size="sm" variant="secondary" onClick={() => void reload()}>
              Reload
            </Button>
          </div>
        )}

        <nav className="flex items-center gap-1 border-b border-border">
          {TABS.filter((t) => !t.only || t.only === template.documentType).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors",
                tab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.key === "design" && errorCount > 0 && (
                <span className="ml-1.5 rounded bg-rose-500/15 px-1 font-mono-num text-[10.5px] text-rose-600">
                  {errorCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Design stays mounted so the editor keeps its undo history across tabs. */}
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
            tab !== "design" && "hidden",
          )}
        >
          <div className="flex min-w-0 flex-col gap-3">
            <Card className="flex h-[62vh] min-h-[420px] flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12px]">
                <span className="font-semibold">HTML</span>
                <span className="text-muted-foreground">+ Liquid</span>
                {canEdit && (
                  <>
                    <input
                      ref={imageInput}
                      type="file"
                      accept={COMMENT_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadImage(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => imageInput.current?.click()}
                      disabled={uploadingImage}
                      title="Upload an image and insert it at the cursor"
                      className="ml-auto flex items-center gap-1 rounded px-1.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-60"
                    >
                      {uploadingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      Image
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setWrap((w) => !w)}
                  aria-pressed={wrap}
                  title="Wrap lines"
                  className={cn(
                    "rounded p-1",
                    !canEdit && "ml-auto",
                    wrap
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <WrapText className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono-num text-muted-foreground">
                  {html.length.toLocaleString()} /{" "}
                  {(catalog?.limits.maxHtmlLength ?? 500000).toLocaleString()}
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <TemplateCodeEditor
                  value={html}
                  onChange={setHtml}
                  issues={issues}
                  onSave={() => void save()}
                  onRender={() => setRenderSignal((n) => n + 1)}
                  variables={catalog?.variables[template.documentType] ?? []}
                  filters={catalog?.filters ?? []}
                  readOnly={!canEdit}
                  wrap={wrap}
                  onReady={(api) => {
                    editorApi.current = api;
                  }}
                />
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12.5px]">
                <span className="font-semibold">Problems</span>
                <span className="text-muted-foreground">
                  {issues.length === 0
                    ? "none"
                    : `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`}
                </span>
              </div>
              {issues.length === 0 ? (
                <p className="px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  No problems. Check the PDF preview, then publish.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  <IssueList
                    issues={issues}
                    onPick={(issue) => issue.line && editorApi.current?.goToLine(issue.line)}
                  />
                </div>
              )}
            </Card>
          </div>
          <div className="min-w-0 lg:h-[calc(62vh+120px)]">
            <PreviewPane
              template={template}
              html={html}
              documentId={documentId}
              onDocumentChange={setDocumentId}
              renderSignal={renderSignal}
            />
          </div>
        </div>

        {tab === "wording" && template.documentType === "OFFER_LETTER" && (
          <WordingTab template={template} catalog={catalog} canEdit={canEdit} />
        )}
        {tab === "variables" && (
          <VariablesTab catalog={catalog} type={template.documentType} onInsert={insert} />
        )}
        {tab === "versions" && (
          <VersionsTab
            template={template}
            canEdit={canEdit}
            dirty={dirty}
            onRolledBack={() => void reload()}
          />
        )}
        {tab === "details" && (
          <DetailsTab key={template.updatedAt} template={template} canEdit={canEdit} />
        )}
      </PageBody>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish v{(template.liveVersion ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            Publishing checks the template, renders it with sample data and makes it live for new{" "}
            {DOCUMENT_TYPE_LABEL[template.documentType].toLowerCase()}s
            {template.isDefault || !template.liveVersion ? "" : " that use this template"}.
            {dirty && " Your unsaved changes are saved first."}
          </p>
          <textarea
            value={publishNotes}
            onChange={(e) => setPublishNotes(e.target.value)}
            placeholder="Release notes (optional)"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
          />
          {publishIssues.length > 0 && (
            <div className="overflow-hidden rounded-md border border-rose-500/20">
              <IssueList
                issues={publishIssues}
                onPick={(issue) => {
                  setPublishOpen(false);
                  setTab("design");
                  if (issue.line)
                    requestAnimationFrame(() => editorApi.current?.goToLine(issue.line!));
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void publish()}
              disabled={mutations.publish.isPending || mutations.saveDraft.isPending}
            >
              {(mutations.publish.isPending || mutations.saveDraft.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft goes back to the live version (v{template.liveVersion}). Saved and unsaved
              draft changes are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                mutations.discardDraft.mutate(
                  { id: template.id, expectedRevision: revision },
                  { onSuccess: () => void reload() },
                )
              }
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
