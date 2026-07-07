import { createFileRoute } from "@tanstack/react-router";
import { GoalsPage } from "@/applications/engineering/routes/goals";

export const Route = createFileRoute("/goals")({ component: GoalsPage });
