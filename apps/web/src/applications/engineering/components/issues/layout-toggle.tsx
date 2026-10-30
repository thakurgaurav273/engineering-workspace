"use client";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@grovyn/utils";

export type IssueLayout = "list" | "board";

/** List/Board segmented control, styled like My Workspace's view switcher. */
export function LayoutToggle({
  value,
  onChange,
}: {
  value: IssueLayout;
  onChange: (layout: IssueLayout) => void;
}) {
  const option = (layout: IssueLayout, label: string, Icon: typeof List) => (
    <button
      onClick={() => onChange(layout)}
      aria-pressed={value === layout}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        value === layout
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
  return (
    <div className="flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-0.5">
      {option("list", "List", List)}
      {option("board", "Board", LayoutGrid)}
    </div>
  );
}
