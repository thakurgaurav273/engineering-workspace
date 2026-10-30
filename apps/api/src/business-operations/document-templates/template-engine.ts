import { Context, Liquid } from 'liquidjs';

/** `this` inside a filter handler (liquidjs doesn't export the type by name). */
type FilterThis = { context: Context };
import type { VarSpec } from './template-variables';

/**
 * The Liquid sandbox behind business-document templates. Templates are org-authored HTML, so:
 * - every `{{ output }}` is HTML-escaped unless piped through `| html` (rich text we produced)
 *   or a formatter that returns markup (`| multiline`);
 * - there is no file system: `include` / `render` / `layout` fail;
 * - parse and render are time/size-limited so a runaway loop can't stall the API.
 * The renderer (PdfService) additionally runs Chromium with JavaScript off and only lets
 * images/fonts load from allowed hosts.
 */

export const MAX_TEMPLATE_LENGTH = 500_000;

export interface TemplateIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** 1-based line in the template source, when known. */
  line?: number;
}

const noFileSystem = {
  exists: async () => false,
  existsSync: () => false,
  readFile: async () => {
    throw new Error('Templates cannot include other files');
  },
  readFileSync: () => {
    throw new Error('Templates cannot include other files');
  },
  resolve: (_root: string, file: string) => file,
};

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMoney(amount: unknown, currency = 'INR'): string {
  const value = toNumber(amount);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `DD MMM YYYY`-style formatting: tokens DD, D, MMMM, MMM, MM, YYYY, YY. */
export function formatDate(value: unknown, pattern = 'DD MMM YYYY'): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  return pattern.replace(/YYYY|YY|MMMM|MMM|MM|DD|D/g, (token) => {
    switch (token) {
      case 'YYYY': return String(y);
      case 'YY': return String(y).slice(-2);
      case 'MMMM': return MONTHS_LONG[m];
      case 'MMM': return MONTHS[m];
      case 'MM': return String(m + 1).padStart(2, '0');
      case 'DD': return String(d).padStart(2, '0');
      default: return String(d);
    }
  });
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** Indian grouping (crore / lakh / thousand) for INR, international (billion / million) otherwise. */
function integerInWords(n: number, indian: boolean): string {
  if (n === 0) return 'Zero';
  const scales: [number, string][] = indian
    ? [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']]
    : [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']];
  const parts: string[] = [];
  for (const [size, name] of scales) {
    if (n >= size) {
      parts.push(`${integerInWords(Math.floor(n / size), indian)} ${name}`);
      n %= size;
    }
  }
  if (n > 0) parts.push(below1000(n));
  return parts.join(' ');
}

const CURRENCY_WORDS: Record<string, [string, string]> = {
  INR: ['Rupees', 'Paise'],
  USD: ['Dollars', 'Cents'],
  EUR: ['Euros', 'Cents'],
  GBP: ['Pounds', 'Pence'],
  AED: ['Dirhams', 'Fils'],
};

export function amountInWords(amount: unknown, currency = 'INR'): string {
  const value = Math.abs(toNumber(amount));
  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 100);
  const [major, minor] = CURRENCY_WORDS[currency] ?? [currency, 'Cents'];
  const indian = currency === 'INR';
  let words = `${major} ${integerInWords(whole, indian)}`;
  if (fraction) words += ` and ${integerInWords(fraction, indian)} ${minor}`;
  return `${words} Only`;
}

/** Strips active content from rich text before it is handed to templates as `| html`. */
export function stripActiveContent(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|iframe|object|embed|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

function createEngine(): Liquid {
  const engine = new Liquid({
    outputEscape: 'escape',
    strictFilters: true,
    ownPropertyOnly: true,
    fs: noFileSystem,
    relativeReference: false,
    dynamicPartials: false,
    parseLimit: MAX_TEMPLATE_LENGTH * 2,
    renderLimit: 3000,
    memoryLimit: 50_000_000,
  });

  // Filters see the render context, so money/amount_in_words default to the document currency.
  const docCurrency = (ctx: Context) => String(ctx.getSync(['document', 'currency']) || 'INR');

  engine.registerFilter('money', function (this: FilterThis, value: unknown, currency?: string) {
    return formatMoney(value, currency || docCurrency(this.context));
  });
  engine.registerFilter('amount_in_words', function (this: FilterThis, value: unknown, currency?: string) {
    return amountInWords(value, currency || docCurrency(this.context));
  });
  engine.registerFilter('number', (value: unknown, decimals = 2) =>
    toNumber(value).toLocaleString('en-IN', {
      minimumFractionDigits: Number(decimals),
      maximumFractionDigits: Number(decimals),
    }),
  );
  engine.registerFilter('percent', (value: unknown, decimals = 0) => `${toNumber(value).toFixed(Number(decimals))}%`);
  engine.registerFilter('date_format', (value: unknown, pattern?: string) => formatDate(value, pattern));
  // Markup-returning filters skip the automatic escaping.
  engine.registerFilter('multiline', {
    handler: (value: unknown) => escapeHtml(value).replace(/\r?\n/g, '<br/>'),
    raw: true,
  });
  engine.registerFilter('html', { handler: (value: unknown) => stripActiveContent(String(value ?? '')), raw: true });
  return engine;
}

export const templateEngine = createEngine();

/** Names offered by the editor's formatter reference (built-ins included). */
export const TEMPLATE_FILTERS = [
  { name: 'money', example: '{{ invoice.grand_total | money }}', description: 'Currency, in the document currency unless one is given: money: "USD".' },
  { name: 'amount_in_words', example: '{{ invoice.grand_total | amount_in_words }}', description: 'Rupees Four Lakh Thirteen Thousand Only.' },
  { name: 'number', example: '{{ line.quantity | number: 0 }}', description: 'Indian digit grouping with fixed decimals (default 2).' },
  { name: 'percent', example: '{{ tax.rate | percent }}', description: '18 → 18%.' },
  { name: 'date_format', example: '{{ invoice.issue_date | date_format: "DD MMMM YYYY" }}', description: 'Tokens DD D MMMM MMM MM YYYY YY. Default DD MMM YYYY.' },
  { name: 'multiline', example: '{{ invoice.notes | multiline }}', description: 'Keeps line breaks of plain text.' },
  { name: 'html', example: '{{ section.content | html }}', description: 'Outputs rich text (from the editor) as formatted HTML.' },
  { name: 'default', example: '{{ client.email | default: "-" }}', description: 'Fallback when empty.' },
  { name: 'upcase', example: '{{ document.title | upcase }}', description: 'UPPER CASE (also downcase, capitalize).' },
];

function lineOf(error: unknown, source: string): number | undefined {
  const message = String((error as Error)?.message ?? '');
  const fromMessage = message.match(/line:(\d+)/);
  if (fromMessage) return Number(fromMessage[1]);
  const token = (error as { token?: { begin?: number } })?.token;
  if (token?.begin !== undefined) return source.slice(0, token.begin).split('\n').length;
  return undefined;
}

function cleanMessage(error: unknown): string {
  return String((error as Error)?.message ?? error)
    .replace(/,?\s*file:[^,]*/g, '')
    .replace(/,?\s*line:\d+,\s*col:\d+/g, '')
    .split('\n')[0]
    .trim();
}

/** Static checks that don't need data: size, Liquid syntax, forbidden HTML, unknown variables. */
export async function lintTemplate(source: string, variables: VarSpec[]): Promise<TemplateIssue[]> {
  const issues: TemplateIssue[] = [];
  if (source.length > MAX_TEMPLATE_LENGTH) {
    issues.push({ severity: 'error', code: 'too_long', message: `Template is longer than ${MAX_TEMPLATE_LENGTH} characters` });
    return issues;
  }

  const lineAt = (index: number) => source.slice(0, index).split('\n').length;
  const forbidden: [RegExp, string, string][] = [
    [/<script\b/gi, 'script', 'Scripts are not allowed - PDFs render with JavaScript off'],
    [/<(iframe|object|embed)\b/gi, 'embed', 'Embedded frames/objects are not allowed'],
    [/\son[a-z]+\s*=/gi, 'event_handler', 'Inline event handlers (onclick=…) are not allowed'],
    [/javascript:/gi, 'javascript_url', 'javascript: links are not allowed'],
    [/\{%-?\s*(include|render|layout)\b/g, 'include', 'Templates cannot include other files'],
  ];
  for (const [pattern, code, message] of forbidden) {
    for (const match of source.matchAll(pattern)) {
      issues.push({ severity: 'error', code, message, line: lineAt(match.index ?? 0) });
    }
  }

  let parsed: ReturnType<Liquid['parse']>;
  try {
    parsed = templateEngine.parse(source);
  } catch (error) {
    issues.push({ severity: 'error', code: 'syntax', message: cleanMessage(error), line: lineOf(error, source) });
    return issues;
  }

  // Unknown top-level variables are almost always typos ({{ invoce.number }}).
  try {
    const known = new Set(variables.map((v) => v.key));
    const paths = await templateEngine.globalVariableSegments(parsed);
    const reported = new Set<string>();
    for (const segments of paths) {
      const root = String(segments[0]);
      if (known.has(root) || reported.has(root)) continue;
      reported.add(root);
      const at = source.search(new RegExp(`\\b${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
      issues.push({
        severity: 'warning',
        code: 'unknown_variable',
        message: `Unknown variable "${root}" - it will print nothing`,
        line: at >= 0 ? lineAt(at) : undefined,
      });
    }
  } catch {
    // Variable analysis is best-effort; rendering below is the authoritative check.
  }
  return issues;
}

/** Render with data; throws a TemplateRenderError carrying an issue on failure. */
export async function renderTemplate(source: string, data: Record<string, unknown>): Promise<string> {
  try {
    return await templateEngine.parseAndRender(source, data);
  } catch (error) {
    throw new TemplateRenderError({
      severity: 'error',
      code: 'render',
      message: cleanMessage(error),
      line: lineOf(error, source),
    });
  }
}

export class TemplateRenderError extends Error {
  constructor(readonly issue: TemplateIssue) {
    super(issue.message);
  }
}

/** Optional page-number footer, declared in the template: <meta name="page-numbers" content="bottom-right">. */
export function pageNumberPosition(html: string): 'left' | 'center' | 'right' | null {
  const match = html.match(/<meta\s+name=["']page-numbers["']\s+content=["']bottom-(left|center|right)["']/i);
  return (match?.[1] as 'left' | 'center' | 'right' | undefined) ?? null;
}
