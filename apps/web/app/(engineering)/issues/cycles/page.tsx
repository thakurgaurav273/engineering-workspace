"use client";
import { Suspense } from "react";
import { IssueCyclesPage } from "@/applications/engineering/routes/issues.cycles";

// The page reads its team from the URL (useSearchParams), which needs a boundary.
export default function Page() {
  return (
    <Suspense>
      <IssueCyclesPage />
    </Suspense>
  );
}
