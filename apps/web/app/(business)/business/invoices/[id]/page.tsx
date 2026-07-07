"use client";
import { useParams } from "next/navigation";
import { InvoiceDetailPage } from "@/applications/business/routes/business.invoices.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceDetailPage id={id} />;
}
