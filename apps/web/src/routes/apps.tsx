import { createFileRoute } from "@tanstack/react-router";
import { LauncherPage } from "@/platform/shell/launcher";

export const Route = createFileRoute("/apps")({ component: LauncherPage });
