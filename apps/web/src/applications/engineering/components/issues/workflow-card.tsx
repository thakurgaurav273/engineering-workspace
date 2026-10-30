"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from "lucide-react";
import { Button, Card, CardHeader, Skeleton } from "@grovyn/ui/primitives";
import { useStateMutations, useStates } from "@/applications/engineering/hooks/use-issues";
import {
  CATEGORY_LABEL,
  STATE_CATEGORIES,
  sortStates,
  type IssueState,
  type IssueStateCategory,
} from "@/applications/engineering/lib/issues";
import { ColorSwatches, StateCreateForm, StatusIcon } from "./issue-ui";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40";

function StateRow({
  state,
  siblings,
  allStates,
  canManage,
}: {
  state: IssueState;
  /** States of the same category, in order (for up/down). */
  siblings: IssueState[];
  allStates: IssueState[];
  canManage: boolean;
}) {
  const { update, remove } = useStateMutations();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [name, setName] = useState(state.name);
  const [color, setColor] = useState(state.color);
  const [category, setCategory] = useState<IssueStateCategory>(state.category);
  const [replacementId, setReplacementId] = useState("");

  const index = siblings.findIndex((s) => s.id === state.id);
  // Swapping positions with the neighbour keeps every other state where it is.
  const move = (offset: -1 | 1) => {
    const other = siblings[index + offset];
    if (!other) return;
    update.mutate({ id: state.id, position: other.position });
    update.mutate({ id: other.id, position: state.position });
  };
  const inUse = state.issueCount ?? 0;
  const replacements = allStates.filter((s) => s.id !== state.id);

  if (mode === "edit") {
    return (
      <li className="space-y-2 px-3 py-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          className={inputClass}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as IssueStateCategory)}
          className={inputClass}
          aria-label="Category"
        >
          {STATE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ColorSwatches value={color} onChange={setColor} />
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || update.isPending}
              onClick={() =>
                update.mutate(
                  { id: state.id, name: name.trim(), color, category },
                  { onSuccess: () => setMode("view") },
                )
              }
            >
              <Check className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  if (mode === "delete") {
    return (
      <li className="space-y-2 px-3 py-2.5 text-[12.5px]">
        <p>
          Delete <b>{state.name}</b>?
          {inUse > 0 && ` Its ${inUse} issue${inUse === 1 ? "" : "s"} move to:`}
        </p>
        {inUse > 0 && (
          <select
            value={replacementId}
            onChange={(e) => setReplacementId(e.target.value)}
            className={inputClass}
            aria-label="Move issues to"
          >
            <option value="">Choose a status…</option>
            {replacements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({CATEGORY_LABEL[s.category]})
              </option>
            ))}
          </select>
        )}
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-600/90"
            disabled={(inUse > 0 && !replacementId) || remove.isPending}
            onClick={() =>
              remove.mutate(
                { id: state.id, replacementStateId: replacementId || undefined },
                { onSuccess: () => setMode("view") },
              )
            }
          >
            Delete
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <StatusIcon state={state} />
      {canManage ? (
        <button
          type="button"
          onClick={() => {
            setName(state.name);
            setColor(state.color);
            setCategory(state.category);
            setMode("edit");
          }}
          className="min-w-0 flex-1 truncate text-left text-[13px] hover:underline"
          title="Edit status"
        >
          {state.name}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[13px]">{state.name}</span>
      )}
      <span className="font-mono-num text-[11px] text-muted-foreground">{inUse}</span>
      {canManage && (
        <span className="flex items-center">
          <button
            type="button"
            aria-label="Move up"
            disabled={index <= 0 || update.isPending}
            onClick={() => move(-1)}
            className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index >= siblings.length - 1 || update.isPending}
            onClick={() => move(1)}
            className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${state.name}`}
            onClick={() => setMode("delete")}
            className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

/** A team's workflow: its statuses grouped by category. Leads/admins edit; anyone can add. */
export function WorkflowCard({
  team,
  canManage,
}: {
  team: { id: string; key: string };
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: states = [], isLoading } = useStates(team.id);
  const [adding, setAdding] = useState(false);
  const ordered = sortStates(states);

  return (
    <Card>
      <CardHeader
        title="Workflow"
        subtitle={`${team.key}'s statuses. Each sits in a category, which drives progress and what counts as done.`}
      />
      <div className="space-y-3 p-5">
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-md" />
        ) : (
          STATE_CATEGORIES.map((category) => {
            const siblings = ordered.filter((s) => s.category === category);
            if (!siblings.length) return null;
            return (
              <div key={category} className="space-y-1">
                <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[category]}
                </div>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {siblings.map((s) => (
                    <StateRow
                      key={s.id}
                      state={s}
                      siblings={siblings}
                      allStates={ordered}
                      canManage={canManage}
                    />
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {adding ? (
          <div className="rounded-md border border-dashed border-border p-3">
            <StateCreateForm
              teamId={team.id}
              name=""
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ["issues", "states"] });
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add status
          </Button>
        )}
      </div>
    </Card>
  );
}
