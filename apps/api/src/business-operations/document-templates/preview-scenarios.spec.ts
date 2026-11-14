import { PREVIEW_SCENARIOS, scenarioContext } from './preview-scenarios';
import { STARTER_TEMPLATES } from './starter-templates';
import { renderTemplate } from './template-engine';
import { TEMPLATED_TYPES, sampleContext } from './template-variables';

type Ctx = Record<string, any>;

describe('preview scenarios', () => {
  it('sample is the plain sample context', () => {
    for (const type of TEMPLATED_TYPES) {
      const a = scenarioContext(type, 'sample') as Ctx;
      const b = sampleContext(type) as Ctx;
      expect(Object.keys(a)).toEqual(Object.keys(b));
      expect(a.company).toEqual(b.company);
    }
  });

  it.each(STARTER_TEMPLATES.flatMap((s) => PREVIEW_SCENARIOS.map((sc) => [s.key, sc, s] as const)))(
    'starter %s renders with %s',
    async (_key, scenario, starter) => {
      await expect(renderTemplate(starter.html, scenarioContext(starter.documentType, scenario))).resolves.toContain('<');
    },
  );

  it('empty_optional blanks text but keeps the document identity and one line', () => {
    const ctx = scenarioContext('INVOICE', 'empty_optional') as Ctx;
    expect(ctx.company.name).toBe('');
    expect(ctx.client.gstin).toBe('');
    expect(ctx.document.title).not.toBe('');
    expect(ctx.document.number).toBe((sampleContext('INVOICE') as Ctx).document.number);
    expect(ctx.lines).toHaveLength(1);
    expect(ctx.sections).toEqual([]);
    expect(ctx.invoice.grand_total).toBe((sampleContext('INVOICE') as Ctx).invoice.grand_total);
  });

  it('long_text stretches text and html fields', () => {
    const ctx = scenarioContext('QUOTATION', 'long_text') as Ctx;
    expect(ctx.client.name.length).toBeGreaterThanOrEqual(200);
    expect(ctx.lines[0].description.length).toBeGreaterThanOrEqual(200);
    expect((ctx.sections[0].content.match(/<p>/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it('large_tables grows line items with fresh row numbers but leaves taxes alone', () => {
    const base = sampleContext('INVOICE') as Ctx;
    const ctx = scenarioContext('INVOICE', 'large_tables') as Ctx;
    expect(ctx.lines).toHaveLength(60);
    expect(ctx.lines[59].index).toBe(60);
    expect(ctx.taxes).toHaveLength(base.taxes.length);
  });
});
