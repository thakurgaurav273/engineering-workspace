import { createFileRoute } from "@tanstack/react-router";
import { ReviewsPage } from "@/applications/engineering/routes/reviews";

export const Route = createFileRoute("/reviews")({ component: ReviewsPage });
