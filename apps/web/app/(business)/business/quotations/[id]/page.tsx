"use client";
import { useParams } from "next/navigation";
import { QuotationDetailPage } from "@/applications/business/routes/business.quotations.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <QuotationDetailPage id={id} />;
}
