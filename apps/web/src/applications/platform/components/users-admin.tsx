import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Users as UsersIcon, KeyRound, X } from "lucide-react";
import { avatarColor, userInitials } from "@grovyn/utils";
import {
  PageHeader,
  PageBody,
  Card,
  EmptyState,
  Skeleton,
  Button,
  Avatar,
} from "@grovyn/ui/primitives";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@grovyn/ui/components/table";
import { Switch } from "@grovyn/ui/components/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@grovyn/ui/components/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@grovyn/ui/components/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@grovyn/ui/components/select";
import { api, type Paginated } from "@/shared/lib/api";

// Directory + access management for members of the caller's organization. Roles and active
// status are edited inline; password resets are one-shot (server emails a temporary password).
// Mirrors GET/PATCH/POST /users(...).

type UserRole = "OWNER" | "ADMIN" | "MEMBER";

interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  role: UserRole;
  isActive: boolean;
  status: string;
  createdAt: string;
  manager: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
}

const USERS_KEY = ["platform", "users"] as const;
const PAGE_SIZE = 20;

export function UsersAdmin() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // User pending a password-reset confirmation (reset emails a new temporary password).
  const [confirmReset, setConfirmReset] = useState<UserView | null>(null);

  const { data, isLoading, isFetching } = useQuery<Paginated<UserView>>({
    queryKey: [...USERS_KEY, { page, search }],
    queryFn: () =>
      api.get(
        `/users?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`,
      ),
    placeholderData: keepPreviousData,
  });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: USERS_KEY });

  const roleMutation = useMutation({
    mutationFn: (vars: { id: string; role: UserRole }) =>
      api.patch(`/users/${vars.id}/role`, { role: vars.role }),
    onSuccess: () => {
      invalidateUsers();
      toast.success("Role updated");
    },
    onError: () => toast.error("Couldn't update role"),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      api.patch(`/users/${vars.id}/status`, { isActive: vars.isActive }),
    onSuccess: (_res, vars) => {
      invalidateUsers();
      toast.success(vars.isActive ? "User activated" : "User deactivated");
    },
    onError: () => toast.error("Couldn't update status"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`),
    onSuccess: () => toast.success("Temporary password emailed"),
    onError: () => toast.error("Couldn't reset password"),
  });

  const users = useMemo(() => data?.data ?? [], [data]);
  const totalPages = data?.totalPages ?? 1;

  // Live search: debounce the input so it filters as you type (and reset to page 1).
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  return (
    <TooltipProvider delayDuration={200}>
      <PageHeader
        title="Users"
        description="Directory and access for members of this organization."
      />
      <PageBody>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Manages users in the current organization only.
        </p>

        <div className="mb-3 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search users by name or email"
              className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-8 text-[13px] outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isFetching && !isLoading && (
            <span className="text-[12px] text-muted-foreground">Searching…</span>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<UsersIcon className="h-5 w-5" />}
                title="No users found"
                description={
                  search
                    ? "No members match your search."
                    : "There are no members in this organization yet."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Department / Title</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
                    const roleBusy =
                      roleMutation.isPending && roleMutation.variables?.id === user.id;
                    const statusBusy =
                      statusMutation.isPending && statusMutation.variables?.id === user.id;
                    const resetBusy =
                      resetPasswordMutation.isPending &&
                      resetPasswordMutation.variables === user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              initials={userInitials(user.firstName, user.lastName)}
                              color={avatarColor(user.id)}
                              size="sm"
                              src={user.avatarUrl}
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{name}</div>
                              <div className="text-[12px] text-muted-foreground truncate">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            disabled={roleBusy}
                            onValueChange={(value) =>
                              roleMutation.mutate({ id: user.id, role: value as UserRole })
                            }
                          >
                            <SelectTrigger className="h-8 w-[110px] text-[12.5px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OWNER">Owner</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="MEMBER">Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.isActive}
                            disabled={statusBusy}
                            onCheckedChange={(checked) =>
                              statusMutation.mutate({ id: user.id, isActive: checked })
                            }
                            aria-label={`${name} is ${user.isActive ? "active" : "inactive"}. Toggle to ${user.isActive ? "deactivate" : "activate"}.`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-[13px]">{user.department ?? "-"}</div>
                          <div className="text-[12px] text-muted-foreground">
                            {user.jobTitle ?? "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                disabled={resetBusy}
                                onClick={() => setConfirmReset(user)}
                                aria-label={`Reset password for ${name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Reset password</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {data && data.totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>
              {data.total} user{data.total === 1 ? "" : "s"}
              {isFetching ? " · updating…" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </PageBody>

      <AlertDialog open={!!confirmReset} onOpenChange={(open) => !open && setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password?</AlertDialogTitle>
            <AlertDialogDescription>
              A new temporary password will be generated and emailed to{" "}
              <span className="font-medium text-foreground">{confirmReset?.email}</span>. Their
              current password stops working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReset) resetPasswordMutation.mutate(confirmReset.id);
                setConfirmReset(null);
              }}
            >
              Reset &amp; email password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
