import { useRef, useState } from "react";
import { Loader2, PenLine, Trash2, Upload } from "lucide-react";
import { Button } from "@grovyn/ui/primitives";
import { SIGNATURE_ACCEPT, uploadSignature, validateImageFile, SIGNATURE_MAX_BYTES, SIGNATURE_ALLOWED_MIME } from "@/shared/lib/uploads";

/**
 * Upload / preview / remove a personal signature image. The image is uploaded straight to R2
 * (via a presigned URL) and the resulting public URL is handed back through `onChange` for the
 * parent to persist (PATCH /users/:id/signature). Passing an empty string clears it.
 */
export function SignatureUploader({
  userId,
  currentUrl,
  onChange,
  saving = false,
  disabled = false,
}: {
  userId: string;
  currentUrl?: string | null;
  onChange: (url: string) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = phase === "uploading" || saving;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateImageFile(file, {
      maxBytes: SIGNATURE_MAX_BYTES,
      allowed: SIGNATURE_ALLOWED_MIME as readonly string[],
    });
    if (invalid) {
      setPhase("error");
      setError(invalid);
      return;
    }
    setPhase("uploading");
    setError(null);
    try {
      const url = await uploadSignature(userId, file);
      await onChange(url);
      setPhase("idle");
    } catch (err) {
      setPhase("error");
      setError((err as Error).message || "Upload failed");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="relative grid h-[72px] w-[220px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Your signature" className="max-h-[60px] max-w-[200px] object-contain" />
          ) : (
            <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <PenLine className="h-3.5 w-3.5" /> No signature
            </span>
          )}
          {busy && (
            <div className="absolute grid h-[72px] w-[220px] place-items-center bg-white/60">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={SIGNATURE_ACCEPT}
            className="hidden"
            onChange={pick}
            disabled={disabled || busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
              <Upload className="h-3.5 w-3.5" />
              {currentUrl ? "Change signature" : "Upload signature"}
            </Button>
            {currentUrl && !busy ? (
              <Button variant="ghost" size="sm" onClick={() => onChange("")} disabled={disabled}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            ) : null}
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            PNG (transparent works best), JPG, or WebP · up to 2MB. Used on offer letters you sign.
          </p>
          {phase === "error" && error ? (
            <p className="text-[11.5px] text-rose-600 dark:text-rose-400">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
