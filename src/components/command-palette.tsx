import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Target, ClipboardCheck, Users } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface SearchResults {
  people: { id: string; name: string; jobTitle?: string | null; department?: string | null }[];
  goals: { id: string; title: string; status: string; progress: number }[];
  checkIns: { id: string; summary: string; status: string; userId: string; userName: string }[];
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const trimmed = debouncedQuery.trim();
  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["search", trimmed],
    queryFn: () => api.get(`/search?q=${encodeURIComponent(trimmed)}`),
    enabled: isAuthenticated() && open && trimmed.length > 0,
  });

  // Debounce window plus in-flight fetch both count as "searching" - otherwise there's
  // a beat right after typing stops where stale/empty results flash before the request
  // even starts.
  const isSearching = trimmed.length > 0 && (query.trim() !== trimmed || isFetching);
  const resultCount = (data?.people.length ?? 0) + (data?.goals.length ?? 0) + (data?.checkIns.length ?? 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search people, goals, check-ins…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {trimmed.length === 0 && (
          <div className="py-8 text-center text-[12.5px] text-muted-foreground">
            Start typing to search people, goals, and check-ins.
          </div>
        )}

        {trimmed.length > 0 && isSearching && (
          <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {trimmed.length > 0 && !isSearching && (
          <>
            {resultCount === 0 && <CommandEmpty>No results for "{trimmed}"</CommandEmpty>}

            {!!data?.people.length && (
              <CommandGroup heading="People">
                {data.people.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`person-${p.id}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: "/people/$id", params: { id: p.id } });
                    }}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.jobTitle && <span className="text-[11px] text-muted-foreground">{p.jobTitle}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!data?.goals.length && (
              <CommandGroup heading="Goals">
                {data.goals.map((g) => (
                  <CommandItem
                    key={g.id}
                    value={`goal-${g.id}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: "/goals" });
                    }}
                  >
                    <Target className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{g.title}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{g.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!data?.checkIns.length && (
              <CommandGroup heading="Check-ins">
                {data.checkIns.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`checkin-${c.id}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate({ to: "/people/$id", params: { id: c.userId } });
                    }}
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{c.userName}: {c.summary}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
