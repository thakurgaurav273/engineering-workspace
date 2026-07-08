"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Code, ImagePlus, Send, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Avatar } from "@grovyn/ui/primitives";
import { cn } from "@grovyn/utils";
import { avatarColor } from "@grovyn/utils";
import { sharedExtensions, PROSE_CLASS } from "@/applications/engineering/lib/editor-extensions";
import {
  createMentionExtension,
  extractMentionIds,
  type MentionItem,
  type MentionSuggestionState,
} from "@/applications/engineering/lib/mentions";
import { COMMENT_IMAGE_ALLOWED_MIME, COMMENT_IMAGE_ACCEPT } from "@/shared/lib/uploads";

export interface ComposerAttachment {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ComposerSubmit {
  body: string;
  mentionedUserIds: string[];
  attachments: ComposerAttachment[];
}

interface PendingAttachment {
  localId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  progress: number;
  url: string | null;
  controller: AbortController;
}

type UploadFn = (
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
) => Promise<string>;

function ToolbarButton({
  active,
  onClick,
  children,
  label,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-6.5 w-6.5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

let localIdSeq = 0;

export function RichCommentComposer({
  members,
  uploadFn,
  placeholder,
  submitLabel = "Send",
  onSubmit,
  isSubmitting,
  initialBody,
  initialAttachments,
  onCancel,
}: {
  members: MentionItem[];
  uploadFn: UploadFn;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (payload: ComposerSubmit) => void | Promise<void>;
  isSubmitting?: boolean;
  initialBody?: string;
  initialAttachments?: ComposerAttachment[];
  onCancel?: () => void;
}) {
  const [suggestion, setSuggestion] = useState<MentionSuggestionState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(() =>
    (initialAttachments ?? []).map((a, i) => ({
      localId: `init-${i}`,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      previewUrl: a.url,
      status: "done" as const,
      progress: 100,
      url: a.url,
      controller: new AbortController(),
    })),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs so the ProseMirror keymap (created once) always sees the latest values.
  const membersRef = useRef(members);
  membersRef.current = members;
  const suggestionRef = useRef<MentionSuggestionState | null>(null);
  const selectedIndexRef = useRef(0);
  selectedIndexRef.current = selectedIndex;
  const keyHandlerRef = useRef<((event: KeyboardEvent) => boolean) | null>(null);

  const setSuggestionState = useCallback((s: MentionSuggestionState | null) => {
    suggestionRef.current = s;
    setSuggestion(s);
    setSelectedIndex(0);
  }, []);

  // Stable arrow/enter handler for the mention popup.
  keyHandlerRef.current = (event: KeyboardEvent) => {
    const s = suggestionRef.current;
    if (!s || !s.items.length) return false;
    const n = s.items.length;
    if (event.key === "ArrowDown") {
      setSelectedIndex((i) => (i + 1) % n);
      return true;
    }
    if (event.key === "ArrowUp") {
      setSelectedIndex((i) => (i - 1 + n) % n);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const item = s.items[selectedIndexRef.current];
      if (item) s.command(item);
      return true;
    }
    return false;
  };

  const uploadFiles = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => COMMENT_IMAGE_ALLOWED_MIME.includes(f.type as never));
      const rejected = files.length - images.length;
      if (rejected > 0) toast.error("Only image files can be attached.");

      for (const file of images) {
        const localId = `att-${localIdSeq++}`;
        const controller = new AbortController();
        const pending: PendingAttachment = {
          localId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
          progress: 0,
          url: null,
          controller,
        };
        setAttachments((prev) => [...prev, pending]);

        uploadFn(
          file,
          (pct) =>
            setAttachments((prev) =>
              prev.map((a) => (a.localId === localId ? { ...a, progress: pct } : a)),
            ),
          controller.signal,
        )
          .then((url) =>
            setAttachments((prev) =>
              prev.map((a) => (a.localId === localId ? { ...a, status: "done", url, progress: 100 } : a)),
            ),
          )
          .catch((err: Error) => {
            if (err.name === "AbortError") return;
            toast.error(err.message || "Upload failed");
            setAttachments((prev) =>
              prev.map((a) => (a.localId === localId ? { ...a, status: "error" } : a)),
            );
          });
      }
    },
    [uploadFn],
  );

  const editor = useEditor({
    extensions: [
      ...sharedExtensions(placeholder ?? "Write a comment… use @ to mention"),
      createMentionExtension({
        getItems: (query) => {
          const q = query.toLowerCase();
          return membersRef.current
            .filter((m) => m.label.toLowerCase().includes(q))
            .slice(0, 8);
        },
        setState: setSuggestionState,
        keyHandlerRef,
      }),
    ],
    content: initialBody ?? "",
    editorProps: {
      attributes: { class: cn(PROSE_CLASS, "min-h-[64px] max-h-[280px] overflow-y-auto px-3 py-2") },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        uploadFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        uploadFiles(files);
        return true;
      },
    },
  });

  // Revoke locally-created object URLs on unmount (seeded initial attachments use http URLs).
  useEffect(() => {
    return () =>
      attachments.forEach((a) => {
        if (a.previewUrl.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeAttachment = (localId: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.localId === localId);
      if (target) {
        target.controller.abort();
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.localId !== localId);
    });
  };

  const uploading = attachments.some((a) => a.status === "uploading");
  const doneAttachments = attachments.filter((a) => a.status === "done" && a.url);

  const submit = async () => {
    if (!editor) return;
    const body = editor.storage.markdown.getMarkdown().trim();
    if ((!body && !doneAttachments.length) || uploading || isSubmitting) return;

    await onSubmit({
      body,
      mentionedUserIds: extractMentionIds(body),
      attachments: doneAttachments.map((a) => ({
        url: a.url as string,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    });

    editor.commands.clearContent(true);
    attachments.forEach((a) => {
      if (a.previewUrl.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);
  };

  const canSubmit =
    !!editor &&
    !uploading &&
    !isSubmitting &&
    (editor.storage.markdown.getMarkdown().trim().length > 0 || doneAttachments.length > 0);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-border bg-background focus-within:border-foreground/40">
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="Attach image" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept={COMMENT_IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <EditorContent editor={editor} />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {attachments.map((a) => (
            <div
              key={a.localId}
              className="group relative h-16 w-16 overflow-hidden rounded-md border border-border bg-surface"
            >
              <img src={a.previewUrl} alt={a.fileName} className="h-full w-full object-cover" />
              {a.status === "uploading" && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {a.status === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-rose-600/60 text-[9px] font-medium text-white">
                  Failed
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.localId)}
                className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          Type <span className="font-medium text-foreground">@</span> to mention · drag or paste
          images
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} disabled={!canSubmit}>
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {submitLabel}
          </Button>
        </div>
      </div>

      {suggestion && suggestion.rect && suggestion.items.length > 0 && (
        <MentionPopup
          state={suggestion}
          selectedIndex={selectedIndex}
          onHover={setSelectedIndex}
        />
      )}
    </div>
  );
}

function MentionPopup({
  state,
  selectedIndex,
  onHover,
}: {
  state: MentionSuggestionState;
  selectedIndex: number;
  onHover: (i: number) => void;
}) {
  const rect = state.rect;
  if (!rect) return null;
  return (
    <div
      className="fixed z-50 max-h-60 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ left: rect.left, top: rect.bottom + 6 }}
    >
      {state.items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            state.command(item);
          }}
          onMouseEnter={() => onHover(i)}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]",
            i === selectedIndex ? "bg-accent" : "hover:bg-accent/50",
          )}
        >
          <Avatar
            initials={initials(item.label)}
            color={avatarColor(item.id)}
            src={item.avatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{item.label}</div>
            {item.sublabel && (
              <div className="truncate text-[11px] text-muted-foreground">{item.sublabel}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
