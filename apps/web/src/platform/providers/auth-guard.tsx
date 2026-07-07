"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/platform/auth/auth";

/** Public routes that never require authentication. */
const PUBLIC_PATHS = new Set(["/login", "/accept-invite"]);

/**
 * Client-side auth gate. Byte-for-byte the same behavior as the old TanStack
 * `RootComponent`: nothing renders until the client-side auth check completes, an
 * unauthenticated user on a private route is sent to /login, and an authenticated user
 * on /login is sent home. Auth lives in localStorage, so this must run on the client —
 * see middleware.ts for why it can't live at the edge.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const authed = isAuthenticated();
    if (!authed && !PUBLIC_PATHS.has(pathname)) {
      router.replace("/login");
      return;
    }
    if (authed && pathname === "/login") {
      router.replace("/apps");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (!checked) return null;
  return <>{children}</>;
}
