"use client";
import { Suspense } from "react";
import { IssuesPage } from "@/applications/engineering/routes/issues.index";

// IssuesPage reads its view/team from the URL (useSearchParams), which needs a boundary.
export default function Page() {
  return (
    <Suspense>
      <IssuesPage />
    </Suspense>
  );
}
