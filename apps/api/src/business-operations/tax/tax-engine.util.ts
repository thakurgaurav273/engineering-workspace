/**
 * Canonical tax calculation engine — pure, no I/O, no config coupling. Every financial
 * document calls this (via TaxEngineService). It must never be duplicated inside invoices.
 *
 * Designed to be region-extensible: India GST is implemented; GCC VAT and other regimes
 * slot in by adding tax types + resolution rules, not by rewriting the math.
 */

export type TaxType = 'NONE' | 'GST' | 'CGST' | 'SGST' | 'IGST' | 'VAT' | 'CUSTOM';
export type TaxMode = 'PERCENT' | 'FIXED';
export type PriceMode = 'EXCLUSIVE' | 'INCLUSIVE';
export type RoundingMode = 'NONE' | 'NEAREST' | 'UP' | 'DOWN';
export type DiscountType = 'PERCENT' | 'FIXED';

export interface TaxSelection {
  type: TaxType;
  rate?: number; // percentage (for PERCENT mode)
  amount?: number; // fixed amount per line (for FIXED mode)
  mode?: TaxMode; // default PERCENT
  name?: string; // label for CUSTOM
  reverseCharge?: boolean; // prepare-only: computed + reported, excluded from payable total
}

export interface TaxLineInput {
  description?: string;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: DiscountType; // default PERCENT
  taxes?: TaxSelection[];
  exempt?: boolean;
}

export interface TaxCalcInput {
  items: TaxLineInput[];
  companyState?: string;
  customerState?: string;
  customerCountry?: string;
  customerHasGstin?: boolean;
  homeCountry?: string; // default 'India'
  priceMode?: PriceMode; // default EXCLUSIVE
  roundingMode?: RoundingMode; // default NEAREST
}

export interface AppliedTax {
  name: string;
  rate: number;
  amount: number;
  reverseCharge: boolean;
}

export interface TaxLineResult {
  description?: string;
  quantity: number;
  price: number;
  gross: number;
  discount: number;
  taxable: number;
  taxAmount: number;
  total: number;
  taxes: AppliedTax[];
}

export interface TaxBreakdownEntry {
  name: string;
  rate: number;
  amount: number;
}

export interface TaxSummary {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  taxBreakdown: TaxBreakdownEntry[];
  taxTotal: number;
  reverseChargeTotal: number;
  roundOff: number;
  grandTotal: number;
  effectiveRate: number;
  lines: TaxLineResult[];
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const normState = (s?: string): string => (s ?? '').trim().toLowerCase();

/** Expand a selection into concrete taxes, applying India GST intra/inter-state split. */
function resolveTaxes(sel: TaxSelection, interState: boolean): TaxSelection[] {
  if (sel.type === 'NONE') return [];
  if (sel.type === 'GST') {
    const rate = sel.rate ?? 0;
    if (interState) return [{ ...sel, type: 'IGST', name: 'IGST', rate }];
    return [
      { ...sel, type: 'CGST', name: 'CGST', rate: rate / 2 },
      { ...sel, type: 'SGST', name: 'SGST', rate: rate / 2 },
    ];
  }
  return [{ ...sel, name: sel.name ?? sel.type }];
}

export function calculateTax(input: TaxCalcInput): TaxSummary {
  const priceMode = input.priceMode ?? 'EXCLUSIVE';
  const roundingMode = input.roundingMode ?? 'NEAREST';
  const home = normState(input.homeCountry ?? 'India');
  const isInternational = !!input.customerCountry && normState(input.customerCountry) !== home;
  const interState =
    !!input.companyState && !!input.customerState && normState(input.companyState) !== normState(input.customerState);

  const lines: TaxLineResult[] = [];
  const breakdown = new Map<string, TaxBreakdownEntry>();
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;
  let reverseChargeTotal = 0;

  for (const item of input.items) {
    const gross = round2(item.quantity * item.price);
    const rawDiscount =
      item.discountType === 'FIXED' ? item.discount ?? 0 : gross * ((item.discount ?? 0) / 100);
    const discount = round2(Math.min(Math.max(rawDiscount, 0), gross));
    const net = round2(gross - discount);

    // Zero-rated: exempt line or international (export) → taxable but no tax.
    const zeroRated = !!item.exempt || isInternational;
    const selections = zeroRated
      ? []
      : (item.taxes ?? []).flatMap((s) => resolveTaxes(s, interState));

    const percentSel = selections.filter((s) => (s.mode ?? 'PERCENT') === 'PERCENT');
    const fixedSel = selections.filter((s) => s.mode === 'FIXED');
    const payablePercentRate = percentSel.filter((s) => !s.reverseCharge).reduce((a, s) => a + (s.rate ?? 0), 0);
    const fixedNonReverse = fixedSel.filter((s) => !s.reverseCharge).reduce((a, s) => a + (s.amount ?? 0), 0);

    let taxable: number;
    if (priceMode === 'INCLUSIVE') {
      taxable = round2((net - fixedNonReverse) / (1 + payablePercentRate / 100));
    } else {
      taxable = net;
    }

    const appliedTaxes: AppliedTax[] = [];
    let lineTax = 0;
    let lineReverse = 0;

    for (const s of percentSel) {
      const amount = round2(taxable * (s.rate ?? 0) / 100);
      appliedTaxes.push({ name: s.name ?? s.type, rate: s.rate ?? 0, amount, reverseCharge: !!s.reverseCharge });
      if (s.reverseCharge) lineReverse += amount;
      else lineTax += amount;
    }
    for (const s of fixedSel) {
      const amount = round2(s.amount ?? 0);
      appliedTaxes.push({ name: s.name ?? s.type, rate: 0, amount, reverseCharge: !!s.reverseCharge });
      if (s.reverseCharge) lineReverse += amount;
      else lineTax += amount;
    }

    lineTax = round2(lineTax);
    lineReverse = round2(lineReverse);
    const total = priceMode === 'INCLUSIVE' ? net : round2(taxable + lineTax);

    for (const t of appliedTaxes) {
      if (t.reverseCharge) continue; // reverse charge tracked separately, not in the payable breakdown
      const key = `${t.name}@${t.rate}`;
      const entry = breakdown.get(key) ?? { name: t.name, rate: t.rate, amount: 0 };
      entry.amount = round2(entry.amount + t.amount);
      breakdown.set(key, entry);
    }

    subtotal = round2(subtotal + gross);
    discountTotal = round2(discountTotal + discount);
    taxableTotal = round2(taxableTotal + taxable);
    taxTotal = round2(taxTotal + lineTax);
    reverseChargeTotal = round2(reverseChargeTotal + lineReverse);

    lines.push({
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      gross,
      discount,
      taxable,
      taxAmount: lineTax,
      total,
      taxes: appliedTaxes,
    });
  }

  const grandBeforeRound = round2(taxableTotal + taxTotal);
  let grandTotal = grandBeforeRound;
  if (roundingMode === 'NEAREST') grandTotal = Math.round(grandBeforeRound);
  else if (roundingMode === 'UP') grandTotal = Math.ceil(grandBeforeRound);
  else if (roundingMode === 'DOWN') grandTotal = Math.floor(grandBeforeRound);
  const roundOff = round2(grandTotal - grandBeforeRound);

  const effectiveRate = taxableTotal > 0 ? round2((taxTotal / taxableTotal) * 100) : 0;

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    taxBreakdown: [...breakdown.values()],
    taxTotal,
    reverseChargeTotal,
    roundOff,
    grandTotal,
    effectiveRate,
    lines,
  };
}
