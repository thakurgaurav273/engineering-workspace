import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, Button } from "@grovyn/ui/primitives";
import { IconButton } from "@/applications/business/components/icon-button";
import { RichText } from "@/applications/business/components/rich-text";
import { useClients } from "@/applications/business/lib/business-clients";
import { useUnsavedChangesWarning } from "@/shared/lib/use-unsaved-changes";
import {
  useProposalMutations,
  type Proposal,
  type ProposalSection,
} from "@/applications/business/lib/business-proposals";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-ring";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

// Sections a brand-new proposal starts with — pre-added and editable; users add/remove/reorder freely.
const DEFAULT_PROPOSAL_SECTIONS = [
  "Problem Statement",
  "Proposed Solution",
  "High-Level Scope",
  "Deliverables",
  "Timeline Estimate",
  "What's Not Included",
  "Next Steps",
];

interface LocalSection {
  key: number;
  title: string;
  content: string;
}

export function ProposalEditor({ proposal }: { proposal?: Proposal }) {
  const navigate = useRouter();
  const { create, update } = useProposalMutations();
  const { data: clientsPage } = useClients({ limit: 100 });

  const keyCounter = useRef(0);
  const seed = (sections: ProposalSection[] | undefined): LocalSection[] =>
    (sections ?? []).map((s) => ({
      key: keyCounter.current++,
      title: s.title,
      content: s.content ?? "",
    }));

  const [clientId, setClientId] = useState(proposal?.clientId ?? "");
  const [clientName, setClientName] = useState(proposal?.clientName ?? "");
  const [title, setTitle] = useState(proposal?.title ?? "");
  const [reference, setReference] = useState(proposal?.reference ?? "");
  const [summary, setSummary] = useState(proposal?.summary ?? "");
  const [validUntil, setValidUntil] = useState(proposal?.validUntil?.slice(0, 10) ?? "");
  const [sections, setSections] = useState<LocalSection[]>(() =>
    proposal?.sections?.length
      ? seed(proposal.sections)
      : DEFAULT_PROPOSAL_SECTIONS.map((title) => ({
          key: keyCounter.current++,
          title,
          content: "",
        })),
  );
  const [dragKey, setDragKey] = useState<number | null>(null);

  // Warn before leaving with unsaved edits. The pristine snapshot is captured on the
  // first render, so an untouched form is never considered dirty.
  const initialRef = useRef<string | null>(null);
  const snapshot = JSON.stringify({
    clientId,
    clientName,
    title,
    reference,
    summary,
    validUntil,
    sections: sections.map((s) => ({ title: s.title, content: s.content })),
  });
  if (initialRef.current === null) initialRef.current = snapshot;
  useUnsavedChangesWarning(snapshot !== initialRef.current);

  const addSection = () =>
    setSections((prev) => [...prev, { key: keyCounter.current++, title: "", content: "" }]);
  const removeSection = (key: number) => setSections((prev) => prev.filter((s) => s.key !== key));
  const patchSection = (key: number, patch: Partial<LocalSection>) =>
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const moveSection = (fromKey: number, toKey: number) => {
    if (fromKey === toKey) return;
    setSections((prev) => {
      const from = prev.findIndex((s) => s.key === fromKey);
      const to = prev.findIndex((s) => s.key === toKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const pending = create.isPending || update.isPending;
  const canSave = title.trim() && !pending;

  const save = () => {
    const body = {
      clientId: clientId || undefined,
      clientName: clientName.trim() || undefined,
      title: title.trim(),
      reference: reference.trim() || undefined,
      summary: summary.trim() || undefined,
      validUntil: validUntil || undefined,
      sections: sections
        .filter((s) => s.title.trim() || s.content.trim())
        .map((s, i) => ({
          title: s.title.trim() || `Section ${i + 1}`,
          content: s.content,
          order: i,
        })),
    };
    const onSaved = (p: Proposal) => {
      toast.success("Proposal saved");
      navigate.push(`/business/proposals/${p.id}`);
    };
    const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't save");
    if (proposal) update.mutate({ id: proposal.id, body }, { onSuccess: onSaved, onError });
    else create.mutate(body, { onSuccess: onSaved, onError });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Proposal
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Title</label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Website redesign proposal"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Reference</label>
                <input
                  className={inputCls}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelCls}>Valid until</label>
                <input
                  type="date"
                  className={inputCls}
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Summary</label>
              <textarea
                className={`${inputCls} min-h-[64px] resize-y`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A short overview shown at the top of the proposal."
              />
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {sections.map((s, i) => (
            <Card
              key={s.key}
              className={`p-3 ${dragKey === s.key ? "opacity-60" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragKey !== null) moveSection(dragKey, s.key);
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  draggable
                  onDragStart={() => setDragKey(s.key)}
                  onDragEnd={() => setDragKey(null)}
                  title="Drag to reorder"
                  className="cursor-grab text-muted-foreground active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <input
                  className={inputCls}
                  value={s.title}
                  onChange={(e) => patchSection(s.key, { title: e.target.value })}
                  placeholder={`Section ${i + 1} title`}
                />
                <IconButton
                  title="Delete section"
                  onClick={() => removeSection(s.key)}
                  disabled={sections.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              <RichText
                initialHtml={s.content}
                onChange={(html) => patchSection(s.key, { content: html })}
              />
            </Card>
          ))}
          <Button variant="outline" onClick={addSection}>
            <Plus className="h-4 w-4" /> Add section
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Client
          </div>
          <select
            className={inputCls}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select a client…</option>
            {clientsPage?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={`${inputCls} mt-2`}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="or client name (free text)"
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            Company and client details are snapshotted onto the proposal when you save.
          </p>
        </Card>
        <Button className="w-full" disabled={!canSave} onClick={save}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {proposal ? "Save changes" : "Create proposal"}
        </Button>
      </div>
    </div>
  );
}
