import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { MENTION_HREF_PREFIX } from "./editor-extensions";

export interface MentionItem {
  id: string;
  label: string;
  avatarUrl?: string | null;
  sublabel?: string | null;
}

/** Controlled-suggestion state the composer renders into a popup. */
export interface MentionSuggestionState {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  /** Live getter for the caret rect so the popup can follow it on scroll/resize. */
  getRect: () => DOMRect | null;
}

export interface MentionHandlers {
  getItems: (query: string) => MentionItem[];
  setState: (state: MentionSuggestionState | null) => void;
  // Set by the composer's popup so the ProseMirror keymap can drive selection.
  keyHandlerRef: { current: ((event: KeyboardEvent) => boolean) | null };
}

/** Extracts the mentioned user ids from a serialized body (matches the backend regex). */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  for (const match of body.matchAll(/\(mention:([a-zA-Z0-9_-]+)\)/g)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

/**
 * Builds a Mention extension whose suggestion popup is driven by the composer (via
 * `handlers`), and which serializes to a markdown link `[@Name](mention:<id>)` so it
 * round-trips through tiptap-markdown and is parseable server-side.
 */
export function createMentionExtension(handlers: MentionHandlers) {
  return Mention.extend({
    addStorage() {
      return {
        ...this.parent?.(),
        markdown: {
          serialize(
            state: { write: (s: string) => void },
            node: { attrs: { id: string; label?: string } },
          ) {
            const label = String(node.attrs.label ?? node.attrs.id).replace(/[[\]]/g, "");
            state.write(`[@${label}](${MENTION_HREF_PREFIX}${node.attrs.id})`);
          },
          parse: {},
        },
      };
    },
  }).configure({
    HTMLAttributes: { class: "mention", "data-mention": "true" },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      char: "@",
      items: ({ query }: { query: string }) => handlers.getItems(query),
      render: () => {
        const toState = (props: SuggestionProps): MentionSuggestionState => ({
          items: props.items as MentionItem[],
          command: (item) => props.command({ id: item.id, label: item.label } as never),
          getRect: () => props.clientRect?.() ?? null,
        });
        return {
          onStart: (props: SuggestionProps) => handlers.setState(toState(props)),
          onUpdate: (props: SuggestionProps) => handlers.setState(toState(props)),
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === "Escape") {
              handlers.setState(null);
              return true;
            }
            return handlers.keyHandlerRef.current?.(props.event) ?? false;
          },
          onExit: () => handlers.setState(null),
        };
      },
    },
  });
}
