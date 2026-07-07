import { createFileRoute } from "@tanstack/react-router";
import { BusinessSettingsPage } from "@/applications/business/routes/business.settings";

export const Route = createFileRoute("/business/settings")({ component: BusinessSettingsPage });
