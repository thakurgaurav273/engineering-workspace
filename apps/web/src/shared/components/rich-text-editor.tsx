"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo2,
  Redo2,
  Pilcrow,
} from "lucide-react";

/**
 * Thin TipTap wrapper - a controlled rich-text editor emitting HTML. Used for editable offer
 * letter clauses and their per-role templates. Kept generic (no business logic) so it can be
 * reused elsewhere. `immediatelyRender: false` avoids Next SSR hydration mismatches.
 */
export function RichTextEditor({
  value,
  onChange,
  editable = true,
  minHeight = 320,
}: {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "ol-prose focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. loading a role template) without clobbering typing.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className="rounded-md border border-border bg-surface"
        style={{ minHeight: minHeight + 44 }}
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface">
      {editable ? <Toolbar editor={editor} /> : null}
      <div className="max-h-[520px] overflow-y-auto px-3 py-2.5 text-[13px] leading-relaxed">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({
    on,
    active,
    label,
    children,
  }: {
    on: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={on}
      className={`grid h-7 w-7 place-items-center rounded transition-colors ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1">
      <Btn label="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn label="Heading" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>
        <Heading2 className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Paragraph" on={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")}>
        <Pilcrow className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-1 h-4 w-px bg-border" />
      <Btn label="Undo" on={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Redo" on={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-3.5 w-3.5" />
      </Btn>
    </div>
  );
}
