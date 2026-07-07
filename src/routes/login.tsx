import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/platform/auth/login";

export const Route = createFileRoute("/login")({ component: LoginPage });
