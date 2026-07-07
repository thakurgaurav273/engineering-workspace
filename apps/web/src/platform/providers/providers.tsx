"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { OrganizationProvider } from "@/platform/auth/organization-context";
import { ApplicationProvider } from "@/platform/registry/application-context";
import { AuthGuard } from "@/platform/providers/auth-guard";

/**
 * Single client provider tree for the whole platform. Mirrors the old TanStack
 * `RootComponent`: one QueryClient, one OrganizationProvider, one ApplicationProvider,
 * one Toaster. Rendering is gated on client mount so the app behaves exactly like the
 * previous shell (which rendered nothing until its client-side auth check ran) — this
 * also keeps localStorage-based auth off the server render path.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        <ApplicationProvider>
          <AuthGuard>{children}</AuthGuard>
          <Toaster position="bottom-right" richColors />
        </ApplicationProvider>
      </OrganizationProvider>
    </QueryClientProvider>
  );
}
