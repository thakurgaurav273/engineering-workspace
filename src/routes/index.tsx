import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/applications/engineering/routes/index";

export const Route = createFileRoute("/")({ component: Dashboard });
