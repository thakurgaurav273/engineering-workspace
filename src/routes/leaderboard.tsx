import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader, PageBody, Card, CardHeader, Avatar, Badge } from "@/components/primitives";
import { people } from "@/lib/mock-data";
import { Trophy, ArrowUp, ArrowDown, Minus } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({ component: LeaderboardPage });

function LeaderboardPage() {
  const ranked = [...people].sort((a, b) => b.performanceScore - a.performanceScore);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const trends = ["up", "up", "down", "same", "up", "down", "up", "same", "up", "up", "down", "up"];

  return (
    <AppShell>
      <PageHeader title="Leaderboard" description="Top contributors, based on a blend of check-in consistency, goal completion, and recognition." />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {podium.map((p, i) => {
            const rank = i + 1;
            const heights = ["md:mt-0", "md:mt-6", "md:mt-10"];
            return (
              <Link key={p.id} to="/people/$id" params={{ id: p.id }} className={heights[i]}>
                <Card className="p-5 hover:border-foreground/20 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`grid h-7 w-7 place-items-center rounded-md text-[12px] font-bold font-mono-num ${rank === 1 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : rank === 2 ? "bg-slate-500/15 text-slate-700 dark:text-slate-300" : "bg-orange-500/15 text-orange-700 dark:text-orange-400"}`}>
                        {rank}
                      </div>
                      {rank === 1 && <Trophy className="h-4 w-4 text-amber-500" />}
                    </div>
                    <Badge>{p.team}</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar initials={p.initials} color={p.color} size="lg" />
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold truncate">{p.name}</div>
                      <div className="text-[12px] text-muted-foreground">{p.role}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 pt-4 border-t border-border">
                    <Metric label="Score" value={p.performanceScore} />
                    <Metric label="Recog" value={p.recognitionCount} />
                    <Metric label="Goals" value={`${p.goalCompletion}%`} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card>
          <CardHeader title="Full ranking" subtitle="All engineers, weighted by activity this cycle" />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pl-5 pr-3">#</th>
                  <th className="py-2.5 px-3">Engineer</th>
                  <th className="py-2.5 px-3 hidden md:table-cell">Team</th>
                  <th className="py-2.5 px-3 text-right font-mono-num">Score</th>
                  <th className="py-2.5 px-3 text-right font-mono-num hidden sm:table-cell">Recog</th>
                  <th className="py-2.5 px-3 text-right font-mono-num hidden sm:table-cell">Goals</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((p, i) => {
                  const rank = i + 4;
                  const t = trends[rank] || "same";
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="py-3 pl-5 pr-3 font-mono-num text-muted-foreground">{rank}</td>
                      <td className="py-3 px-3">
                        <Link to="/people/$id" params={{ id: p.id }} className="flex items-center gap-2.5">
                          <Avatar initials={p.initials} color={p.color} size="sm" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-[11.5px] text-muted-foreground md:hidden">{p.team}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground hidden md:table-cell">{p.team}</td>
                      <td className="py-3 px-3 text-right font-mono-num font-semibold">{p.performanceScore}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-muted-foreground hidden sm:table-cell">{p.recognitionCount}</td>
                      <td className="py-3 px-3 text-right font-mono-num text-muted-foreground hidden sm:table-cell">{p.goalCompletion}%</td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        {t === "up" && <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-[11.5px]"><ArrowUp className="h-3 w-3" />2</span>}
                        {t === "down" && <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 text-[11.5px]"><ArrowDown className="h-3 w-3" />1</span>}
                        {t === "same" && <span className="inline-flex items-center gap-0.5 text-muted-foreground text-[11.5px]"><Minus className="h-3 w-3" /></span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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
