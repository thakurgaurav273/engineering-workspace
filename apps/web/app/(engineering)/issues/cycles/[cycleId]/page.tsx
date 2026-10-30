"use client";
import { useParams } from "next/navigation";
import { IssueCycleDetailPage } from "@/applications/engineering/routes/issues.cycles.$cycleId";

export default function Page() {
  const { cycleId } = useParams<{ cycleId: string }>();
  return <IssueCycleDetailPage cycleId={cycleId} />;
}
