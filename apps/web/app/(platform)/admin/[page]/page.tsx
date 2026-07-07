"use client";
import { useParams } from "next/navigation";
import { AdminPageRoute } from "@/applications/platform/routes/admin.$page";

export default function Page() {
  const { page } = useParams<{ page: string }>();
  return <AdminPageRoute page={page} />;
}
