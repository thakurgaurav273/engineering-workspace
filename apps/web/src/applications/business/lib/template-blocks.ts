import type { VarSpec } from "@/applications/business/lib/business-document-templates";

/**
 * Ready-made layout blocks for the template code editor - the block palette of a visual
 * builder, but each block is emitted as plain HTML + Liquid at the cursor, so the result
 * stays a normal template (editable, diffable, rendered by the same engine). Blocks that
 * print data are generated from the document type's variable tree, so a "Table" over
 * `lines` gets a column per line field with the right formatting and alignment.
 *
 * Styles are inline on purpose: a block must look right in any template, including a blank
 * one with no stylesheet.
 */

export type BlockKind =
  | "heading"
  | "text"
  | "fields"
  | "table"
  | "repeat"
  | "show_if"
  | "columns"
  | "image"
  | "divider"
  | "spacer"
  | "page_break";

export interface BlockDef {
  kind: BlockKind;
  label: string;
  hint: string;
  /** What the block is built from: an object's fields, a list's rows, or any value. */
  source?: "object" | "list" | "any";
}

export const BLOCKS: BlockDef[] = [
  { kind: "heading", label: "Heading", hint: "A title in large type" },
  { kind: "text", label: "Text", hint: "A paragraph - type over it, insert variables" },
  { kind: "fields", label: "Fields", hint: "Label and value pairs in a grid", source: "object" },
  { kind: "table", label: "Table", hint: "One row per item of a list", source: "list" },
  { kind: "repeat", label: "Repeat", hint: "A block repeated for each item", source: "list" },
  { kind: "show_if", label: "Show if", hint: "Only print when a value is present", source: "any" },
  { kind: "columns", label: "Two columns", hint: "Side-by-side areas" },
  { kind: "image", label: "Logo", hint: "Your company logo, when set" },
  { kind: "divider", label: "Divider", hint: "A horizontal rule" },
  { kind: "spacer", label: "Spacer", hint: "Empty vertical space" },
  { kind: "page_break", label: "Page break", hint: "Start a new page in the PDF" },
];

export interface SourceOption {
  /** Liquid path, e.g. "client" or "invoice.bank". */
  path: string;
  label: string;
  spec: VarSpec;
}

/** Variables a block can be built from, flattened with their full paths. */
export function sourceOptions(vars: VarSpec[], kind: BlockDef["source"]): SourceOption[] {
  const out: SourceOption[] = [];
  const walk = (specs: VarSpec[], prefix: string, labelPrefix: string) => {
    for (const spec of specs) {
      const path = prefix ? `${prefix}.${spec.key}` : spec.key;
      const label = labelPrefix ? `${labelPrefix} › ${spec.label}` : spec.label;
      const isObject = spec.type === "object";
      if (
        (kind === "object" && isObject && printable(spec).length > 0) ||
        (kind === "list" && spec.type === "list") ||
        (kind === "any" && !isObject && spec.type !== "list")
      ) {
        out.push({ path, label, spec });
      }
      // Lists are looped, not dotted into, so only objects are walked.
      if (isObject && spec.children) walk(spec.children, path, label);
    }
  };
  walk(vars, "", "");
  return out;
}

/** Fields of an object/list item that print as a value (not nested objects or lists). */
function printable(spec: VarSpec): VarSpec[] {
  return (spec.children ?? []).filter(
    (c) => c.type !== "object" && c.type !== "list" && c.type !== "boolean",
  );
}

/** `lines` → `line`, `taxes` → `tax`, `entries` → `entry`. */
export function itemAlias(listKey: string): string {
  if (listKey.endsWith("ies")) return `${listKey.slice(0, -3)}y`;
  if (listKey.endsWith("xes")) return listKey.slice(0, -2);
  if (listKey.endsWith("s") && listKey.length > 1) return listKey.slice(0, -1);
  return "item";
}

/** A Liquid output tag with the formatting its type needs. */
export function output(path: string, spec: VarSpec): string {
  switch (spec.type) {
    case "money":
      return `{{ ${path} | money }}`;
    case "date":
      return `{{ ${path} | date_format }}`;
    case "html":
      return `{{ ${path} | html }}`;
    case "number":
      return spec.key === "index" ? `{{ ${path} }}` : `{{ ${path} | number: 0 }}`;
    case "image":
      return `<img src="{{ ${path} }}" alt="" style="max-height: 48px;">`;
    default:
      return /notes|terms|address/i.test(spec.key) ? `{{ ${path} | multiline }}` : `{{ ${path} }}`;
  }
}

const isNumeric = (spec: VarSpec) => spec.type === "money" || spec.type === "number";

const CELL = "padding: 6px 8px; border-bottom: 1px solid #e5e7eb;";

function fieldsBlock(src: SourceOption): string {
  const items = printable(src.spec)
    .filter((c) => c.type !== "html")
    .map((c) => {
      const path = `${src.path}.${c.key}`;
      return [
        `  {% if ${path} %}`,
        `  <div>`,
        `    <div style="font-size: 11px; color: #6b7280;">${c.label}</div>`,
        `    <div>${output(path, c)}</div>`,
        `  </div>`,
        `  {% endif %}`,
      ].join("\n");
    });
  return [
    `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 12px 0;">`,
    ...items,
    `</div>`,
  ].join("\n");
}

function tableBlock(src: SourceOption): string {
  const alias = itemAlias(src.spec.key);
  const cols = printable(src.spec).filter((c) => c.type !== "html" && c.type !== "image");
  const align = (c: VarSpec) => (isNumeric(c) ? "right" : "left");
  const head = cols
    .map(
      (c) =>
        `      <th style="${CELL} text-align: ${align(c)}; font-size: 11px; color: #6b7280;">${c.label}</th>`,
    )
    .join("\n");
  const cells = cols
    .map(
      (c) => `      <td style="${CELL} text-align: ${align(c)};">${output(`${alias}.${c.key}`, c)}</td>`,
    )
    .join("\n");
  return [
    `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px;">`,
    `  <thead>`,
    `    <tr>`,
    head,
    `    </tr>`,
    `  </thead>`,
    `  <tbody>`,
    `    {% for ${alias} in ${src.path} %}`,
    `    <tr style="page-break-inside: avoid;">`,
    cells,
    `    </tr>`,
    `    {% else %}`,
    `    <tr><td colspan="${Math.max(cols.length, 1)}" style="${CELL} color: #6b7280;">Nothing to show</td></tr>`,
    `    {% endfor %}`,
    `  </tbody>`,
    `</table>`,
  ].join("\n");
}

function repeatBlock(src: SourceOption): string {
  const alias = itemAlias(src.spec.key);
  const fields = printable(src.spec);
  const title = fields.find((c) => c.key === "title" || c.key === "name");
  const rest = fields.filter((c) => c !== title);
  return [
    `{% for ${alias} in ${src.path} %}`,
    `<section style="margin: 16px 0; page-break-inside: avoid;">`,
    ...(title ? [`  <h3 style="margin: 0 0 6px;">${output(`${alias}.${title.key}`, title)}</h3>`] : []),
    ...rest.map((c) => `  <div>${output(`${alias}.${c.key}`, c)}</div>`),
    `</section>`,
    `{% endfor %}`,
  ].join("\n");
}

function showIfBlock(src: SourceOption): string {
  return [
    `{% if ${src.path} %}`,
    `<p><strong>${src.spec.label}:</strong> ${output(src.path, src.spec)}</p>`,
    `{% endif %}`,
  ].join("\n");
}

/** The HTML + Liquid for a block. `source` is required for blocks with a `source` kind. */
export function blockSnippet(kind: BlockKind, source?: SourceOption): string {
  switch (kind) {
    case "heading":
      return `<h2 style="margin: 16px 0 8px;">Heading</h2>`;
    case "text":
      return `<p>Write text here. Insert data with {{ document.number }}.</p>`;
    case "fields":
      return source ? fieldsBlock(source) : "";
    case "table":
      return source ? tableBlock(source) : "";
    case "repeat":
      return source ? repeatBlock(source) : "";
    case "show_if":
      return source ? showIfBlock(source) : "";
    case "columns":
      return [
        `<div style="display: flex; gap: 24px; margin: 12px 0;">`,
        `  <div style="flex: 1;">`,
        `    <p>Left column</p>`,
        `  </div>`,
        `  <div style="flex: 1;">`,
        `    <p>Right column</p>`,
        `  </div>`,
        `</div>`,
      ].join("\n");
    case "image":
      return [
        `{% if company.logo_url %}`,
        `<img src="{{ company.logo_url }}" alt="{{ company.name }}" style="max-height: 56px;">`,
        `{% endif %}`,
      ].join("\n");
    case "divider":
      return `<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0;">`;
    case "spacer":
      return `<div style="height: 24px;"></div>`;
    case "page_break":
      return `<div style="page-break-before: always;"></div>`;
  }
}
