import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/applications/engineering/routes/settings";

export const Route = createFileRoute("/settings")({ component: SettingsPage });
