import { createFileRoute } from "@tanstack/react-router";
import { CheckInsPage } from "@/applications/engineering/routes/checkins";

export const Route = createFileRoute("/checkins")({ component: CheckInsPage });
