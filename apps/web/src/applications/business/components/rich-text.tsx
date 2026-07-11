import { useEffect, useRef } from "react";
import { Bold, Italic, List } from "lucide-react";

// A minimal rich-text field: contentEditable + a tiny toolbar. Emits plain HTML.
// Uncontrolled (initial HTML set once) so typing never resets the caret.
// Shared by the proposal and quotation editors.
export function RichText({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) ref.current.innerHTML = initialHtml;
    // Initialise once per mounted section (keyed remount handles switching rows).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command: string) => {
    ref.current?.focus();
    document.execCommand(command, false);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        <ToolbarButton title="Bold" onClick={() => exec("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => exec("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Bulleted list" onClick={() => exec("insertUnorderedList")}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="prose-sm min-h-[120px] px-3 py-2 text-[13px] leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}

export function ToolbarButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
