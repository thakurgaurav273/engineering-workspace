"use client";
import { type ReactNode, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
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
import { CreatableSelect } from "@/shared/components/creatable-select";
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
  CATEGORY_LABEL,
  ISSUE_PRIORITIES,
  PRIORITY_LABEL,
  STATE_CATEGORIES,
  cycleLabel,
  labelsApi,
  projectsApi,
  sortStates,
  statesApi,
  type Cycle,
  type IssueLabel,
  type IssuePriority,
  type IssueState,
  type IssueStateCategory,
  type Person,
  type Project,
} from "@/applications/engineering/lib/issues";

// ---------------------------------------------------------------- icons

/**
 * Linear-style status glyph, drawn from the state's category in the team's own colour:
 * dashed ring (backlog), empty ring (unstarted), pie (started), check (completed), cross.
 */
export function StatusIcon({
  state,
  className,
}: {
  state: Pick<IssueState, "category" | "color"> & { position?: number };
  className?: string;
}) {
  const base = cn("h-3.5 w-3.5 shrink-0", className);
  const style = { color: state.color };
  if (state.category === "BACKLOG") {
    return <CircleDashed className={base} style={style} strokeWidth={2.2} />;
  }
  if (state.category === "COMPLETED" || state.category === "CANCELED") {
    return (
      <svg viewBox="0 0 14 14" className={base} style={style} aria-hidden>
        <circle cx="7" cy="7" r="6" fill="currentColor" />
        {state.category === "COMPLETED" ? (
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
  // Unstarted = empty ring; started states fill further the later they sit in the workflow.
  const fraction = state.category === "UNSTARTED" ? 0 : (state.position ?? 0) >= 1 ? 0.75 : 0.5;
  const r = 3.5;
  const angle = fraction * 2 * Math.PI;
  const x = 7 + r * Math.sin(angle);
  const y = 7 - r * Math.cos(angle);
  return (
    <svg viewBox="0 0 14 14" className={base} style={style} aria-hidden>
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
}: {
  trigger: ReactNode;
  options: Option<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  placeholder: string;
  multi?: boolean;
  align?: "start" | "end";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return <>{trigger}</>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-60 p-0" onClick={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder={placeholder} className="text-[12.5px]" />
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

// Palette offered when creating statuses and labels.
const SWATCHES = [
  "#94a3b8",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

export function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Colour ${color}`}
          aria-pressed={value === color}
          className={cn(
            "h-5 w-5 rounded-full ring-offset-2 ring-offset-popover transition",
            value === color && "ring-2 ring-foreground/60",
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

const CATEGORY_DEFAULT_COLOR: Record<IssueStateCategory, string> = {
  BACKLOG: "#94a3b8",
  UNSTARTED: "#94a3b8",
  STARTED: "#f59e0b",
  COMPLETED: "#6366f1",
  CANCELED: "#64748b",
};

/** The extra step behind "Create status": a status needs a category (and a colour). */
export function StateCreateForm({
  teamId,
  name: initialName,
  defaultCategory = "STARTED",
  onCreated,
  onCancel,
}: {
  teamId: string;
  name: string;
  defaultCategory?: IssueStateCategory;
  onCreated: (state: IssueState) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<IssueStateCategory>(defaultCategory);
  const [color, setColor] = useState(CATEGORY_DEFAULT_COLOR[defaultCategory]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      onCreated(await statesApi.create({ teamId, name: name.trim(), category, color }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="space-y-1">
        <label className="text-[11.5px] text-muted-foreground" htmlFor="new-status-name">
          Status name
        </label>
        <input
          id="new-status-name"
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        <span className="text-[11.5px] text-muted-foreground">Category</span>
        <div className="grid grid-cols-1 gap-1">
          {STATE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setColor(CATEGORY_DEFAULT_COLOR[c]);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                category === c
                  ? "border-foreground/40 bg-accent"
                  : "border-border hover:bg-accent/60",
              )}
            >
              <StatusIcon state={{ category: c, color: CATEGORY_DEFAULT_COLOR[c] }} />
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[11.5px] text-muted-foreground">Colour</span>
        <ColorSwatches value={color} onChange={setColor} />
      </div>
      {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2.5 py-1 text-muted-foreground hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 font-medium text-background disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />} Create status
        </button>
      </div>
    </div>
  );
}

/** A team's workflow statuses, grouped by category; unknown names can be created. */
export function StatusPicker({
  teamId,
  value,
  onChange,
  trigger,
  disabled,
}: {
  teamId: string;
  value: IssueState | null;
  onChange: (state: IssueState) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <CreatableSelect<IssueState>
      queryKey={["issues", "states", teamId]}
      fetcher={async () => sortStates(await statesApi.list(teamId))}
      getId={(s) => s.id}
      getLabel={(s) => s.name}
      renderIcon={(s) => <StatusIcon state={s} />}
      groupBy={(s) => CATEGORY_LABEL[s.category]}
      selected={value ? [value.id] : []}
      onSelect={(s) => s && onChange(s)}
      placeholder="Change status…"
      disabled={disabled || !teamId}
      create={{
        noun: "status",
        form: ({ name, done, cancel }) => (
          <StateCreateForm
            teamId={teamId}
            name={name}
            defaultCategory={value?.category ?? "STARTED"}
            onCreated={done}
            onCancel={cancel}
          />
        ),
      }}
      trigger={
        trigger ?? (
          <PropertyButton>
            {value ? <StatusIcon state={value} /> : null} {value?.name ?? "Status"}
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

const randomSwatch = () => SWATCHES[1 + Math.floor(Math.random() * (SWATCHES.length - 1))];

/** Workspace labels plus the team's own; a missing one is created (workspace-wide) by name. */
export function LabelsPicker({
  teamId,
  value,
  onChange,
  trigger,
  disabled,
}: {
  teamId?: string;
  value: string[];
  onChange: (labelIds: string[]) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <CreatableSelect<IssueLabel>
      multi
      queryKey={["issues", "labels", teamId ?? "all"]}
      fetcher={() => labelsApi.list(teamId)}
      getId={(l) => l.id}
      getLabel={(l) => l.name}
      renderIcon={(l) => (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
      )}
      selected={value}
      onSelect={(l) => {
        if (!l) return;
        onChange(value.includes(l.id) ? value.filter((v) => v !== l.id) : [...value, l.id]);
      }}
      placeholder="Search or create labels…"
      disabled={disabled}
      create={{
        noun: "label",
        action: (name) => labelsApi.create({ name, color: randomSwatch() }),
      }}
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

/** Active projects; typing a new name creates a project (details can be filled in later). */
export function ProjectPicker({
  value,
  onChange,
  trigger,
  disabled,
}: {
  value: { id: string; name: string } | null;
  onChange: (projectId: string | null) => void;
  trigger?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <CreatableSelect<Project>
      queryKey={["issues", "projects", {}]}
      fetcher={() => projectsApi.list()}
      getId={(p) => p.id}
      getLabel={(p) => p.name}
      renderIcon={() => <Hexagon className="h-3.5 w-3.5" />}
      selected={value ? [value.id] : []}
      onSelect={(p) => onChange(p?.id ?? null)}
      noneOption={{
        label: "No project",
        icon: <Hexagon className="h-3.5 w-3.5 text-muted-foreground" />,
      }}
      placeholder="Search or create projects…"
      disabled={disabled}
      create={{ noun: "project", action: (name) => projectsApi.create({ name }) }}
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

/** Label filter for issue lists: searchable, and creates the label when it doesn't exist yet. */
export function LabelFilter({
  teamId,
  value,
  onChange,
}: {
  teamId?: string;
  value: string | null;
  onChange: (labelId: string | null) => void;
}) {
  const [current, setCurrent] = useState<IssueLabel | null>(null);
  return (
    <CreatableSelect<IssueLabel>
      queryKey={["issues", "labels", teamId ?? "all"]}
      fetcher={() => labelsApi.list(teamId)}
      getId={(l) => l.id}
      getLabel={(l) => l.name}
      renderIcon={(l) => (
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
      )}
      selected={value ? [value] : []}
      onSelect={(l) => {
        setCurrent(l);
        onChange(l?.id ?? null);
      }}
      noneOption={{
        label: "Any label",
        icon: <Tag className="h-3.5 w-3.5 text-muted-foreground" />,
      }}
      placeholder="Search or create labels…"
      create={{
        noun: "label",
        action: (name) => labelsApi.create({ name, color: randomSwatch() }),
      }}
      trigger={
        <button
          type="button"
          className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-[130px]"
        >
          <span className="flex min-w-0 items-center gap-2">
            {value && current && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: current.color }}
              />
            )}
            <span className="truncate">{value && current ? current.name : "Any label"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      }
    />
  );
}
