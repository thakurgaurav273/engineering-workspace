"use client";
import { Suspense } from "react";
import { IssueProjectsPage } from "@/applications/engineering/routes/issues.projects";

// The page reads its team from the URL (useSearchParams), which needs a boundary.
export default function Page() {
  return (
    <Suspense>
      <IssueProjectsPage />
    </Suspense>
  );
}
