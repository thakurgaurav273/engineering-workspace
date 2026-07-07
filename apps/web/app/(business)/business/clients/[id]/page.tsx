"use client";
import { useParams } from "next/navigation";
import { ClientDetailPage } from "@/applications/business/routes/business.clients.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ClientDetailPage id={id} />;
}
