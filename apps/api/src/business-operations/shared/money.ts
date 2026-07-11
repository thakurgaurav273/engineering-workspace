/**
 * Locale-aware currency formatter shared by the business-document renderers (invoice,
 * quotation). `Intl.NumberFormat` renders the correct symbol per currency - ₹ for INR,
 * $ for USD, € for EUR, £ for GBP, AED, etc. Falls back to a plain string if the currency
 * code is unknown to the runtime's ICU data.
 */
export function formatMoney(amount: number, currency?: string): string {
  const code = currency || 'INR';
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString()}`;
  }
}
