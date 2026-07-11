import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Users as UsersIcon, KeyRound } from "lucide-react";
import { avatarColor, userInitials } from "@grovyn/utils";
import {
  PageHeader,
  PageBody,
  Card,
  Badge,
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

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Directory and access for members of this organization."
      />
      <PageBody>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Manages users in the current organization only.
        </p>

        <form onSubmit={handleSearchSubmit} className="mb-3 flex items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

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
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.isActive}
                              disabled={statusBusy}
                              onCheckedChange={(checked) =>
                                statusMutation.mutate({ id: user.id, isActive: checked })
                              }
                              aria-label={`${user.isActive ? "Deactivate" : "Activate"} ${name}`}
                            />
                            <Badge tone={user.isActive ? "success" : "neutral"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-[13px]">{user.department ?? "—"}</div>
                          <div className="text-[12px] text-muted-foreground">
                            {user.jobTitle ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resetBusy}
                            onClick={() => resetPasswordMutation.mutate(user.id)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {resetBusy ? "Sending…" : "Reset password"}
                          </Button>
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
    </>
  );
}
