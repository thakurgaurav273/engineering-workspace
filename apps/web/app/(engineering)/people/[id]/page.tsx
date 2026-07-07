"use client";
import { useParams } from "next/navigation";
import { PersonPage } from "@/applications/engineering/routes/people.$id";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PersonPage id={id} />;
}
