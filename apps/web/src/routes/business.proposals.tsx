import { createFileRoute } from "@tanstack/react-router";
import { ProposalsPage } from "@/applications/business/routes/business.proposals";

export const Route = createFileRoute("/business/proposals")({ component: ProposalsPage });
