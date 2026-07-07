// Shared Business Operations formatting helpers. Extracted from duplicated inline copies
// in the invoices and tax-config UIs. Behavior is identical to the originals.

/** "1,234.50" — a plain 2-decimal amount. */
export const formatAmount = (n: number): string =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "INR 1,234.50" — a currency-prefixed amount (used on documents). */
export const money = (n: number, currency = "INR"): string => `${currency} ${formatAmount(n)}`;
