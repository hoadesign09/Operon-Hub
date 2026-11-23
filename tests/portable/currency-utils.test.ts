import { describe, expect, it } from 'vitest';
import { formatVND, parseCurrencyInput, roundCurrency } from '@/lib/portable/currency-utils';

describe('portable/currency-utils', () => {
  it('rounds currency safely avoiding floating-point precision drift', () => {
    expect(roundCurrency(1.005, 2)).toBe(1.01);
    expect(roundCurrency(15000000.6, 0)).toBe(15000001);
    expect(roundCurrency(-0.0001, 0)).toBe(0);
    expect(roundCurrency(Number.NaN, 2)).toBe(0);
  });

  it('formats numbers and decimal strings to VND format', () => {
    expect(formatVND(15000000)).toBe('15.000.000 ₫');
    expect(formatVND('25500000.00')).toBe('25.500.000 ₫');
    expect(formatVND(15000000, { showSymbol: false })).toBe('15.000.000');
    expect(formatVND(null)).toBe('0 ₫');
    expect(formatVND('abc', { fallback: '-' })).toBe('-');
  });

  it('parses Vietnamese currency strings cleanly', () => {
    expect(parseCurrencyInput('15.000.000 ₫')).toBe(15000000);
    expect(parseCurrencyInput('12.500,50 VND')).toBe(12500.5);
    expect(parseCurrencyInput(500000)).toBe(500000);
    expect(parseCurrencyInput('invalid')).toBeNull();
    expect(parseCurrencyInput(null)).toBeNull();
  });
});
