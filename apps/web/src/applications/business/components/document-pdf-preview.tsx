import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Shows the document's real PDF (the same bytes "Download PDF" returns) in the browser's PDF
 * viewer, so the preview has the exact pages, margins and page numbers the recipient gets.
 * `path` is the API route, e.g. "/business/invoices/<id>/pdf".
 */
export function DocumentPdfPreview({ path, title }: { path: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    (async () => {
      const { getStoredAuth } = await import("@/platform/auth/auth");
      const base = process.env.NEXT_PUBLIC_API_URL || "/api";
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${getStoredAuth()?.accessToken ?? ""}` },
      });
      if (!res.ok) throw new Error("pdf");
      objectUrl = URL.createObjectURL(await res.blob());
      if (cancelled) URL.revokeObjectURL(objectUrl);
      else setUrl(objectUrl);
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  const frame = "h-[70vh] w-full rounded-md border border-border bg-muted";
  if (failed) {
    return (
      <div className={`${frame} grid place-items-center text-[13px] text-muted-foreground`}>
        Couldn’t render the PDF.
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`${frame} grid place-items-center text-muted-foreground`}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return <iframe title={title} src={`${url}#view=FitH`} className={frame} />;
}
