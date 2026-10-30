import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { cn } from "@grovyn/utils";
import { Badge, Button, Skeleton } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import {
  DOCUMENT_TYPE_LABEL,
  TEMPLATED_TYPES,
  useStarters,
  useTemplateMutations,
  type StarterOption,
  type TemplatedType,
} from "@/applications/business/lib/business-document-templates";

const BLANK = "blank";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40";

/** Pick a document type and a starting point (starter or blank), name it, then open the editor. */
export function NewTemplateDialog({
  open,
  onOpenChange,
  defaultType,
  platform,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TemplatedType;
  /** Create a platform starter (super admins). */
  platform?: boolean;
}) {
  const navigate = useRouter();
  const [type, setType] = useState<TemplatedType>(defaultType ?? "INVOICE");
  const [source, setSource] = useState<string>(BLANK);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  // All types' starters in one request, filtered locally: switching the type tab then never
  // shows a loading state, so the dialog keeps its height instead of jumping.
  const { data: allStarters, isLoading } = useStarters();
  const starters = useMemo(
    () => allStarters?.filter((s) => s.documentType === type),
    [allStarters, type],
  );
  const { create } = useTemplateMutations();

  useEffect(() => {
    if (!open) return;
    setType(defaultType ?? "INVOICE");
    setSource(BLANK);
    setName("");
    setNameTouched(false);
    setDescription("");
  }, [open, defaultType]);

  // Default to the first starter of the type; the name follows the pick until edited.
  useEffect(() => {
    if (!open || !starters) return;
    setSource((current) =>
      current === BLANK || !starters.some((s) => s.source === current)
        ? (starters[0]?.source ?? BLANK)
        : current,
    );
  }, [open, starters]);

  const picked: StarterOption | undefined = starters?.find((s) => s.source === source);
  useEffect(() => {
    if (nameTouched) return;
    setName(picked ? `${picked.name} copy` : `${DOCUMENT_TYPE_LABEL[type]} template`);
  }, [picked, type, nameTouched]);

  const submit = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate(
      {
        documentType: type,
        name: name.trim(),
        description: description.trim() || undefined,
        source,
        ...(platform && { platform: true }),
      },
      {
        onSuccess: (t) => {
          onOpenChange(false);
          navigate.push(`/business/templates/${t.id}`);
        },
      },
    );
  };

  const card = (key: string, title: string, body: string | null, badge?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setSource(key)}
      aria-pressed={source === key}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors",
        source === key ? "border-foreground/50 bg-accent" : "border-border hover:bg-accent/50",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium">{title}</span>
        {badge && <Badge tone={badge === "Platform" ? "info" : "neutral"}>{badge}</Badge>}
      </span>
      {body && <span className="line-clamp-2 text-[12px] text-muted-foreground">{body}</span>}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{platform ? "New platform starter" : "New template"}</DialogTitle>
          <DialogDescription>
            Start from a ready-made layout and adjust it, or begin with a blank page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Document</span>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-0.5">
              {TEMPLATED_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    type === t
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {DOCUMENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">Start from</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {isLoading ? (
                // One placeholder, like the one built-in starter per type, so the grid
                // doesn't change rows when the real cards arrive.
                <Skeleton className="h-[68px] w-full" />
              ) : (
                starters?.map((s) =>
                  card(
                    s.source,
                    s.name,
                    s.description,
                    s.origin === "platform" ? "Platform" : "Built-in",
                  ),
                )
              )}
              {card(
                BLANK,
                "Blank",
                "An empty page with the document title - write the HTML yourself.",
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="template-name"
              className="text-[12px] font-medium text-muted-foreground"
            >
              Name
            </label>
            <input
              id="template-name"
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="template-description"
              className="text-[12px] font-medium text-muted-foreground"
            >
              Description <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="template-description"
              value={description}
              maxLength={2000}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
            Create and edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
