import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/shared/lib/errors";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Button,
  Skeleton,
} from "@grovyn/ui/primitives";
import { api, type Paginated } from "@/shared/lib/api";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName, weekLabel } from "@grovyn/utils";
import { Plus, X, Send } from "lucide-react";
import {
  RATING_LABELS,
  REVIEW_HAS_RATING,
  REVIEW_TEXT_FIELDS,
  reviewSections,
  type ReviewTextField,
  type ReviewType,
} from "@/applications/engineering/lib/reviews";

const EMPTY_VALUES: Record<ReviewTextField, string> = {
  wins: "",
  challenges: "",
  learning: "",
  feedback: "",
};
type ReviewStatus = "draft" | "submitted";

interface ReviewItem {
  id: string;
  type: ReviewType;
  weekStart: string;
  wins?: string | null;
  challenges?: string | null;
  learning?: string | null;
  feedback?: string | null;
  rating?: number | null;
  status: ReviewStatus;
  submittedAt?: string | null;
  revieweeId: string;
  reviewerId: string;
  reviewee: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
  };
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
  };
}

interface Report {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  jobTitle?: string;
}

function currentMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function ReviewsPage() {
  const [tab, setTab] = useState<"mine" | "given">("mine");
  const [showNew, setShowNew] = useState(false);
  const [type, setType] = useState<ReviewType>("self");
  const [revieweeId, setRevieweeId] = useState("");
  const [values, setValues] = useState<Record<ReviewTextField, string>>(EMPTY_VALUES);
  // Manager reviews only, and chosen deliberately - no default that slips into the score.
  const [rating, setRating] = useState<number | null>(null);
  const fields = REVIEW_TEXT_FIELDS[type];
  const hasRating = REVIEW_HAS_RATING[type];
  const queryClient = useQueryClient();

  const myId = getStoredAuth()?.user.id;
  const weekStart = currentMondayISO();

  const { data: me } = useQuery<{ id: string; reports: Report[] }>({
    queryKey: ["people", myId],
    queryFn: () => api.get(`/people/${myId}`),
    enabled: isAuthenticated() && !!myId,
  });

  const reports = me?.reports ?? [];

  const myRole = getStoredAuth()?.user.role;
  const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

  // Owners/admins can write a manager review for anyone in the org, not just their
  // direct reports - the backend only requires the subject to be an active member.
  const { data: orgPeople } = useQuery<Paginated<Report>>({
    queryKey: ["people", "review-subjects"],
    queryFn: () => api.get("/people?limit=100"),
    enabled: isAuthenticated() && isAdmin,
  });

  const managerSubjects: Report[] = isAdmin
    ? (orgPeople?.data ?? []).filter((p) => p.id !== myId)
    : reports;
  const canManagerReview = managerSubjects.length > 0;

  const { data: mineData, isLoading: mineLoading } = useQuery<Paginated<ReviewItem>>({
    queryKey: ["reviews", "mine"],
    queryFn: () => api.get("/reviews/mine?limit=50"),
    enabled: isAuthenticated(),
  });

  const { data: givenData, isLoading: givenLoading } = useQuery<Paginated<ReviewItem>>({
    queryKey: ["reviews", "given"],
    queryFn: () => api.get("/reviews/given?limit=50"),
    enabled: isAuthenticated(),
  });

  const items = (tab === "mine" ? mineData?.data : givenData?.data) ?? [];
  const itemsLoading = tab === "mine" ? mineLoading : givenLoading;

  const resetForm = () => {
    setType("self");
    setRevieweeId("");
    setValues(EMPTY_VALUES);
    setRating(null);
    setShowNew(false);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post("/reviews", {
        type,
        weekStart,
        revieweeId: type === "manager" ? revieweeId : undefined,
        // Only this type's fields - the API rejects the rest (a self review has no rating).
        ...Object.fromEntries(fields.map((f) => [f.key, values[f.key].trim() || undefined])),
        rating: hasRating ? (rating ?? undefined) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review saved as draft");
      resetForm();
    },
    onError: (err: Error) => toastError(err, "Couldn't save the review"),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/reviews/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Review submitted");
    },
    onError: (err: Error) => toastError(err, "Couldn't submit the review"),
  });

  const handleCreate = () => {
    if (type === "manager" && !revieweeId) {
      toast.error("Pick who this review is for");
      return;
    }
    const missing = fields.find((f) => f.required && !values[f.key].trim());
    if (missing) {
      toast.error(`${missing.label} is required`);
      return;
    }
    if (hasRating && rating == null) {
      toast.error("Choose a rating");
      return;
    }
    createMutation.mutate();
  };

  return (
    <AppShell>
      <PageHeader
        title="Reviews"
        description="Weekly self and manager reviews. Structured, low-friction, and honest."
        actions={
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            New review
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {showNew && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13.5px] font-semibold">
                  New review · Week of {weekLabel(weekStart)}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  Saved as a draft until you submit it.
                </div>
              </div>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as ReviewType);
                    setRevieweeId("");
                  }}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                >
                  <option value="self">Self review</option>
                  <option value="manager" disabled={!canManagerReview}>
                    Manager review{!canManagerReview ? " (no reports)" : ""}
                  </option>
                </select>
              </div>
              {type === "manager" && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    For
                  </label>
                  <select
                    value={revieweeId}
                    onChange={(e) => setRevieweeId(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
                  >
                    <option value="">Select a person…</option>
                    {managerSubjects.map((r) => (
                      <option key={r.id} value={r.id}>
                        {fullName(r.firstName, r.lastName)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div
              className={`grid grid-cols-1 gap-3 mb-3 ${fields.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {fields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  optional={!f.required}
                  value={values[f.key]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              {hasRating ? (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-2">
                    Rating
                  </label>
                  <select
                    value={rating ?? ""}
                    onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-foreground/40"
                  >
                    <option value="">Choose…</option>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} · {RATING_LABELS[n]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-[11.5px] text-muted-foreground">
                  Self reviews aren&apos;t rated - your manager&apos;s review carries the rating.
                </span>
              )}
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Save draft"}
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
          {(["mine", "given"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-[12.5px] font-medium transition-colors ${tab === t ? "bg-card text-foreground shadow-sm dark:bg-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "mine" ? "About me" : "Given by me"}
            </button>
          ))}
        </div>

        {itemsLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))
        ) : !items.length ? (
          <div className="py-16 text-center text-[12.5px] text-muted-foreground">
            {tab === "mine" ? "No reviews about you yet." : "You haven't written any reviews yet."}
          </div>
        ) : (
          items.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={`${r.type === "self" ? "Self review" : "Manager review"} · Week of ${weekLabel(r.weekStart)}`}
                subtitle={`${fullName(r.reviewee.firstName, r.reviewee.lastName)} · ${r.reviewee.jobTitle ?? ""}`}
                action={
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={userInitials(r.reviewee.firstName, r.reviewee.lastName)}
                      color={avatarColor(r.reviewee.id)}
                      size="sm"
                      src={r.reviewee.avatarUrl}
                    />
                    <Badge tone={r.type === "manager" ? "info" : "neutral"}>{r.type}</Badge>
                    <Badge tone={r.status === "submitted" ? "success" : "warning"}>
                      {r.status}
                    </Badge>
                    {r.type === "manager" && r.rating != null && (
                      <div
                        className="font-mono-num text-[16px] font-semibold"
                        title={RATING_LABELS[r.rating]}
                      >
                        {r.rating}
                        <span className="text-muted-foreground text-[11px]">/5</span>
                      </div>
                    )}
                  </div>
                }
              />
              <div
                className={`grid grid-cols-1 divide-y md:divide-y-0 md:divide-x divide-border ${reviewSections(r).length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
              >
                {reviewSections(r).map((s) => (
                  <ReadField key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
              {r.status === "draft" && r.reviewerId === myId && (
                <div className="flex justify-end p-4 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate(r.id)}
                    disabled={submitMutation.isPending}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitMutation.isPending ? "Submitting…" : "Submit review"}
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </PageBody>
    </AppShell>
  );
}

function Field({
  label,
  optional,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {optional && (
          <span className="ml-1 normal-case font-normal tracking-normal">(optional)</span>
        )}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-md border border-border bg-background p-2.5 text-[13px] outline-none focus:border-foreground/40 resize-none"
      />
    </div>
  );
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="p-5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <p className="mt-1.5 text-[13px] text-foreground leading-relaxed">{value || "-"}</p>
    </div>
  );
}
