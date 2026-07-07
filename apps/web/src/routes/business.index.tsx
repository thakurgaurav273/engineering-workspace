import { createFileRoute } from "@tanstack/react-router";
import { BusinessIndexRoute } from "@/applications/business/routes/business.index";

export const Route = createFileRoute("/business/")({ component: BusinessIndexRoute });
