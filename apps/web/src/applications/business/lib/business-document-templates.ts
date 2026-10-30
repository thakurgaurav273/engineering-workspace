import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/shared/lib/api";

// Mirrors apps/api/src/business-operations/document-templates. Org-authored HTML + Liquid
// layouts for business documents, with draft → publish → versions, and one default per type.

export type TemplatedType = "INVOICE" | "QUOTATION" | "PROPOSAL" | "OFFER_LETTER";
export type TemplateStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const TEMPLATED_TYPES: TemplatedType[] = [
  "INVOICE",
  "QUOTATION",
  "PROPOSAL",
  "OFFER_LETTER",
];

export const DOCUMENT_TYPE_LABEL: Record<TemplatedType, string> = {
  INVOICE: "Invoice",
  QUOTATION: "Quotation",
  PROPOSAL: "Proposal",
  OFFER_LETTER: "Offer letter",
};

export interface TemplateSummary {
  id: string;
  orgId: string | null;
  documentType: TemplatedType;
  key: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  draftRevision: number;
  draftUpdatedAt: string;
  hasUnpublishedChanges: boolean;
  liveVersion: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  line?: number;
}

export interface TemplateDetail extends TemplateSummary {
  draftHtml: string;
  issues: TemplateIssue[];
}

export interface TemplateVersion {
  id: string;
  version: number;
  notes: string | null;
  publishedById: string | null;
  createdAt: string;
}

export interface TemplateEvent {
  id: string;
  action: string;
  version: number | null;
  notes: string | null;
  actorId: string | null;
  createdAt: string;
}

export type VarType =
  "text" | "number" | "money" | "date" | "html" | "image" | "boolean" | "object" | "list";

export interface VarSpec {
  key: string;
  label: string;
  type: VarType;
  description?: string;
  children?: VarSpec[];
}

export interface TemplateFilter {
  name: string;
  example: string;
  description: string;
}

export interface StarterOption {
  key: string;
  name: string;
  description: string | null;
  documentType: TemplatedType;
  /** Pass as `source` when creating: "builtin:<key>" or "template:<id>". */
  source: string;
  origin?: "built-in" | "platform";
}

export interface TemplateCatalog {
  documentTypes: TemplatedType[];
  variables: Record<TemplatedType, VarSpec[]>;
  filters: TemplateFilter[];
  starters: StarterOption[];
  limits: { maxHtmlLength: number; allowedAssetHosts: string[] };
}

const BASE = "/business/document-templates";

/** Issues the server attached to a failed call (publish with errors, render failure…). */
export function issuesFrom(error: unknown): TemplateIssue[] {
  const details = error instanceof ApiError ? error.details : undefined;
  return Array.isArray(details?.issues) ? (details.issues as TemplateIssue[]) : [];
}

export const templatesApi = {
  catalog: () => api.get<TemplateCatalog>(`${BASE}/catalog`),
  starters: (documentType?: TemplatedType) =>
    api.get<StarterOption[]>(
      `${BASE}/starters${documentType ? `?documentType=${documentType}` : ""}`,
    ),
  list: (
    params: { documentType?: TemplatedType; includeArchived?: boolean; platform?: boolean } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.documentType) qs.set("documentType", params.documentType);
    if (params.includeArchived) qs.set("includeArchived", "true");
    if (params.platform) qs.set("platform", "true");
    const q = qs.toString();
    return api.get<TemplateSummary[]>(`${BASE}${q ? `?${q}` : ""}`);
  },
  get: (id: string) => api.get<TemplateDetail>(`${BASE}/${id}`),
  create: (body: {
    documentType: TemplatedType;
    name: string;
    description?: string;
    source?: string;
    platform?: boolean;
  }) => api.post<TemplateSummary>(BASE, body),
  update: (id: string, body: { name?: string; description?: string }) =>
    api.patch<TemplateSummary>(`${BASE}/${id}`, body),
  saveDraft: (id: string, body: { expectedRevision: number; html: string }) =>
    api.post<TemplateSummary & { issues: TemplateIssue[] }>(`${BASE}/${id}/draft`, body),
  discardDraft: (id: string, expectedRevision: number) =>
    api.post<TemplateSummary>(`${BASE}/${id}/discard-draft`, { expectedRevision }),
  publish: (id: string, body: { expectedRevision: number; notes?: string }) =>
    api.post<TemplateSummary>(`${BASE}/${id}/publish`, body),
  rollback: (id: string, body: { version: number; notes?: string }) =>
    api.post<TemplateSummary>(`${BASE}/${id}/rollback`, body),
  setDefault: (id: string) => api.post<TemplateSummary>(`${BASE}/${id}/default`),
  archive: (id: string) => api.post<TemplateSummary>(`${BASE}/${id}/archive`),
  restore: (id: string) => api.post<TemplateSummary>(`${BASE}/${id}/restore`),
  versions: (id: string) => api.get<TemplateVersion[]>(`${BASE}/${id}/versions`),
  events: (id: string) => api.get<TemplateEvent[]>(`${BASE}/${id}/events`),
  validate: (body: { documentType: TemplatedType; html: string; documentId?: string }) =>
    api.post<{ issues: TemplateIssue[] }>(`${BASE}/validate`, body),
  previewHtml: (body: { documentType: TemplatedType; html: string; documentId?: string }) =>
    api.post<{ html: string }>(`${BASE}/preview`, { ...body, format: "html" }),
};

/** POSTs to the preview endpoint and returns the PDF as a blob URL (caller revokes it). */
export async function previewPdfUrl(body: {
  documentType: TemplatedType;
  html: string;
  documentId?: string;
}): Promise<string> {
  return pdfBlobUrl(`${BASE}/preview`, {
    method: "POST",
    body: JSON.stringify({ ...body, format: "pdf" }),
  });
}

export function versionPdfUrl(id: string, version: number): Promise<string> {
  return pdfBlobUrl(`${BASE}/${id}/versions/pdf?version=${version}`, { method: "GET" });
}

async function pdfBlobUrl(path: string, init: RequestInit): Promise<string> {
  const { getStoredAuth } = await import("@/platform/auth/auth");
  const base = process.env.NEXT_PUBLIC_API_URL || "/api";
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredAuth()?.accessToken ?? ""}`,
    },
  });
  if (!res.ok) {
    let message = "Couldn't render the PDF";
    let details: Record<string, unknown> | undefined;
    try {
      const json = await res.json();
      message = json.message ?? message;
      details = json.errors;
    } catch {
      // not JSON
    }
    throw new ApiError(message, res.status, details);
  }
  return URL.createObjectURL(await res.blob());
}

// ---------------------------------------------------------------- hooks

const KEY = ["business", "document-templates"] as const;

export function useTemplateCatalog() {
  return useQuery({
    queryKey: [...KEY, "catalog"],
    queryFn: templatesApi.catalog,
    staleTime: 10 * 60 * 1000,
  });
}

export function useTemplates(
  params: { documentType?: TemplatedType; includeArchived?: boolean; platform?: boolean } = {},
) {
  return useQuery({ queryKey: [...KEY, "list", params], queryFn: () => templatesApi.list(params) });
}

export function useStarters(documentType?: TemplatedType) {
  return useQuery({
    queryKey: [...KEY, "starters", documentType ?? "all"],
    queryFn: () => templatesApi.starters(documentType),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => templatesApi.get(id),
    enabled: !!id,
  });
}

export function useTemplateVersions(id: string) {
  return useQuery({
    queryKey: [...KEY, "detail", id, "versions"],
    queryFn: () => templatesApi.versions(id),
    enabled: !!id,
  });
}

export function useTemplateEvents(id: string) {
  return useQuery({
    queryKey: [...KEY, "detail", id, "events"],
    queryFn: () => templatesApi.events(id),
    enabled: !!id,
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });
  const onError = (err: Error) => toast.error(err.message);
  return {
    create: useMutation({ mutationFn: templatesApi.create, onSuccess: invalidate, onError }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string }) =>
        templatesApi.update(id, body),
      onSuccess: () => {
        invalidate();
        toast.success("Details saved");
      },
      onError,
    }),
    // Save/publish errors are handled by the editor (conflicts, issues), so no toast here.
    saveDraft: useMutation({
      mutationFn: ({ id, ...body }: { id: string; expectedRevision: number; html: string }) =>
        templatesApi.saveDraft(id, body),
      onSuccess: invalidate,
    }),
    publish: useMutation({
      mutationFn: ({ id, ...body }: { id: string; expectedRevision: number; notes?: string }) =>
        templatesApi.publish(id, body),
      onSuccess: (t) => {
        invalidate();
        toast.success(`Published v${t.liveVersion}`);
      },
    }),
    discardDraft: useMutation({
      mutationFn: ({ id, expectedRevision }: { id: string; expectedRevision: number }) =>
        templatesApi.discardDraft(id, expectedRevision),
      onSuccess: () => {
        invalidate();
        toast.success("Draft reset to the live version");
      },
      onError,
    }),
    rollback: useMutation({
      mutationFn: ({ id, ...body }: { id: string; version: number; notes?: string }) =>
        templatesApi.rollback(id, body),
      onSuccess: (t) => {
        invalidate();
        toast.success(`Rolled back - now live as v${t.liveVersion}`);
      },
      onError,
    }),
    setDefault: useMutation({
      mutationFn: templatesApi.setDefault,
      onSuccess: (t) => {
        invalidate();
        toast.success(`${t.name} is now the default`);
      },
      onError,
    }),
    archive: useMutation({
      mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
        archived ? templatesApi.archive(id) : templatesApi.restore(id),
      onSuccess: (_t, { archived }) => {
        invalidate();
        toast.success(archived ? "Template archived" : "Template restored");
      },
      onError,
    }),
  };
}
