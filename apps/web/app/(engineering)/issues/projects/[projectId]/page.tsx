"use client";
import { useParams } from "next/navigation";
import { IssueProjectDetailPage } from "@/applications/engineering/routes/issues.projects.$projectId";

export default function Page() {
  const { projectId } = useParams<{ projectId: string }>();
  return <IssueProjectDetailPage projectId={projectId} />;
}
