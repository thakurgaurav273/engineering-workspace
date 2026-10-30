"use client";
import { useEffect, useRef } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "@/shared/lib/theme";
import type {
  TemplateFilter,
  TemplateIssue,
  VarSpec,
} from "@/applications/business/lib/business-document-templates";

export interface TemplateEditorApi {
  insert(text: string): void;
  goToLine(line: number): void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  issues: TemplateIssue[];
  onSave?: () => void;
  onRender?: () => void;
  variables: VarSpec[];
  filters: TemplateFilter[];
  readOnly?: boolean;
  wrap?: boolean;
  onReady?: (api: TemplateEditorApi) => void;
}

/** Loop alias the starters use for a list (`lines` → `line`, `taxes` → `tax`). */
function itemAlias(listKey: string): string {
  if (listKey.endsWith("ies")) return `${listKey.slice(0, -3)}y`;
  if (listKey.endsWith("xes")) return listKey.slice(0, -2);
  if (listKey.endsWith("s")) return listKey.slice(0, -1);
  return "item";
}

/** Every printable path in the variable tree, plus `alias.field` paths for list items. */
function variableCompletions(variables: VarSpec[]): Completion[] {
  const out: Completion[] = [];
  const walk = (specs: VarSpec[], prefix: string, loopHint?: string) => {
    for (const spec of specs) {
      const path = prefix ? `${prefix}.${spec.key}` : spec.key;
      out.push({
        label: path,
        type: spec.type === "object" || spec.type === "list" ? "namespace" : "variable",
        detail: loopHint ?? spec.type,
        info: spec.description ? `${spec.label} - ${spec.description}` : spec.label,
      });
      if (spec.type === "object" && spec.children) walk(spec.children, path, loopHint);
      if (spec.type === "list" && spec.children) {
        const alias = itemAlias(spec.key);
        walk(spec.children, alias, `in {% for ${alias} in ${path} %}`);
      }
    }
  };
  walk(variables, "");
  return out;
}

function liquidCompletions(variables: VarSpec[], filters: TemplateFilter[]) {
  const vars = variableCompletions(variables);
  const filterOptions: Completion[] = filters.map((f) => ({
    label: f.name,
    type: "function",
    detail: "formatter",
    info: `${f.description}\n${f.example}`,
  }));
  return (context: CompletionContext) => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    // After a pipe inside {{ … }} → formatter names.
    const filterMatch = before.match(/\{\{[^}]*\|\s*([\w]*)$/);
    if (filterMatch) {
      return {
        from: context.pos - filterMatch[1].length,
        options: filterOptions,
        validFor: /^\w*$/,
      };
    }
    // Inside {{ … }} or a {% if / for … in / elsif / unless %} tag → variable paths.
    const varMatch = before.match(
      /(?:\{\{-?\s*|\{%-?\s*(?:if|elsif|unless|for\s+\w+\s+in)\s+[^%]*?)([\w.]*)$/,
    );
    if (varMatch && !/\}\}/.test(before.slice(before.lastIndexOf("{{")))) {
      return { from: context.pos - varMatch[1].length, options: vars, validFor: /^[\w.]*$/ };
    }
    return null;
  };
}

const lightTheme = EditorView.theme({
  "&": { backgroundColor: "var(--color-card)", color: "var(--color-foreground)" },
  ".cm-gutters": {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-muted-foreground)",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--color-accent) 60%, transparent)",
  },
  ".cm-activeLineGutter": { backgroundColor: "var(--color-accent)" },
});

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12.5px" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.55",
  },
  "&.cm-focused": { outline: "none" },
});

/** CodeMirror 6 HTML editor for Liquid templates. Client-only: load it with next/dynamic. */
export default function TemplateCodeEditor({
  value,
  onChange,
  issues,
  onSave,
  onRender,
  variables,
  filters,
  readOnly = false,
  wrap = true,
  onReady,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const { isDark } = useTheme();
  const themeSlot = useRef(new Compartment());
  const readOnlySlot = useRef(new Compartment());
  const wrapSlot = useRef(new Compartment());
  const completionSlot = useRef(new Compartment());
  // Latest callbacks, so the extensions created once always call the current ones.
  const callbacks = useRef({ onChange, onSave, onRender });
  callbacks.current = { onChange, onSave, onRender };

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        lintGutter(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        search({ top: true }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        html(),
        completionSlot.current.of(
          autocompletion({ override: [liquidCompletions(variables, filters)] }),
        ),
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              callbacks.current.onSave?.();
              return true;
            },
          },
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              callbacks.current.onRender?.();
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        baseTheme,
        themeSlot.current.of(isDark ? oneDark : lightTheme),
        readOnlySlot.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        wrapSlot.current.of(wrap ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
        }),
      ],
    });
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    onReady?.({
      insert(text) {
        const { from, to } = editor.state.selection.main;
        editor.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
          scrollIntoView: true,
        });
        editor.focus();
      },
      goToLine(n) {
        const line = editor.state.doc.line(Math.min(Math.max(1, n), editor.state.doc.lines));
        editor.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
        editor.focus();
      },
    });
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once; later prop changes are applied through compartments below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (load, discard, rollback) replace the document.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: themeSlot.current.reconfigure(isDark ? oneDark : lightTheme),
    });
  }, [isDark]);

  useEffect(() => {
    view.current?.dispatch({
      effects: readOnlySlot.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    view.current?.dispatch({
      effects: wrapSlot.current.reconfigure(wrap ? EditorView.lineWrapping : []),
    });
  }, [wrap]);

  useEffect(() => {
    view.current?.dispatch({
      effects: completionSlot.current.reconfigure(
        autocompletion({ override: [liquidCompletions(variables, filters)] }),
      ),
    });
  }, [variables, filters]);

  // Issues with a line become gutter diagnostics.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const doc = editor.state.doc;
    const diagnostics: Diagnostic[] = issues
      .filter((i) => i.line && i.line <= doc.lines)
      .map((i) => {
        const line = doc.line(i.line!);
        return {
          from: line.from,
          to: line.to,
          severity: i.severity,
          message: i.message,
          source: i.code,
        };
      });
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [issues]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
