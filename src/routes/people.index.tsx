import { createFileRoute } from "@tanstack/react-router";
import { PeoplePage } from "@/applications/engineering/routes/people.index";

export const Route = createFileRoute("/people/")({ component: PeoplePage });
