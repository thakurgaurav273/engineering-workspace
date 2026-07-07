import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@grovyn/ui/primitives";
import { RichTextEditor } from "@/shared/components/rich-text-editor";
import {
  useOfferLetterTemplates,
  useOfferLetterTemplateMutations,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
  type OfferLetterTemplate,
} from "@/applications/business/lib/business-offer-letters";

/**
 * Business Settings — editable offer-letter clause templates, organised by employment type and,
 * within each type, by job role. The role "" is the base template (used when no role matches an
 * offer's position); named roles (e.g. "SDE") override it. Edits become the pre-fill source for
 * new offers. {{placeholders}} (e.g. {{company}}, {{position}}) resolve from each offer's fields.
 */
export function OfferLetterTemplatesPanel({
  canEdit,
  enabled,
}: {
  canEdit: boolean;
  enabled: boolean;
}) {
  const { data, isLoading, isError } = useOfferLetterTemplates(enabled);
  const { save, reset } = useOfferLetterTemplateMutations();
  const [type, setType] = useState<EmploymentType>("FULL_TIME");
  const [jobRole, setJobRole] = useState(""); // "" = base template
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  // Roles saved for the selected type (base first, then named roles alphabetically).
  const roles = useMemo(() => {
    const forType = (data ?? []).filter((t) => t.employmentType === type);
    return forType.map((t) => t.jobRole);
  }, [data, type]);

  const current: OfferLetterTemplate | undefined = useMemo(
    () => (data ?? []).find((t) => t.employmentType === type && t.jobRole === jobRole),
    [data, type, jobRole],
  );

  // When the selected (type, role) resolves to a template, seed the editor. If the selected role
  // no longer exists (e.g. after a delete), fall back to the base template.
  useEffect(() => {
    if (current) {
      setContent(current.content);
      setDirty(false);
    } else if (jobRole !== "") {
      setJobRole("");
    }
  }, [current?.employmentType, current?.jobRole, current?.content]);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <Card className="p-6 text-[13px] text-muted-foreground">Couldn’t load templates.</Card>;
  }

  const typeLabel = EMPLOYMENT_TYPE_LABELS[type];
  const roleLabel = jobRole || `Base ${typeLabel.toLowerCase()} template`;

  const selectType = (t: EmploymentType) => {
    setType(t);
    setJobRole("");
  };

  const addRole = () => {
    const name = window.prompt(
      `New role template for ${typeLabel}\n\nEnter the job role exactly as it appears in the offer's Position field (e.g. "SDE", "Designer"):`,
    );
    const role = name?.trim();
    if (!role) return;
    if (roles.some((r) => r.toLowerCase() === role.toLowerCase())) {
      toast.error(`A "${role}" template already exists`);
      const existing = roles.find((r) => r.toLowerCase() === role.toLowerCase())!;
      setJobRole(existing);
      return;
    }
    // Seed the new role from whatever is currently in the editor (the base/default clauses).
    save.mutate(
      { type, jobRole: role, content },
      {
        onSuccess: () => {
          toast.success(`${role} template added`);
          setJobRole(role);
        },
        onError: () => toast.error("Couldn’t add the role template"),
      },
    );
  };

  const onSave = () =>
    save.mutate(
      { type, jobRole, content },
      {
        onSuccess: () => {
          toast.success(`${roleLabel} saved`);
          setDirty(false);
        },
        onError: () => toast.error("Couldn’t save the template"),
      },
    );

  // Base → revert to built-in default; named role → delete it and return to the base.
  const onResetOrDelete = () =>
    reset.mutate(
      { type, jobRole },
      {
        onSuccess: (t) => {
          if (jobRole === "") {
            setContent(t.content);
            setDirty(false);
            toast.success("Reverted to the default template");
          } else {
            setJobRole("");
            toast.success(`${jobRole} template deleted`);
          }
        },
        onError: () => toast.error("Couldn’t update the template"),
      },
    );

  const pending = save.isPending || reset.isPending;

  return (
    <div className="space-y-4">
      {/* Employment type */}
      <div className="flex flex-wrap items-center gap-2">
        {EMPLOYMENT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => selectType(t)}
            className={`rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              type === t
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {EMPLOYMENT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Job role within the selected type */}
      <div className="flex flex-wrap items-center gap-2">
        {roles.map((r) => (
          <button
            key={r || "__base__"}
            onClick={() => setJobRole(r)}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              jobRole === r
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {r || `Base template`}
          </button>
        ))}
        {canEdit ? (
          <button
            onClick={addRole}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add role
          </button>
        ) : null}
        {current?.isDefault ? (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            Using default
          </span>
        ) : null}
      </div>

      <p className="text-[12px] text-muted-foreground">
        {jobRole ? (
          <>
            These clauses pre-fill new <strong>{typeLabel.toLowerCase()}</strong> offers whose
            position matches <strong>“{jobRole}”</strong>. Offers with any other position use the
            base template.
          </>
        ) : (
          <>
            The base template pre-fills new {typeLabel.toLowerCase()} offers with no matching role
            template. Add a role to tailor clauses per position.
          </>
        )}{" "}
        Use placeholders like <code className="rounded bg-surface px-1">{"{{company}}"}</code>,{" "}
        <code className="rounded bg-surface px-1">{"{{position}}"}</code>,{" "}
        <code className="rounded bg-surface px-1">{"{{startDate}}"}</code> — they’re filled from
        each offer’s fields.
      </p>

      <RichTextEditor
        value={content}
        editable={canEdit}
        minHeight={420}
        onChange={(html) => {
          setContent(html);
          setDirty(true);
        }}
      />

      {canEdit ? (
        <div className="flex items-center justify-end gap-2">
          {jobRole !== "" ? (
            <Button variant="outline" onClick={onResetOrDelete} disabled={pending}>
              <Trash2 className="h-3.5 w-3.5" /> Delete role
            </Button>
          ) : !current?.isDefault ? (
            <Button variant="outline" onClick={onResetOrDelete} disabled={pending}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </Button>
          ) : null}
          <Button onClick={onSave} disabled={pending || !dirty}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save template
          </Button>
        </div>
      ) : null}
    </div>
  );
}
