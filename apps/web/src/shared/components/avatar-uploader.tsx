import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, X } from "lucide-react";
import { Avatar, Button } from "@/shared/components/primitives";
import { cn } from "@/shared/lib/utils";
import { AVATAR_ACCEPT, uploadAvatar, validateImageFile } from "@/shared/lib/uploads";

interface AvatarUploaderProps {
  userId: string;
  initials: string;
  color: string;
  /** Currently-saved avatar URL, if any. */
  currentUrl?: string | null;
  /** Called with the new public URL after a successful R2 upload; persist it here. */
  onUploaded: (url: string) => void | Promise<void>;
  /** Set true while the parent is persisting the URL, to keep the control busy. */
  saving?: boolean;
  size?: "lg" | "xl";
  disabled?: boolean;
  /**
   * Custom upload function. Defaults to uploading a user avatar for `userId`; pass e.g.
   * `uploadOrgLogo` to reuse this control for other image types. Must return the public URL.
   */
  uploadFn?: (
    file: File,
    onProgress: (pct: number) => void,
    signal: AbortSignal,
  ) => Promise<string>;
  /** Noun used in the button labels, e.g. "photo" (default) or "logo". */
  noun?: string;
}

type Phase = "idle" | "uploading" | "error";

export function AvatarUploader({
  userId,
  initials,
  color,
  currentUrl,
  onUploaded,
  saving = false,
  size = "xl",
  disabled = false,
  uploadFn,
  noun = "photo",
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // Revoke the object URL for the local preview when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const busy = phase === "uploading" || saving;

  const start = async (file: File) => {
    lastFileRef.current = file;
    const invalid = validateImageFile(file);
    if (invalid) {
      setPhase("error");
      setError(invalid);
      return;
    }

    // Local preview immediately, so the user sees their pick before the round trip.
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPhase("uploading");
    setProgress(0);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const url = uploadFn
        ? await uploadFn(file, setProgress, controller.signal)
        : await uploadAvatar(userId, file, setProgress, controller.signal);
      await onUploaded(url);
      setPhase("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setPhase("idle");
        return;
      }
      setPhase("error");
      setError((err as Error).message || "Upload failed");
    } finally {
      abortRef.current = null;
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (file) void start(file);
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setProgress(0);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
  };

  const retry = () => {
    if (lastFileRef.current) void start(lastFileRef.current);
    else inputRef.current?.click();
  };

  const shownUrl = localPreview ?? currentUrl ?? null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar initials={initials} color={color} size={size} src={shownUrl} />
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-foreground/50 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={onPick}
          disabled={disabled || busy}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            <Camera className="h-3.5 w-3.5" />
            {currentUrl ? `Change ${noun}` : `Upload ${noun}`}
          </Button>
          {phase === "uploading" && (
            <Button variant="ghost" size="sm" onClick={cancel}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
          {phase === "error" && (
            <Button variant="ghost" size="sm" onClick={retry}>
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
        </div>

        {phase === "uploading" && (
          <div className="w-48 max-w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-[10.5px] text-muted-foreground">Uploading… {progress}%</div>
          </div>
        )}

        {phase === "error" && error && (
          <p className="text-[11.5px] text-rose-600 dark:text-rose-400">{error}</p>
        )}

        {phase === "idle" && !busy && (
          <p className={cn("text-[10.5px] text-muted-foreground")}>JPG, PNG, or WebP · up to 5MB</p>
        )}
      </div>
    </div>
  );
}
