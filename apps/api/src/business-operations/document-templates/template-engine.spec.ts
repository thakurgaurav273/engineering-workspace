import {
  amountInWords,
  formatDate,
  lintTemplate,
  pageNumberPosition,
  renderTemplate,
  stripActiveContent,
} from './template-engine';
import { STARTER_TEMPLATES } from './starter-templates';
import { TEMPLATE_VARIABLES, sampleContext } from './template-variables';

describe('template engine', () => {
  it.each(STARTER_TEMPLATES.map((s) => [s.key, s] as const))('starter %s lints clean and renders', async (_key, starter) => {
    const issues = await lintTemplate(starter.html, TEMPLATE_VARIABLES[starter.documentType]);
    expect(issues).toEqual([]);
    const html = await renderTemplate(starter.html, sampleContext(starter.documentType));
    expect(html).toContain('Nimbus Labs');
    expect(html).not.toContain('{{');
    expect(html).not.toContain('{%');
  });

  it('renders invoice money, taxes and amount in words', async () => {
    const html = await renderTemplate(STARTER_TEMPLATES[0].html, sampleContext('INVOICE'));
    expect(html).toContain('CGST (9%)');
    expect(html).toContain('₹4,84,980.00');
    expect(html).toContain('Rupees Four Lakh Eighty Four Thousand Nine Hundred Eighty Only');
  });

  it('escapes output but keeps | html and | multiline markup', async () => {
    const out = await renderTemplate('{{ a }}|{{ b | html }}|{{ c | multiline }}', {
      a: '<b>x</b>',
      b: '<b>y</b><script>alert(1)</script><img src=x onerror="alert(1)">',
      c: 'one\n<two>',
    });
    expect(out).toBe('&lt;b&gt;x&lt;/b&gt;|<b>y</b><img src=x>|one<br/>&lt;two&gt;');
  });

  it('reports syntax errors with a line number', async () => {
    const issues = await lintTemplate('<p>\n{% if x %}\n</p>', []);
    expect(issues[0]).toEqual(expect.objectContaining({ severity: 'error', code: 'syntax' }));
    expect(issues[0].line).toBeGreaterThanOrEqual(2);
  });

  it('rejects scripts, handlers and includes', async () => {
    const issues = await lintTemplate('<script></script>\n<a onclick="x">\n{% include "x" %}', []);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['script', 'event_handler', 'include']));
  });

  it('warns about unknown variables', async () => {
    const issues = await lintTemplate('{{ invoce.number }}', TEMPLATE_VARIABLES.INVOICE);
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'unknown_variable', line: 1 })]);
  });

  it('fails unknown filters at render time', async () => {
    await expect(renderTemplate('{{ 1 | nope }}', {})).rejects.toThrow(/nope/);
  });

  it('formats dates and words', () => {
    expect(formatDate('2026-10-05T00:00:00Z', 'DD MMMM YYYY')).toBe('05 October 2026');
    expect(amountInWords(413000)).toBe('Rupees Four Lakh Thirteen Thousand Only');
    expect(amountInWords(1250.5, 'USD')).toBe('Dollars One Thousand Two Hundred Fifty and Fifty Cents Only');
  });

  it('strips active content', () => {
    expect(stripActiveContent('<a href="javascript:x">a</a><iframe src=y></iframe>')).toBe('<a href="#">a</a>');
  });

  it('reads the page-number meta', () => {
    expect(pageNumberPosition('<meta name="page-numbers" content="bottom-center">')).toBe('center');
    expect(pageNumberPosition('<p></p>')).toBeNull();
  });
});

describe('built-in invoice layout - optional columns', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { builtInStarter } = require('./starter-templates');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { invoiceContext, sampleContext } = require('./template-variables');
  const base = sampleContext('INVOICE');

  it('hides Qty, Unit and Disc when no line uses them', async () => {
    const lines = [{ sortOrder: 0, description: 'Backend development', quantity: 1, unit: null, unitPrice: 4000, discount: 0, taxes: [], lineTaxable: 4000, lineTax: 720, lineTotal: 4720 }];
    const html = await renderTemplate(builtInStarter('INVOICE').html, { ...base, lines: base.lines.slice(0, 1), columns: { quantity: false, unit: false, discount: false } });
    expect(html).not.toContain('<th>Qty</th>');
    expect(html).not.toContain('>Unit<');
    expect(html).toContain('<th>Price</th>');
    expect(invoiceContext({ ...lines[0], lines, sections: [], clientSnapshot: null, companySnapshot: null } as never).columns).toEqual({
      quantity: false,
      unit: false,
      discount: false,
    });
  });

  it('shows them when a line uses them', async () => {
    const html = await renderTemplate(builtInStarter('INVOICE').html, base);
    expect(html).toContain('<th>Qty</th>');
    expect(html).toContain('<th class="left">Unit</th>');
  });
});
