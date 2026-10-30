"use client";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TemplateEditorPage } from "@/applications/business/routes/business.templates.$id";

// The editor keeps its tab in the URL (useSearchParams), which needs a Suspense boundary.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <TemplateEditorPage id={id} />
    </Suspense>
  );
}
