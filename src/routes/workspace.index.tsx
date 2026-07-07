import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/applications/engineering/routes/workspace.index";

export const Route = createFileRoute("/workspace/")({ component: WorkspacePage });
