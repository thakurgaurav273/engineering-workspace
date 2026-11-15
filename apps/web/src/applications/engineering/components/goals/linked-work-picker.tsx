"use client";
import { type ReactNode, useState } from "react";
import { Hexagon, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@grovyn/ui/components/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@grovyn/ui/components/command";
import { Button } from "@grovyn/ui/primitives";
import { useIssues, useProjects } from "@/applications/engineering/hooks/use-issues";
import { StatusIcon } from "@/applications/engineering/components/issues/issue-ui";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

export interface LinkedProject {
  id: string;
  name: string;
}

export interface LinkedIssue {
  id: string;
  identifier: string;
  title: string;
}

export interface LinkedWork {
  projects: LinkedProject[];
  issues: LinkedIssue[];
}

function Chip({
  icon,
  children,
  onRemove,
}: {
  icon: ReactNode;
  children: ReactNode;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface py-1 pl-2 pr-1 text-[12px]">
      {icon}
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="grid h-4 w-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Pick the projects and issues a goal is delivered through. */
export function LinkedWorkPicker({
  value,
  onChange,
}: {
  value: LinkedWork;
  onChange: (next: LinkedWork) => void;
}) {
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim(), 250);

  const { data: allProjects = [] } = useProjects();
  const { data: found, isFetching } = useIssues(
    { search: search || undefined, limit: 20 },
    issuesOpen,
  );

  const projectIds = new Set(value.projects.map((p) => p.id));
  const issueIds = new Set(value.issues.map((i) => i.id));
  const projectChoices = allProjects.filter((p) => !p.archivedAt && !projectIds.has(p.id));
  const issueChoices = (found?.data ?? []).filter((i) => !issueIds.has(i.id));

  return (
    <div className="space-y-2">
      {(value.projects.length > 0 || value.issues.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {value.projects.map((p) => (
            <Chip
              key={p.id}
              icon={<Hexagon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              onRemove={() =>
                onChange({ ...value, projects: value.projects.filter((x) => x.id !== p.id) })
              }
            >
              {p.name}
            </Chip>
          ))}
          {value.issues.map((i) => (
            <Chip
              key={i.id}
              icon={
                <span className="shrink-0 font-mono-num text-[11px] text-muted-foreground">
                  {i.identifier}
                </span>
              }
              onRemove={() =>
                onChange({ ...value, issues: value.issues.filter((x) => x.id !== i.id) })
              }
            >
              {i.title}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Popover open={projectsOpen} onOpenChange={setProjectsOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="secondary" size="sm">
              <Plus className="h-3.5 w-3.5" /> Project
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search projects…" className="text-[12.5px]" />
              <CommandList>
                <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                  {allProjects.length ? "No matching projects" : "No projects yet"}
                </CommandEmpty>
                <CommandGroup>
                  {projectChoices.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.id}`}
                      onSelect={() => {
                        onChange({
                          ...value,
                          projects: [...value.projects, { id: p.id, name: p.name }],
                        });
                        setProjectsOpen(false);
                      }}
                      className="gap-2 text-[12.5px]"
                    >
                      <Hexagon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono-num text-[11px] text-muted-foreground">
                        {p.teams.map((t) => t.key).join(", ")}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover
          open={issuesOpen}
          onOpenChange={(open) => {
            setIssuesOpen(open);
            if (!open) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button type="button" variant="secondary" size="sm">
              <Plus className="h-3.5 w-3.5" /> Issue
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            {/* The API searches (title or ENG-42), so cmdk's own filter stays off. */}
            <Command shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search by title or ENG-42…"
                className="text-[12.5px]"
              />
              <CommandList>
                <CommandEmpty className="py-4 text-center text-[12px] text-muted-foreground">
                  {isFetching ? "Searching…" : "No matching issues"}
                </CommandEmpty>
                <CommandGroup>
                  {issueChoices.map((i) => (
                    <CommandItem
                      key={i.id}
                      value={i.id}
                      onSelect={() => {
                        onChange({
                          ...value,
                          issues: [
                            ...value.issues,
                            { id: i.id, identifier: i.identifier, title: i.title },
                          ],
                        });
                        setIssuesOpen(false);
                        setQuery("");
                      }}
                      className="gap-2 text-[12.5px]"
                    >
                      <StatusIcon state={i.state} />
                      <span className="shrink-0 font-mono-num text-[11px] text-muted-foreground">
                        {i.identifier}
                      </span>
                      <span className="flex-1 truncate">{i.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
