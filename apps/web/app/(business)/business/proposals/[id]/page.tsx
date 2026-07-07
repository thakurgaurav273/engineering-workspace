"use client";
import { useParams } from "next/navigation";
import { ProposalDetailPage } from "@/applications/business/routes/business.proposals.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ProposalDetailPage id={id} />;
}
