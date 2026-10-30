"use client";
import { type ReactNode, useState } from "react";
import { type QueryKey, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@grovyn/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@grovyn/ui/components/command";
import { isAuthenticated } from "@/platform/auth/auth";

/** Context handed to a custom create form (e.g. "pick a category" for a new status). */
export interface CreateFormContext<T> {
  /** What the user typed in the search box. */
  name: string;
  /** Call with the created item: refreshes the options and selects it. */
  done: (item: T) => void;
  cancel: () => void;
}

export interface CreatableSelectProps<T> {
  /** Options come from the API; items created here are added by refetching this key. */
  queryKey: QueryKey;
  fetcher: () => Promise<T[]>;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderIcon?: (item: T) => ReactNode;
  /** Optional section heading per option (e.g. a status's category). */
  groupBy?: (item: T) => string;

  /** Ids currently selected (one entry for single-select). */
  selected: string[];
  /** Called with the chosen item, or null when `noneOption` is picked. */
  onSelect: (item: T | null) => void;
  /** Keep the menu open after picking (multi-select). */
  multi?: boolean;
  noneOption?: { label: string; icon?: ReactNode };

  /**
   * Lets the user create a missing value. `action` creates straight from the typed name;
   * `form` renders an extra step inside the popover for values that need more than a name.
   */
  create?: {
    noun: string;
    action?: (name: string) => Promise<T>;
    form?: (ctx: CreateFormContext<T>) => ReactNode;
  };

  trigger: ReactNode;
  placeholder?: string;
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable, API-backed select that can create the value it doesn't find - for
 * org-defined values like labels, statuses or projects. Search filters the loaded options
 * client-side; "Create <noun> "…"" appears whenever the search has no exact match.
 */
export function CreatableSelect<T>({
  queryKey,
  fetcher,
  getId,
  getLabel,
  renderIcon,
  groupBy,
  selected,
  onSelect,
  multi,
  noneOption,
  create,
  trigger,
  placeholder = "Search…",
  align = "start",
  disabled,
  className = "w-64",
}: CreatableSelectProps<T>) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled: isAuthenticated() && !disabled,
    staleTime: 60 * 1000,
  });

  if (disabled) return <>{trigger}</>;

  const name = search.trim();
  const exactMatch = items.some((item) => getLabel(item).toLowerCase() === name.toLowerCase());
  const canCreate = !!create && !!name && !exactMatch && !isLoading;

  const close = () => {
    setOpen(false);
    setSearch("");
    setFormName(null);
  };

  const pick = (item: T | null) => {
    onSelect(item);
    if (multi) setSearch("");
    else close();
  };

  const created = async (item: T) => {
    await queryClient.invalidateQueries({ queryKey });
    setFormName(null);
    pick(item);
  };

  const startCreate = async () => {
    if (!create || creating) return;
    if (create.form) {
      setFormName(name);
      return;
    }
    if (!create.action) return;
    setCreating(true);
    try {
      await created(await create.action(name));
    } catch {
      // The action's own error handling (toast) reports the failure; keep the menu open.
    } finally {
      setCreating(false);
    }
  };

  // Preserve the API's order inside each group, and the groups' first-seen order.
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = groupBy?.(item) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        className={`${className} p-0`}
        onClick={(e) => e.stopPropagation()}
      >
        {formName !== null && create?.form ? (
          <div className="p-3">
            <button
              type="button"
              onClick={() => setFormName(null)}
              className="mb-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            {create.form({ name: formName, done: created, cancel: () => setFormName(null) })}
          </div>
        ) : (
          <Command>
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
              className="text-[12.5px]"
            />
            <CommandList>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                  No results
                </CommandEmpty>
              )}
              {noneOption && (
                <CommandGroup>
                  <CommandItem
                    value={`__none__ ${noneOption.label}`}
                    onSelect={() => pick(null)}
                    className="gap-2 text-[12.5px]"
                  >
                    {noneOption.icon}
                    <span className="flex-1 truncate">{noneOption.label}</span>
                    {selected.length === 0 && (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </CommandItem>
                </CommandGroup>
              )}
              {[...groups.entries()].map(([heading, groupItems]) => (
                <CommandGroup key={heading || "_"} heading={heading || undefined}>
                  {groupItems.map((item) => (
                    <CommandItem
                      key={getId(item)}
                      value={`${getLabel(item)} ${getId(item)}`}
                      onSelect={() => pick(item)}
                      className="gap-2 text-[12.5px]"
                    >
                      {renderIcon?.(item)}
                      <span className="flex-1 truncate">{getLabel(item)}</span>
                      {selected.includes(getId(item)) && (
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {canCreate && (
                <CommandGroup>
                  <CommandItem
                    // Contains the search text, so cmdk's filter always keeps it visible.
                    value={`__create__ ${name}`}
                    onSelect={startCreate}
                    disabled={creating}
                    className="gap-2 text-[12.5px]"
                  >
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">
                      Create {create.noun} &ldquo;{name}&rdquo;
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
