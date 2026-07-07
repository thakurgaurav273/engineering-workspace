import { createFileRoute } from "@tanstack/react-router";
import { CompanyProfilePage } from "@/applications/business/routes/business.company";

export const Route = createFileRoute("/business/company")({ component: CompanyProfilePage });
