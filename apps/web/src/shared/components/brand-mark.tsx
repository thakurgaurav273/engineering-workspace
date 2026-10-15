import { useEffect, useState } from "react";
import { cn } from "@grovyn/utils";

function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Square logo for the platform or an organization. Falls back to a monochrome monogram of `name` (matching the primary buttons) when there's no image or it fails to load. */
export function BrandMark({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);

  // Retry the image when the source changes (e.g. after a new org logo upload).
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("h-8 w-8 shrink-0 rounded-md object-contain", className)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      // Colors last so a caller's background (meant for the image tile) can't wash them out.
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-md text-[12px] font-semibold",
        className,
        "bg-foreground text-background",
      )}
    >
      {monogram(name)}
    </div>
  );
}
