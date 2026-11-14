import { useEffect, useMemo, useState } from "react";
import { cn } from "@grovyn/utils";
import { Button } from "@grovyn/ui/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@grovyn/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@grovyn/ui/components/select";
import type { VarSpec } from "@/applications/business/lib/business-document-templates";
import {
  BLOCKS,
  blockSnippet,
  sourceOptions,
  type BlockKind,
} from "@/applications/business/lib/template-blocks";

/**
 * Block palette for the template editor: pick a block (and, for data blocks, what it's built
 * from), see the generated HTML + Liquid, insert it at the cursor. Gives non-developers a way
 * to assemble a layout without writing markup, while the template stays plain code.
 */
export function InsertBlockDialog({
  open,
  onOpenChange,
  variables,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variables: VarSpec[];
  onInsert: (snippet: string) => void;
}) {
  const [kind, setKind] = useState<BlockKind>("table");
  const [sourcePath, setSourcePath] = useState("");
  const block = BLOCKS.find((b) => b.kind === kind)!;
  const sources = useMemo(
    () => (block.source ? sourceOptions(variables, block.source) : []),
    [variables, block.source],
  );

  // Keep a valid source picked when the block changes; prefer the main list for tables.
  useEffect(() => {
    if (!block.source) return;
    setSourcePath((current) =>
      sources.some((s) => s.path === current)
        ? current
        : (sources.find((s) => s.path === "lines")?.path ?? sources[0]?.path ?? ""),
    );
  }, [block.source, sources]);

  useEffect(() => {
    if (open) setKind("table");
  }, [open]);

  const source = sources.find((s) => s.path === sourcePath);
  const snippet = block.source && !source ? "" : blockSnippet(kind, source);

  const insert = () => {
    if (!snippet) return;
    onInsert(`\n${snippet}\n`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert block</DialogTitle>
          <DialogDescription>
            Adds ready-made HTML at the cursor. Data blocks are built from this document&apos;s
            variables, already formatted.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BLOCKS.map((b) => (
            <button
              key={b.kind}
              type="button"
              onClick={() => setKind(b.kind)}
              aria-pressed={kind === b.kind}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left transition-colors",
                kind === b.kind
                  ? "border-foreground/50 bg-accent"
                  : "border-border hover:bg-accent/50",
              )}
            >
              <span className="text-[13px] font-medium">{b.label}</span>
              <span className="text-[11.5px] text-muted-foreground">{b.hint}</span>
            </button>
          ))}
        </div>

        {block.source && (
          <div className="space-y-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              {block.source === "object"
                ? "Fields of"
                : block.source === "list"
                  ? "One per item of"
                  : "Only when this has a value"}
            </span>
            {sources.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                This document type has nothing to build this block from.
              </p>
            ) : (
              <Select value={sourcePath} onValueChange={setSourcePath}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.path} value={s.path}>
                      {s.label} <span className="font-mono text-muted-foreground">({s.path})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {snippet && (
          <pre className="max-h-56 overflow-auto rounded-md border border-border bg-surface p-2.5 font-mono text-[11.5px] leading-relaxed">
            {snippet}
          </pre>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={insert} disabled={!snippet}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
