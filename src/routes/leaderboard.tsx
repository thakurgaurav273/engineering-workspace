import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/applications/engineering/routes/leaderboard";

export const Route = createFileRoute("/leaderboard")({ component: LeaderboardPage });
