/**
 * Pure numbering logic - no I/O, fully unit-testable. The service applies these under a
 * row lock; these functions decide *what* the next number is, not *how* it's persisted.
 */

export interface NumberConfig {
  prefix: string;
  suffix: string;
  separator: string;
  startNumber: number;
  currentNumber: number;
  padding: number;
  resetMode: 'NEVER' | 'YEARLY' | 'MONTHLY';
  useFinancialYear: boolean;
  periodKey: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** India financial year starts in April: Jan–Mar belongs to the previous FY. */
export function financialYearStart(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

/** Display year token, e.g. "2026" or "2026-27" (financial year). */
export function yearToken(config: NumberConfig, date: Date): string {
  if (config.useFinancialYear) {
    const y = financialYearStart(date);
    return `${y}-${pad2((y + 1) % 100)}`;
  }
  return String(date.getFullYear());
}

/** Reset-tracking key for the current period. Empty when reset is NEVER. */
export function periodKeyFor(config: NumberConfig, date: Date): string {
  if (config.resetMode === 'NEVER') return '';
  const base = config.useFinancialYear ? String(financialYearStart(date)) : String(date.getFullYear());
  return config.resetMode === 'MONTHLY' ? `${base}-${pad2(date.getMonth() + 1)}` : base;
}

/** Compute the next sequence number + the period key to store. Pure. */
export function computeNext(config: NumberConfig, date: Date): { issued: number; periodKey: string } {
  const key = periodKeyFor(config, date);
  const reset = config.resetMode !== 'NEVER' && config.periodKey !== key;
  const issued = reset || config.currentNumber < config.startNumber ? config.startNumber : config.currentNumber + 1;
  return { issued, periodKey: key };
}

/** Format a sequence number into the final document number string. Pure. */
export function formatNumber(config: NumberConfig, sequence: number, date: Date): string {
  const parts: string[] = [];
  if (config.prefix) parts.push(config.prefix);
  if (config.resetMode !== 'NEVER' || config.useFinancialYear) parts.push(yearToken(config, date));
  if (config.resetMode === 'MONTHLY') parts.push(pad2(date.getMonth() + 1));
  parts.push(String(sequence).padStart(Math.max(1, config.padding), '0'));

  let out = parts.join(config.separator);
  if (config.suffix) out += config.separator + config.suffix;
  return out;
}

/** Preview the next number without reserving it (used by the preview endpoint + UI). */
export function previewNext(config: NumberConfig, date: Date): string {
  const { issued } = computeNext(config, date);
  return formatNumber(config, issued, date);
}
