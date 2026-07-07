import { createFileRoute } from "@tanstack/react-router";
import { RecognitionPage } from "@/applications/engineering/routes/recognition";

export const Route = createFileRoute("/recognition")({ component: RecognitionPage });
