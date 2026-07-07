import { createFileRoute } from "@tanstack/react-router";
import { TaskUpdatesPage } from "@/applications/engineering/routes/task-updates.index";

export const Route = createFileRoute("/task-updates/")({ component: TaskUpdatesPage });
