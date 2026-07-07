import { createFileRoute } from "@tanstack/react-router";
import { AcceptInvitePage } from "@/platform/auth/accept-invite";

export const Route = createFileRoute("/accept-invite")({ component: AcceptInvitePage });
