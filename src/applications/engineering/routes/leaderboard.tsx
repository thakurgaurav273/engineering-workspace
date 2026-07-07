import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/platform/shell/app-shell";
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Skeleton,
  SkeletonTableRow,
} from "@/shared/components/primitives";
import { api } from "@/shared/lib/api";
import { isAuthenticated } from "@/platform/auth/auth";
import { avatarColor, userInitials, fullName } from "@/shared/lib/transforms";
import { Trophy, ArrowUp, ArrowDown, Minus } from "lucide-react";


interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    jobTitle?: string;
    department?: string;
  };
  checkInScore: number;
  goalScore: number;
  recognitionScore: number;
  linearScore: number | null;
  linearIssuesCompleted: number;
  linearPoints: number;
  totalScore: number;
  trend: "up" | "down" | "same";
}

interface LeaderboardData {
  rankings: LeaderboardEntry[];
  period: string;
  periodStart: string;
  computedAt: string;
}

type Period = "week" | "month" | "quarter";

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>("week");

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["leaderboard", period],
    queryFn: () => api.get(`/leaderboard?period=${period}`),
    enabled: isAuthenticated(),
  });

  const rankings = data?.rankings ?? [];
  const podium = rankings.slice(0, 3);
  const rest = rankings.slice(3);
  const linearConnected = rankings.some((r) => r.linearScore !== null);

  return (
    <AppShell>
      <PageHeader
        title="Leaderboard"
        description={
          isLoading
            ? " "
            : linearConnected
              ? "Top contributors, based on a blend of check-in consistency, goal completion, recognition, and Linear activity."
              : "Top contributors, based on a blend of check-in consistency, goal completion, and recognition."
        }
        actions={
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-0.5">
            {(["week", "month", "quarter"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded text-[12.5px] capitalize transition-colors ${period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p}
              </button>
            ))}
          </div>
        }
      />
      <PageBody className="space-y-6">
        {isLoading ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className={`p-5 ${["md:mt-0", "md:mt-6", "md:mt-10"][i]}`}>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 pt-4 border-t border-border">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="space-y-1.5">
                        <Skeleton className="h-2.5 w-10" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader title="Full ranking" subtitle="Loading…" />
              <table className="w-full text-[13px]">
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonTableRow key={i} cols={5} />
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        ) : !podium.length ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-[12.5px] text-muted-foreground">
            No data yet - submit check-ins and complete goals to appear here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {podium.map((entry, i) => {
                const heights = ["md:mt-0", "md:mt-6", "md:mt-10"];
                return (
                  <Link
                    key={entry.user.id}
                    to="/people/$id"
                    params={{ id: entry.user.id }}
                    className={heights[i]}
                  >
                    <Card className="p-5 hover:border-foreground/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`grid h-7 w-7 place-items-center rounded-md text-[12px] font-bold font-mono-num ${
                              i === 0
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : i === 1
                                  ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                                  : "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                            }`}
                          >
                            {entry.rank}
                          </div>
                          {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                        </div>
                        <Badge>{entry.user.department}</Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Avatar
                          initials={userInitials(entry.user.firstName, entry.user.lastName)}
                          color={avatarColor(entry.user.id)}
                          size="lg"
                          src={entry.user.avatarUrl}
                        />
                        <div className="min-w-0">
                          <div className="text-[15px] font-semibold truncate">
                            {fullName(entry.user.firstName, entry.user.lastName)}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            {entry.user.jobTitle}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`mt-5 grid gap-2 pt-4 border-t border-border ${linearConnected ? "grid-cols-4" : "grid-cols-3"}`}
                      >
                        <Metric label="Score" value={entry.totalScore} />
                        <Metric label="Check-in" value={`${entry.checkInScore}%`} />
                        <Metric label="Goals" value={`${entry.goalScore}%`} />
                        {linearConnected && (
                          <Metric label="Linear" value={entry.linearIssuesCompleted} />
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {rest.length > 0 && (
              <Card>
                <CardHeader
                  title="Full ranking"
                  subtitle={`All engineers ranked by ${period}ly activity`}
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="border-b border-border">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pl-5 pr-3">#</th>
                        <th className="py-2.5 px-3">Engineer</th>
                        <th className="py-2.5 px-3 hidden md:table-cell">Team</th>
                        <th className="py-2.5 px-3 text-right font-mono-num">Score</th>
                        <th className="py-2.5 px-3 text-right font-mono-num hidden sm:table-cell">
                          Check-in
                        </th>
                        <th className="py-2.5 px-3 text-right font-mono-num hidden sm:table-cell">
                          Goals
                        </th>
                        {linearConnected && (
                          <th className="py-2.5 px-3 text-right font-mono-num hidden sm:table-cell">
                            Linear
                          </th>
                        )}
                        <th className="py-2.5 pl-3 pr-5 text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((entry) => (
                        <tr
                          key={entry.user.id}
                          className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                        >
                          <td className="py-3 pl-5 pr-3 font-mono-num text-muted-foreground">
                            {entry.rank}
                          </td>
                          <td className="py-3 px-3">
                            <Link
                              to="/people/$id"
                              params={{ id: entry.user.id }}
                              className="flex items-center gap-2.5"
                            >
                              <Avatar
                                initials={userInitials(entry.user.firstName, entry.user.lastName)}
                                color={avatarColor(entry.user.id)}
                                size="sm"
                                src={entry.user.avatarUrl}
                              />
                              <div className="min-w-0">
                                <div className="font-medium truncate">
                                  {fullName(entry.user.firstName, entry.user.lastName)}
                                </div>
                                <div className="text-[11.5px] text-muted-foreground md:hidden">
                                  {entry.user.department}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">
                            {entry.user.department}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num font-semibold">
                            {entry.totalScore}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-muted-foreground hidden sm:table-cell">
                            {entry.checkInScore}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono-num text-muted-foreground hidden sm:table-cell">
                            {entry.goalScore}%
                          </td>
                          {linearConnected && (
                            <td className="py-3 px-3 text-right font-mono-num text-muted-foreground hidden sm:table-cell">
                              {entry.linearIssuesCompleted}
                            </td>
                          )}
                          <td className="py-3 pl-3 pr-5 text-right">
                            {entry.trend === "up" && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[11.5px]">
                                <ArrowUp className="h-3 w-3" />
                              </span>
                            )}
                            {entry.trend === "down" && (
                              <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 text-[11.5px]">
                                <ArrowDown className="h-3 w-3" />
                              </span>
                            )}
                            {entry.trend === "same" && (
                              <span className="inline-flex items-center gap-0.5 text-muted-foreground text-[11.5px]">
                                <Minus className="h-3 w-3" />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </PageBody>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono-num text-[14px] font-semibold">{value}</div>
    </div>
  );
}
