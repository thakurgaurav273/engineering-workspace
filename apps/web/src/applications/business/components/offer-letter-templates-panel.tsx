import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@grovyn/ui/primitives";
import { RichTextEditor } from "@/shared/components/rich-text-editor";
import {
  useOfferLetterTemplates,
  useOfferLetterTemplateMutations,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  type EmploymentType,
} from "@/applications/business/lib/business-offer-letters";

/**
 * Business Settings — editable offer-letter clause templates, one per employment type. Edits
 * here become the pre-fill source for new offers of that type. {{placeholders}} (e.g. {{company}},
 * {{position}}, {{startDate}}) are resolved from each offer's fields when it is created.
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
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const current = data?.find((t) => t.employmentType === type);

  useEffect(() => {
    if (current) {
      setContent(current.content);
      setDirty(false);
    }
  }, [current?.employmentType, current?.content]);

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

  const onSave = () =>
    save.mutate(
      { type, content },
      {
        onSuccess: () => {
          toast.success(`${EMPLOYMENT_TYPE_LABELS[type]} template saved`);
          setDirty(false);
        },
        onError: () => toast.error("Couldn’t save the template"),
      },
    );

  const onReset = () =>
    reset.mutate(type, {
      onSuccess: (t) => {
        setContent(t.content);
        setDirty(false);
        toast.success("Reverted to the default template");
      },
      onError: () => toast.error("Couldn’t reset the template"),
    });

  const pending = save.isPending || reset.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {EMPLOYMENT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              type === t
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {EMPLOYMENT_TYPE_LABELS[t]}
          </button>
        ))}
        {current?.isDefault ? (
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
            Using default
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
            Customised
          </span>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground">
        These clauses pre-fill new {EMPLOYMENT_TYPE_LABELS[type].toLowerCase()} offers. Use
        placeholders like <code className="rounded bg-surface px-1">{"{{company}}"}</code>,{" "}
        <code className="rounded bg-surface px-1">{"{{position}}"}</code>,{" "}
        <code className="rounded bg-surface px-1">{"{{startDate}}"}</code>,{" "}
        <code className="rounded bg-surface px-1">{"{{noticePeriod}}"}</code> — they’re filled from
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
          {!current?.isDefault ? (
            <Button variant="outline" onClick={onReset} disabled={pending}>
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
