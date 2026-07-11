import { calculateTax, TaxCalcInput, TaxLineInput } from './tax-engine.util';

function calc(items: TaxLineInput[], opts: Partial<TaxCalcInput> = {}) {
  return calculateTax({ items, ...opts });
}
const gst = (rate: number, extra: object = {}) => [{ type: 'GST' as const, rate, ...extra }];

describe('Tax engine - India GST place of supply', () => {
  it('same state → CGST + SGST split', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxBreakdown).toEqual([
      { name: 'CGST', rate: 9, amount: 9 },
      { name: 'SGST', rate: 9, amount: 9 },
    ]);
    expect(r.taxTotal).toBe(18);
    expect(r.grandTotal).toBe(118);
  });

  it('different state → IGST', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18) }], { companyState: 'KA', customerState: 'MH' });
    expect(r.taxBreakdown).toEqual([{ name: 'IGST', rate: 18, amount: 18 }]);
    expect(r.grandTotal).toBe(118);
  });

  it('case-insensitive state comparison', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18) }], { companyState: 'Karnataka', customerState: 'karnataka ' });
    expect(r.taxBreakdown.map((b) => b.name)).toEqual(['CGST', 'SGST']);
  });
});

describe('Tax engine - exemption & zero-rating', () => {
  it('exempt line → taxable but no tax', () => {
    const r = calc([{ quantity: 1, price: 100, exempt: true, taxes: gst(18) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxableTotal).toBe(100);
    expect(r.taxTotal).toBe(0);
    expect(r.grandTotal).toBe(100);
  });

  it('international (export) → zero-rated regardless of GST', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18) }], { customerCountry: 'USA', companyState: 'KA', customerState: 'KA' });
    expect(r.taxTotal).toBe(0);
    expect(r.grandTotal).toBe(100);
  });

  it('zero-rated GST (0%)', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(0) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxTotal).toBe(0);
    expect(r.effectiveRate).toBe(0);
    expect(r.grandTotal).toBe(100);
  });
});

describe('Tax engine - inclusive vs exclusive', () => {
  it('exclusive: tax added on top', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18) }], { priceMode: 'EXCLUSIVE', companyState: 'KA', customerState: 'KA' });
    expect(r.taxableTotal).toBe(100);
    expect(r.grandTotal).toBe(118);
  });

  it('inclusive: tax extracted from the price', () => {
    const r = calc([{ quantity: 1, price: 118, taxes: gst(18) }], { priceMode: 'INCLUSIVE', companyState: 'KA', customerState: 'KA' });
    expect(r.taxableTotal).toBe(100);
    expect(r.taxTotal).toBe(18);
    expect(r.grandTotal).toBe(118);
  });
});

describe('Tax engine - discount before tax', () => {
  it('percentage discount reduces the taxable amount', () => {
    const r = calc([{ quantity: 1, price: 100, discount: 10, discountType: 'PERCENT', taxes: gst(18) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.discountTotal).toBe(10);
    expect(r.taxableTotal).toBe(90);
    expect(r.taxTotal).toBe(16.2);
    expect(r.grandTotal).toBe(106); // 106.2 rounded
    expect(r.roundOff).toBe(-0.2);
  });

  it('fixed discount', () => {
    const r = calc([{ quantity: 1, price: 100, discount: 20, discountType: 'FIXED', taxes: gst(18) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxableTotal).toBe(80);
    expect(r.grandTotal).toBe(94); // 80 + 14.4 = 94.4 → 94
  });
});

describe('Tax engine - multiple & custom taxes', () => {
  it('GST + custom cess on the same line', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: [...gst(18), { type: 'CUSTOM', rate: 2, name: 'CESS' }] }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxBreakdown).toEqual([
      { name: 'CGST', rate: 9, amount: 9 },
      { name: 'SGST', rate: 9, amount: 9 },
      { name: 'CESS', rate: 2, amount: 2 },
    ]);
    expect(r.taxTotal).toBe(20);
    expect(r.grandTotal).toBe(120);
  });

  it('fixed-amount tax', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: [{ type: 'CUSTOM', mode: 'FIXED', amount: 50, name: 'FEE' }] }]);
    expect(r.taxTotal).toBe(50);
    expect(r.grandTotal).toBe(150);
  });

  it('VAT (GCC-style flat rate)', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: [{ type: 'VAT', rate: 5 }] }], { customerCountry: 'UAE', homeCountry: 'UAE' });
    expect(r.taxBreakdown).toEqual([{ name: 'VAT', rate: 5, amount: 5 }]);
    expect(r.grandTotal).toBe(105);
  });
});

describe('Tax engine - rounding modes', () => {
  const line = [{ quantity: 1, price: 90, taxes: gst(18) }]; // 90 + 16.2 = 106.2
  const st = { companyState: 'KA', customerState: 'KA' };
  it('NEAREST', () => expect(calc(line, { ...st, roundingMode: 'NEAREST' }).grandTotal).toBe(106));
  it('UP', () => expect(calc(line, { ...st, roundingMode: 'UP' }).grandTotal).toBe(107));
  it('DOWN', () => expect(calc(line, { ...st, roundingMode: 'DOWN' }).grandTotal).toBe(106));
  it('NONE keeps 2 decimals', () => expect(calc(line, { ...st, roundingMode: 'NONE' }).grandTotal).toBe(106.2));
});

describe('Tax engine - reverse charge (prepare only)', () => {
  it('computed and reported, but excluded from the payable total', () => {
    const r = calc([{ quantity: 1, price: 100, taxes: gst(18, { reverseCharge: true }) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.taxTotal).toBe(0);
    expect(r.reverseChargeTotal).toBe(18);
    expect(r.grandTotal).toBe(100);
    expect(r.taxBreakdown).toEqual([]);
  });
});

describe('Tax engine - totals & edge cases', () => {
  it('multi-line document totals', () => {
    const r = calc(
      [
        { quantity: 2, price: 50, taxes: gst(18) },
        { quantity: 1, price: 200, taxes: gst(18) },
      ],
      { companyState: 'KA', customerState: 'KA' },
    );
    expect(r.subtotal).toBe(300);
    expect(r.taxableTotal).toBe(300);
    expect(r.taxTotal).toBe(54);
    expect(r.grandTotal).toBe(354);
    expect(r.effectiveRate).toBe(18);
  });

  it('empty items → zero summary', () => {
    const r = calc([]);
    expect(r).toMatchObject({ subtotal: 0, taxableTotal: 0, taxTotal: 0, grandTotal: 0, effectiveRate: 0 });
  });

  it('no taxes selected → subtotal equals grand total', () => {
    const r = calc([{ quantity: 3, price: 10 }]);
    expect(r.grandTotal).toBe(30);
    expect(r.taxTotal).toBe(0);
  });

  it('discount capped at line gross', () => {
    const r = calc([{ quantity: 1, price: 100, discount: 500, discountType: 'FIXED', taxes: gst(18) }], { companyState: 'KA', customerState: 'KA' });
    expect(r.discountTotal).toBe(100);
    expect(r.taxableTotal).toBe(0);
    expect(r.grandTotal).toBe(0);
  });
});
