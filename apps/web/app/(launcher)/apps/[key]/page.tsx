"use client";
import { useParams } from "next/navigation";
import { ApplicationMetadata } from "@/platform/shell/application-metadata";

export default function Page() {
  const { key } = useParams<{ key: string }>();
  return <ApplicationMetadata appKey={key} />;
}
