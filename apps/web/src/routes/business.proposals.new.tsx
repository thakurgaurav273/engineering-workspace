import { createFileRoute } from "@tanstack/react-router";
import { NewProposalPage } from "@/applications/business/routes/business.proposals.new";

export const Route = createFileRoute("/business/proposals/new")({ component: NewProposalPage });
