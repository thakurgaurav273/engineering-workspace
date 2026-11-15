"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface UrlIntentProps {
  /** Query param that carries the intent, e.g. `new` for `/teams?new=1`. */
  param: string;
  /** Opens the page's own flow. Must be safe to call more than once (set state to true). */
  onIntent: () => void;
}

function UrlIntentInner({ param, onIntent }: UrlIntentProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = params.get(param) === "1";

  useEffect(() => {
    if (!requested) return;
    onIntent();
    // Drop the param so a refresh or Back doesn't open it again.
    const rest = new URLSearchParams(params.toString());
    rest.delete(param);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [requested, onIntent, param, params, pathname, router]);

  return null;
}

/**
 * Runs `onIntent` when the URL asks for it (`?{param}=1`) - how a sidebar "+" shortcut such as
 * Teams → "New team" opens a page's create flow, including when that page is already open.
 * Carries its own Suspense boundary, so the page needn't have one for `useSearchParams`.
 */
export function UrlIntent(props: UrlIntentProps) {
  return (
    <Suspense fallback={null}>
      <UrlIntentInner {...props} />
    </Suspense>
  );
}
