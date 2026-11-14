"use client";
import { useParams } from "next/navigation";
import { TeamDetailPage } from "@/applications/engineering/routes/teams.$teamId";

export default function Page() {
  const { teamId } = useParams<{ teamId: string }>();
  return <TeamDetailPage teamId={teamId} section="members" />;
}
