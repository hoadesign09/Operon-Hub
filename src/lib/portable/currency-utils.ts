/**
 * Tiện ích định dạng, làm tròn và phân tích tiền tệ VNĐ an toàn (tránh sai số dấu phẩy động).
 *
 * Dependencies: None
 *
 * Input / Output:
 * - roundCurrency(value: number, decimals?: number) => number
 * - formatVND(amount: number | string | null | undefined, options?: FormatVNDOptions) => string
 * - parseCurrencyInput(raw: string | number | null | undefined) => number | null
 *
 * Ví dụ:
 * ```ts
 * formatVND(15000000); // '15.000.000 ₫'
 * parseCurrencyInput('15.000.000 ₫'); // 15000000
 * ```
 */

export interface FormatVNDOptions {
  showSymbol?: boolean;
  symbol?: string;
  decimals?: number;
  fallback?: string;
}

const DEFAULT_SYMBOL = '₫';
const DEFAULT_FALLBACK = '0 ₫';

export function roundCurrency(value: number, decimals: number = 0): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const safeDecimals = Math.max(0, Math.min(6, Math.trunc(decimals)));
  const factor = 10 ** safeDecimals;
  const rounded = Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatVND(
  amount: number | string | null | undefined,
  options: FormatVNDOptions = {},
): string {
  const showSymbol = options.showSymbol ?? true;
  const symbol = options.symbol ?? DEFAULT_SYMBOL;
  const decimals = options.decimals ?? 0;
  const fallback = options.fallback ?? (showSymbol ? DEFAULT_FALLBACK : '0');

  if (amount === null || amount === undefined || amount === '') {
    return fallback;
  }

  const numericValue = typeof amount === 'string' ? Number(amount.trim()) : amount;
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const rounded = roundCurrency(numericValue, decimals);
  const formattedNumber = new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);

  return showSymbol ? `${formattedNumber} ${symbol}` : formattedNumber;
}

export function parseCurrencyInput(
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }

  const cleaned = raw
    .trim()
    .replace(/[₫đVNDvnd\s]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');

  if (cleaned.length === 0 || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
