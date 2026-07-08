import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";

export const MENTION_HREF_PREFIX = "mention:";

/**
 * Link extension that also renders our @mention links (href `mention:<userId>`) as styled
 * chips. New mentions typed in the composer are atomic Mention nodes; previously-saved
 * mentions re-hydrate from markdown as links — this makes both look identical (class
 * `mention`) and exposes the user id via `data-mention-id` for click-through routing.
 */
export const MentionLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === "string" ? HTMLAttributes.href : "";
    const isMention = href.startsWith(MENTION_HREF_PREFIX);
    const extra = isMention
      ? { class: "mention", "data-mention-id": href.slice(MENTION_HREF_PREFIX.length) }
      : {};
    return ["a", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, extra), 0];
  },
}).configure({ openOnClick: false, autolink: true });

/** Base extension set shared by the comment composer and the read-only renderer. */
export function sharedExtensions(placeholder?: string) {
  return [
    StarterKit,
    MentionLink,
    Placeholder.configure({ placeholder: placeholder ?? "Write a comment…" }),
    Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
  ];
}

/** Class list applied to rendered rich-text bodies (shared by composer + read-only view). */
export const PROSE_CLASS =
  "text-[13px] leading-relaxed outline-none " +
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:text-info [&_a]:underline " +
  "[&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono-num [&_code]:text-[12px] " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground " +
  // Mention chips (both the composer's Mention node and re-hydrated mention links).
  "[&_.mention]:rounded [&_.mention]:bg-info/10 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:font-medium [&_.mention]:text-info [&_.mention]:no-underline [&_.mention]:cursor-pointer";
