"use client";
import { useParams } from "next/navigation";
import { WorkspaceItemDetailPage } from "@/applications/engineering/routes/workspace.$itemId";

export default function Page() {
  const { itemId } = useParams<{ itemId: string }>();
  return <WorkspaceItemDetailPage itemId={itemId} />;
}
