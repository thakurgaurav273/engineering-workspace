import { createFileRoute } from "@tanstack/react-router";
import { AdminIndexRoute } from "@/applications/platform/routes/admin.index";

export const Route = createFileRoute("/admin/")({ component: AdminIndexRoute });
