// Supported currencies for Business Operations documents. Symbols are shown in the
// editor dropdown; formatMoney renders amounts with the correct locale-aware symbol.

export interface Currency {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
];

/** Format an amount with its currency symbol, falling back gracefully for unknown codes. */
export function formatMoney(amount: number, code?: string): string {
  const currency = code || "INR";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
    return `${sym} ${(amount ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
