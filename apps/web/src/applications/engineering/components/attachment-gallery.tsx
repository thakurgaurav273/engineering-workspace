"use client";
import { useState } from "react";
import { X } from "lucide-react";

export interface DisplayAttachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
}

/** Renders image attachments as thumbnails with a click-to-zoom lightbox. */
export function AttachmentGallery({ attachments }: { attachments: DisplayAttachment[] }) {
  const [active, setActive] = useState<DisplayAttachment | null>(null);
  const images = attachments.filter((a) => a.mimeType.startsWith("image/"));
  if (!images.length) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setActive(a)}
            className="h-20 w-20 overflow-hidden rounded-md border border-border bg-surface hover:border-foreground/30"
            title={a.fileName}
          >
            <img
              src={a.url}
              alt={a.fileName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      {active && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6"
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            onClick={() => setActive(null)}
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={active.url}
            alt={active.fileName}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
