import { useEffect } from "react";

/**
 * Warns the user before leaving the page (browser close / refresh / back) while a
 * form has unsaved edits. In-app TanStack navigation isn't intercepted here — this
 * covers the destructive browser-level exits, which is the common data-loss path.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
