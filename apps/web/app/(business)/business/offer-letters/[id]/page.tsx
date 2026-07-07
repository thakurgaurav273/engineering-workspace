"use client";
import { useParams } from "next/navigation";
import { OfferLetterDetailPage } from "@/applications/business/routes/business.offer-letters.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <OfferLetterDetailPage id={id} />;
}
