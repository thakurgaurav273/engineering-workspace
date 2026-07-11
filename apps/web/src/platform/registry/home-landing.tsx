"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAuthenticated, getStoredAuth } from "@/platform/auth/auth";
import { api } from "@/shared/lib/api";
import { useApplication } from "@/platform/registry/application-context";
import { resolveLandingPath } from "@/platform/registry/landing";
import { Dashboard } from "@/applications/engineering/routes/index";

interface LandingPreference {
  defaultApplicationKey?: string | null;
}

/**
 * Home-route gate. The Engineering dashboard owns `/`, but a user should land on their preferred
 * application (or the launcher when they have no preference). This resolves that preference against
 * the apps they can access and redirects away from `/` unless Engineering itself is the target.
 * Rendering nothing while deciding (and while redirecting) avoids a flash of the wrong app.
 */
export function HomeLanding() {
  const router = useRouter();
  const { applications, isLoading: appsLoading } = useApplication();
  const userId = getStoredAuth()?.user?.id;

  const { data: pref, isLoading: prefLoading } = useQuery<LandingPreference>({
    queryKey: ["preference", userId],
    queryFn: () => api.get(`/users/${userId}/preference`),
    enabled: isAuthenticated() && !!userId,
  });

  const ready = !appsLoading && !prefLoading;
  const target = ready ? resolveLandingPath(applications, pref?.defaultApplicationKey) : null;

  // Only redirect to a *specific preferred application* (e.g. /business, /admin). We must NEVER
  // redirect `/` -> `/apps`: Engineering owns `/`, so bouncing to the launcher would make
  // Engineering permanently unreachable (launching it from the launcher navigates here). With no
  // preference - or a preference for Engineering itself - this renders Engineering directly.
  const redirectTo = target && target !== "/" && target !== "/apps" ? target : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Still deciding, or redirecting to a preferred app - render nothing to avoid a flash.
  if (!ready || redirectTo) return null;
  return <Dashboard />;
}
