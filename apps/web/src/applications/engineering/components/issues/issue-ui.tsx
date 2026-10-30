"use client";
import { type ReactNode, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  CircleDashed,
  Hexagon,
  Tag,
  UserCircle2,
  X,
  RefreshCcw,
  CalendarDays,
} from "lucide-react";
import { cn, avatarColor, userInitials, fullName } from "@grovyn/utils";
import { Avatar } from "@grovyn/ui/primitives";
import { useLabelMutations } from "@/applications/engineering/hooks/use-issues";
import { Popover, PopoverContent, PopoverTrigger } from "@grovyn/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@grovyn/ui/components/command";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  cycleLabel,
  type Cycle,
  type IssueLabel,
  type IssuePriority,
  type IssueStatus,
  type Person,
} from "@/applications/engineering/lib/issues";

// ---------------------------------------------------------------- icons

const STATUS_COLOR: Record<IssueStatus, string> = {
  BACKLOG: "text-muted-foreground",
  TODO: "text-muted-foreground",
  IN_PROGRESS: "text-amber-500",
  IN_REVIEW: "text-emerald-500",
  DONE: "text-indigo-500",
  CANCELED: "text-muted-foreground",
};

/** Linear-style status glyph: dashed ring, empty ring, partial pie, filled check, cross. */
export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const color = STATUS_COLOR[status];
  const base = cn("h-3.5 w-3.5 shrink-0", color, className);
  if (status === "BACKLOG") return <CircleDashed className={base} strokeWidth={2.2} />;
  if (status === "DONE" || status === "CANCELED") {
    return (
      <svg viewBox="0 0 14 14" className={base} aria-hidden>
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        {status === "DONE" ? (
          <path
            d="M4.2 7.2 6.1 9l3.7-3.9"
            fill="none"
            stroke="var(--background, #fff)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M4.8 4.8l4.4 4.4M9.2 4.8 4.8 9.2"
            stroke="var(--background, #fff)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  }
  // TODO = empty ring, IN_PROGRESS = half pie, IN_REVIEW = three-quarter pie.
  const fraction = status === "TODO" ? 0 : status === "IN_PROGRESS" ? 0.5 : 0.75;
  const r = 3.5;
  const angle = fraction * 2 * Math.PI;
  const x = 7 + r * Math.sin(angle);
  const y = 7 - r * Math.cos(angle);
  return (
    <svg viewBox="0 0 14 14" className={base} aria-hidden>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {fraction > 0 && (
        <path
          d={`M7 7 L7 ${7 - r} A${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y} Z`}
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  const base = cn("h-3.5 w-3.5 shrink-0", className);
  if (priority === "NONE") {
    return (
      <svg viewBox="0 0 14 14" className={cn(base, "text-muted-foreground")} aria-hidden>
        {[2.5, 6, 9.5].map((x) => (
          <rect key={x} x={x} y="6.4" width="2.2" height="1.2" rx="0.6" fill="currentColor" />
        ))}
      </svg>
    );
  }
  if (priority === "URGENT") {
    return (
      <svg viewBox="0 0 14 14" className={cn(base, "text-orange-500")} aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
        <rect x="6.25" y="3.5" width="1.5" height="4.5" rx="0.75" fill="var(--background, #fff)" />
        <circle cx="7" cy="10" r="0.9" fill="var(--background, #fff)" />
      </svg>
    );
  }
  const filled = priority === "HIGH" ? 3 : priority === "MEDIUM" ? 2 : 1;
  return (
    <svg viewBox="0 0 14 14" className={cn(base, "text-foreground")} aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 3.6}
          y={9 - i * 3}
          width="2.4"
          height={3 + i * 3}
          rx="0.6"
          fill="currentColor"
          opacity={i < filled ? 1 : 0.25}
        />
      ))}
    </svg>
  );
}

export function PersonAvatar({
  person,
  size = "xs",
}: {
  person: Person | null;
  size?: "xs" | "sm";
}) {
  if (!person) {
    return (
      <UserCircle2
        className={cn("shrink-0 text-muted-foreground", size === "xs" ? "h-5 w-5" : "h-7 w-7")}
      />
    );
  }
  return (
    <Avatar
      initials={userInitials(person.firstName, person.lastName)}
      color={avatarColor(person.id)}
      src={person.avatarUrl}
      size={size}
    />
  );
}

export function LabelChip({
  label,
  onRemove,
}: {
  label: Pick<IssueLabel, "name" | "color">;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
      {label.name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:text-foreground"
          aria-label={`Remove ${label.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- pickers

type Option<T extends string> = { value: T; label: string; icon?: ReactNode; keywords?: string[] };

/**
 * Searchable popover menu (Linear's property menus). `trigger` is the clickable element;
 * multi-select keeps the menu open and toggles values.
 */
function PickerMenu<T extends string>({
  trigger,
  options,
  selected,
  onSelect,
  placeholder,
  multi,
  align = "start",
  disabled,
  onCreate,
  createNoun,
}: {
  trigger: ReactNode;
  options: Option<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  placeholder: string;
  multi?: boolean;
  align?: "start" | "end";
  disabled?: boolean;
  /** When set, a search with no exact match offers `Create <noun> "<query>"`. */
  onCreate?: (name: string) => Promise<unknown> | void;
  createNoun?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  if (disabled) return <>{trigger}</>;

  const name = query.trim();
  const exists = options.some((o) => o.label.toLowerCase() === name.toLowerCase());
  const create = async () => {
    if (!onCreate || creating) return;
    setCreating(true);
    try {
      await onCreate(name);
      setQuery("");
      if (!multi) setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-0" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            className="text-[12.5px]"
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
              No results
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords?.join(" ") ?? ""}`}
                  onSelect={() => {
                    onSelect(option.value);
                    if (!multi) setOpen(false);
                  }}
                  className="gap-2 text-[12.5px]"
                >
                  {option.icon}
                  <span className="flex-1 truncate">{option.label}</span>
                  {selected.includes(option.value) && (
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </CommandItem>
              ))}
              {onCreate && name && !exists && (
                <CommandItem
                  // Contains the query, so cmdk's filter always keeps it visible.
                  value={`__create__ ${name}`}
                  onSelect={create}
                  disabled={creating}
                  className="gap-2 text-[12.5px]"
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate">
                    Create {createNoun ?? "new"} &ldquo;{name}&rdquo;
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Pill-shaped trigger used in the create dialog and the detail sidebar. */
export const PropertyButton = ({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...props}
    className={cn(
      "inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[12px] text-foreground transition-colors hover:bg-accent disabled:cursor-default disabled:hover:bg-surface",
      className,
    )}
  >
    {children}
  </button>
);

export function StatusPicker({
  value,
  onChange,
  trigger,
  disabled,
}: {
  value: IssueStatus;
  onChange: (status: IssueStatus) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <PickerMenu
      placeholder="Change status…"
      disabled={disabled}
      selected={[value]}
      onSelect={onChange}
      options={ISSUE_STATUSES.map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
        icon: <StatusIcon status={s} />,
      }))}
      trigger={
        trigger ?? (
          <PropertyButton>
            <StatusIcon status={value} /> {STATUS_LABEL[value]}
          </PropertyButton>
        )
      }
    />
  );
}

export function PriorityPicker({
  value,
  onChange,
  trigger,
  disabled,
}: {
  value: IssuePriority;
  onChange: (priority: IssuePriority) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <PickerMenu
      placeholder="Set priority…"
      disabled={disabled}
      selected={[value]}
      onSelect={onChange}
      options={ISSUE_PRIORITIES.map((p) => ({
        value: p,
        label: PRIORITY_LABEL[p],
        icon: <PriorityIcon priority={p} />,
      }))}
      trigger={
        trigger ?? (
          <PropertyButton>
            <PriorityIcon priority={value} />{" "}
            {value === "NONE" ? "Priority" : PRIORITY_LABEL[value]}
          </PropertyButton>
        )
      }
    />
  );
}

const NONE = "__none__";

export function AssigneePicker({
  value,
  people,
  onChange,
  trigger,
  disabled,
}: {
  value: Person | null;
  people: Person[];
  onChange: (userId: string | null) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <PickerMenu
      placeholder="Assign to…"
      disabled={disabled}
      selected={[value?.id ?? NONE]}
      onSelect={(v) => onChange(v === NONE ? null : v)}
      options={[
        { value: NONE, label: "No assignee", icon: <PersonAvatar person={null} /> },
        ...people.map((p) => ({
          value: p.id,
          label: fullName(p.firstName, p.lastName),
          icon: <PersonAvatar person={p} />,
        })),
      ]}
      trigger={
        trigger ?? (
          <PropertyButton>
            <PersonAvatar person={value} />
            <span className="truncate">
              {value ? fullName(value.firstName, value.lastName) : "Assignee"}
            </span>
          </PropertyButton>
        )
      }
    />
  );
}

export function LabelsPicker({
  value,
  labels,
  onChange,
  trigger,
  disabled,
}: {
  value: string[];
  labels: IssueLabel[];
  onChange: (labelIds: string[]) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  const createLabel = useCreateLabel();
  return (
    <PickerMenu
      multi
      placeholder="Search or create labels…"
      disabled={disabled}
      createNoun="label"
      onCreate={async (name) => {
        const label = await createLabel(name);
        if (label) onChange([...value, label.id]);
      }}
      selected={value}
      onSelect={(id) =>
        onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
      }
      options={labels.map((l) => ({
        value: l.id,
        label: l.name,
        icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />,
      }))}
      trigger={
        trigger ?? (
          <PropertyButton>
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {value.length ? `${value.length} label${value.length > 1 ? "s" : ""}` : "Labels"}
          </PropertyButton>
        )
      }
    />
  );
}

export function ProjectPicker({
  value,
  projects,
  onChange,
  trigger,
  disabled,
}: {
  value: { id: string; name: string } | null;
  projects: { id: string; name: string }[];
  onChange: (projectId: string | null) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <PickerMenu
      placeholder="Add to project…"
      disabled={disabled}
      selected={[value?.id ?? NONE]}
      onSelect={(v) => onChange(v === NONE ? null : v)}
      options={[
        {
          value: NONE,
          label: "No project",
          icon: <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />,
        },
        ...projects.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <Hexagon className="h-3.5 w-3.5" />,
        })),
      ]}
      trigger={
        trigger ?? (
          <PropertyButton>
            <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{value?.name ?? "Project"}</span>
          </PropertyButton>
        )
      }
    />
  );
}

export function CyclePicker({
  value,
  cycles,
  onChange,
  trigger,
  disabled,
}: {
  value: { id: string; number: number; name: string | null } | null;
  cycles: Cycle[];
  onChange: (cycleId: string | null) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  const open = cycles.filter((c) => c.state === "current" || c.state === "upcoming");
  return (
    <PickerMenu
      placeholder="Add to cycle…"
      disabled={disabled}
      selected={[value?.id ?? NONE]}
      onSelect={(v) => onChange(v === NONE ? null : v)}
      options={[
        {
          value: NONE,
          label: "No cycle",
          icon: <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />,
        },
        ...open
          .slice()
          .reverse()
          .map((c) => ({
            value: c.id,
            label: `${cycleLabel(c)}${c.state === "current" ? " (current)" : ""}`,
            icon: <RefreshCcw className="h-3.5 w-3.5" />,
          })),
      ]}
      trigger={
        trigger ?? (
          <PropertyButton>
            <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{value ? cycleLabel(value) : "Cycle"}</span>
          </PropertyButton>
        )
      }
    />
  );
}

export function DueDateInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[12px] text-foreground hover:bg-accent">
      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="date"
        disabled={disabled}
        value={value ? value.slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-transparent text-[12px] outline-none [color-scheme:light] dark:[color-scheme:dark]"
        aria-label="Due date"
      />
    </label>
  );
}

// New labels get the next colour from a fixed palette so a burst of them stays distinguishable.
const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/** Creates a workspace-wide label from a picker search; resolves to null on failure (toast shown). */
function useCreateLabel() {
  const { create } = useLabelMutations();
  return async (name: string): Promise<IssueLabel | null> => {
    const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)];
    try {
      return await create.mutateAsync({ name, color });
    } catch {
      return null;
    }
  };
}

const ANY = "__any__";

/** Label filter for issue lists: searchable, and creates the label when it doesn't exist yet. */
export function LabelFilter({
  value,
  labels,
  onChange,
}: {
  value: string | null;
  labels: IssueLabel[];
  onChange: (labelId: string | null) => void;
}) {
  const createLabel = useCreateLabel();
  const current = labels.find((l) => l.id === value);
  return (
    <PickerMenu
      placeholder="Search or create labels…"
      selected={[value ?? ANY]}
      onSelect={(v) => onChange(v === ANY ? null : v)}
      createNoun="label"
      onCreate={async (name) => {
        const label = await createLabel(name);
        if (label) onChange(label.id);
      }}
      options={[
        {
          value: ANY,
          label: "Any label",
          icon: <Tag className="h-3.5 w-3.5 text-muted-foreground" />,
        },
        ...labels.map((l) => ({
          value: l.id,
          label: l.name,
          icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />,
        })),
      ]}
      trigger={
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-[130px]"
        >
          <span className="flex min-w-0 items-center gap-2">
            {current && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: current.color }}
              />
            )}
            <span className="truncate">{current?.name ?? "Any label"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      }
    />
  );
}
