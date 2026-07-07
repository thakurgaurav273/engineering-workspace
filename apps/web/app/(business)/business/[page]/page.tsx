"use client";
import { useParams } from "next/navigation";
import { BusinessPageRoute } from "@/applications/business/routes/business.$page";

export default function Page() {
  const { page } = useParams<{ page: string }>();
  return <BusinessPageRoute page={page} />;
}
