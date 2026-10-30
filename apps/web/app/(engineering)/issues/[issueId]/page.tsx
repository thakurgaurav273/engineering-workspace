"use client";
import { useParams } from "next/navigation";
import { IssueDetailPage } from "@/applications/engineering/routes/issues.$issueId";

export default function Page() {
  const { issueId } = useParams<{ issueId: string }>();
  return <IssueDetailPage issueId={issueId} />;
}
