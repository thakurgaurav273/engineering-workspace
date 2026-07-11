import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code, Quote } from "lucide-react";
import { cn } from "@grovyn/utils";

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

function ToolbarButton({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      // Without this, the button steals DOM focus on mousedown before onClick fires,
      // collapsing the editor's selection - so the toggle would apply in the wrong place.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-6.5 w-6.5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Optional details…" }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "min-h-[160px] max-h-[420px] overflow-y-auto text-[13px] leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-info [&_a]:underline [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono-num [&_code]:text-[12px] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
  });

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
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
}
