import { TEMPLATE_VARIABLES, TemplatedType, VarSpec, sampleContext } from './template-variables';

/**
 * Stress-test data for the template editor's preview. A template that looks fine with the
 * tidy sample can still break on real records: a client with no GSTIN, a 200-character
 * address, an invoice with 60 lines. Each scenario reshapes the sample context by walking
 * the type's variable tree, so it stays in step with what templates can actually print.
 */
export const PREVIEW_SCENARIOS = ['sample', 'empty_optional', 'long_text', 'large_tables'] as const;
export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number];

/** Never blanked or stretched: without these the page isn't a recognisable document. */
const KEEP = new Set(['document.title', 'document.number', 'document.date', 'document.currency', 'document.status']);
/** The main line list keeps one row when emptied; a document never has zero lines. */
const PRIMARY_LISTS = new Set(['lines']);
/** Lists that stay their real size in "large tables" (a document never has 8 tax rates). */
const FIXED_LISTS = new Set(['taxes']);
const LARGE_ROWS = 60;
const LARGE_OTHER = 8;
const FILLER =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

type Data = Record<string, unknown>;

function longText(value: string): string {
  if (!value) return FILLER;
  let out = value;
  while (out.length < 220) out = `${out} ${FILLER}`;
  return out.slice(0, 240);
}

function longHtml(value: string): string {
  const para = `<p>${FILLER} ${FILLER}</p>`;
  return `${value}${para.repeat(6)}`;
}

function reshape(specs: VarSpec[], data: Data, scenario: PreviewScenario, path: string): Data {
  const out: Data = { ...data };
  for (const spec of specs) {
    const key = `${path}${spec.key}`;
    const value = data[spec.key];
    if (KEEP.has(key)) continue;
    switch (spec.type) {
      case 'text':
      case 'image':
        if (typeof value !== 'string' && value != null) break;
        if (scenario === 'empty_optional') out[spec.key] = '';
        else if (scenario === 'long_text' && spec.type === 'text') out[spec.key] = longText(value ?? '');
        break;
      case 'html':
        if (typeof value !== 'string' && value != null) break;
        if (scenario === 'empty_optional') out[spec.key] = '';
        else if (scenario === 'long_text') out[spec.key] = longHtml(value ?? '');
        break;
      case 'object':
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          out[spec.key] = reshape(spec.children ?? [], value as Data, scenario, `${key}.`);
        }
        break;
      case 'list': {
        if (!Array.isArray(value)) break;
        const items = value.map((item) =>
          item && typeof item === 'object' ? reshape(spec.children ?? [], item as Data, scenario, `${key}[].`) : item,
        );
        if (scenario === 'empty_optional') {
          out[spec.key] = PRIMARY_LISTS.has(key) ? items.slice(0, 1) : [];
        } else if (scenario === 'large_tables' && items.length > 0 && !FIXED_LISTS.has(key)) {
          const target = PRIMARY_LISTS.has(key) ? LARGE_ROWS : Math.max(items.length, LARGE_OTHER);
          out[spec.key] = Array.from({ length: target }, (_, i) => withIndex(items[i % items.length], i));
        } else {
          out[spec.key] = items;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Repeated rows get their own index/serial so `forloop`-free templates still number them. */
function withIndex(item: unknown, i: number): unknown {
  if (!item || typeof item !== 'object') return item;
  const row = { ...(item as Data) };
  if (typeof row.index === 'number') row.index = i + 1;
  if (typeof row.serial === 'number') row.serial = i + 1;
  return row;
}

export function scenarioContext(type: TemplatedType, scenario: PreviewScenario = 'sample'): Data {
  const base = sampleContext(type);
  if (scenario === 'sample') return base;
  return reshape(TEMPLATE_VARIABLES[type], base, scenario, '');
}
