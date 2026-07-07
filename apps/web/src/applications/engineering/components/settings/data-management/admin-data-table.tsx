import { type ReactNode, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Search, Trash2 } from "lucide-react";
import { Card, Button, EmptyState, SkeletonTableRow } from "@grovyn/ui/primitives";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@grovyn/ui/components/table";
import { Checkbox } from "@grovyn/ui/components/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@grovyn/ui/components/alert-dialog";
import { api } from "@/shared/lib/api";
import { isAuthenticated } from "@/platform/auth/auth";
import type { Paginated } from "@/shared/lib/api";

export interface AdminColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AdminDataTableProps<T extends { id: string }> {
  resource: string;
  entityLabel: string;
  entityLabelPlural: string;
  columns: AdminColumn<T>[];
  searchPlaceholder: string;
}

export function AdminDataTable<T extends { id: string }>({
  resource,
  entityLabel,
  entityLabelPlural,
  columns,
  searchPlaceholder,
}: AdminDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, userId, from, to, resource]);

  const { data: usersData } = useQuery<Paginated<UserOption>>({
    queryKey: ["admin-data-management", "users"],
    queryFn: () => api.get("/users?limit=100"),
    enabled: isAuthenticated(),
  });
  const users = usersData?.data ?? [];

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (userId) params.set("userId", userId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading, isError, error, refetch } = useQuery<Paginated<T>>({
    queryKey: ["admin-data-management", resource, page, search, userId, from, to],
    queryFn: () => api.get(`/admin/data-management/${resource}?${params.toString()}`),
    enabled: isAuthenticated(),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-data-management", resource] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/data-management/${resource}/${id}`),
    onSuccess: (_data, id) => {
      toast.success(`${capitalize(entityLabel)} deleted`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post<{ message: string; count: number }>(`/admin/data-management/${resource}/bulk-delete`, { ids }),
    onSuccess: (result) => {
      toast.success(`${result.count} ${result.count === 1 ? entityLabel : entityLabelPlural} deleted`);
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-foreground/40"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-foreground/40"
            />
            <span className="text-[11.5px] text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-foreground/40"
            />
          </div>
        </div>
        {selectedIds.size > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setBulkConfirmOpen(true)} className="text-rose-600 dark:text-rose-400">
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
                aria-label={`Select all ${entityLabelPlural} on this page`}
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
            <TableHead className="w-16 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} cols={columns.length + 2} />)
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={columns.length + 2} className="p-0">
                <EmptyState
                  icon={<AlertTriangle className="h-5 w-5" />}
                  title={`Couldn't load ${entityLabelPlural}`}
                  description={error instanceof Error ? error.message : "Something went wrong. Please try again."}
                  action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>}
                />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 2} className="p-0">
                <EmptyState icon={<Search className="h-5 w-5" />} title={`No ${entityLabelPlural} found`} description="Try adjusting your search or filters." />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-state={selectedIds.has(row.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={() => toggleRow(row.id)}
                    aria-label={`Select this ${entityLabel}`}
                  />
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <button
                    onClick={() => setDeleteTarget(row.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                    aria-label={`Delete this ${entityLabel}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="text-[11.5px] text-muted-foreground">
          {total} {total === 1 ? entityLabel : entityLabelPlural} total
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11.5px] text-muted-foreground">
            Page {data ? page : 0} of {totalPages || 1}
          </span>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {entityLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the {entityLabel} and any notifications referencing it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-600/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? entityLabel : entityLabelPlural}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected {entityLabelPlural} and any notifications referencing them. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-600/90"
              disabled={bulkDeleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                bulkDeleteMutation.mutate(Array.from(selectedIds));
              }}
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
