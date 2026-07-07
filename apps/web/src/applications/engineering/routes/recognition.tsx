import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  Avatar,
  Badge,
  Button,
  Skeleton,
  SkeletonListItem,
} from "@grovyn/ui/primitives";
import { api, type Paginated } from "@/shared/lib/api";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName, relativeTime } from "@grovyn/utils";
import { Sparkles, Send, Lock } from "lucide-react";


interface RecognitionItem {
  id: string;
  title: string;
  note?: string | null;
  createdAt: string;
  isPrivate: boolean;
  orgId: string;
  authorId: string;
  recipientId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
  };
  recipient: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
  };
}

interface UserPreference {
  autoShareRecognition: boolean;
}

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  email: string;
}

export function RecognitionPage() {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [recipientId, setRecipientId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: feed, isLoading: feedLoading } = useQuery<Paginated<RecognitionItem>>({
    queryKey: ["recognition"],
    queryFn: () => api.get("/recognition?limit=50"),
    enabled: isAuthenticated(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<Paginated<OrgUser>>({
    queryKey: ["users"],
    queryFn: () => api.get("/users?limit=100"),
    enabled: isAuthenticated(),
  });

  const currentUserId = getStoredAuth()?.user.id;
  const users = (usersData?.data ?? []).filter((u) => u.id !== currentUserId);

  const { data: pref } = useQuery<UserPreference>({
    queryKey: ["preference", currentUserId],
    queryFn: () => api.get(`/users/${currentUserId}/preference`),
    enabled: isAuthenticated() && !!currentUserId,
  });

  useEffect(() => {
    if (users.length && !recipientId) setRecipientId(users[0].id);
  }, [users]);

  const sendMutation = useMutation({
    mutationFn: (body: { recipientId: string; title: string; note?: string }) =>
      api.post("/recognition", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recognition"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setTitle("");
      setNote("");
      toast.success("Recognition sent!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSend = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!recipientId) {
      toast.error("Please select a recipient");
      return;
    }
    sendMutation.mutate({ recipientId, title: title.trim(), note: note.trim() || undefined });
  };

  const recognizePanel = (
    <div className="p-4">
      <Card>
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold">Recognize a teammate</div>
              <div className="text-[11.5px] text-muted-foreground">
                A short note goes a long way.
              </div>
            </div>
          </div>
        </div>
        {usersLoading ? (
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : !users.length ? (
          <div className="p-5 text-[12.5px] text-muted-foreground">
            You're the only person in this org right now. Invite a teammate from the{" "}
            <Link href="/people" className="text-foreground underline underline-offset-2">
              People
            </Link>{" "}
            page to start recognizing them.
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                To
              </label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {fullName(u.firstName, u.lastName)} · {u.jobTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What did they do well?"
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Note{" "}
                <span className="text-muted-foreground normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Add a personal message"
                className="mt-2 w-full rounded-md border border-border bg-background p-3 text-[13px] outline-none focus:border-foreground/40 resize-none"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                {pref?.autoShareRecognition === false ? (
                  <>
                    Private - only you and the recipient will see this.{" "}
                    <Link
                      href="/settings"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Change
                    </Link>
                  </>
                ) : (
                  "Shared with the team feed"
                )}
              </span>
              <Button onClick={handleSend} disabled={sendMutation.isPending}>
                <Send className="h-3.5 w-3.5" />
                {sendMutation.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  const items = feed?.data ?? [];

  return (
    <AppShell right={recognizePanel}>
      <PageHeader
        title="Recognition"
        description="A quiet, thoughtful way to appreciate great work."
      />
      <PageBody>
        {feedLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonListItem key={i} lines={2} />
            ))}
          </div>
        ) : !items.length ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-[12.5px] text-muted-foreground">
            No recognitions yet. Be the first to recognize a teammate!
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <Card key={r.id} className="p-5 hover:border-foreground/15 transition-all">
                <div className="flex items-start gap-4">
                  <Avatar
                    initials={userInitials(r.recipient.firstName, r.recipient.lastName)}
                    color={avatarColor(r.recipient.id)}
                    size="lg"
                    src={r.recipient.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold">
                        {fullName(r.recipient.firstName, r.recipient.lastName)}
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        recognized by{" "}
                        <span className="text-foreground font-medium">
                          {fullName(r.author.firstName, r.author.lastName)}
                        </span>
                      </span>
                      {r.isPrivate && (
                        <Badge className="gap-1">
                          <Lock className="h-2.5 w-2.5" /> Private
                        </Badge>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono-num">
                        {relativeTime(r.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-[15px] font-semibold text-foreground leading-snug">
                      {r.title}
                    </div>
                    {r.note && (
                      <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                        {r.note}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
