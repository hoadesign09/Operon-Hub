import { describe, expect, it } from 'vitest';
import {
  compareRanks,
  generateInitialRanks,
  isValidRank,
  rankAfter,
  rankBefore,
  rankBetween,
} from '@/lib/portable/fractional-rank';

describe('Portable Fractional Rank (LexoRank)', () => {
  it('generates strictly ascending initial ranks', () => {
    const ranks = generateInitialRanks(20);
    expect(ranks).toHaveLength(20);
    for (let i = 1; i < ranks.length; i += 1) {
      expect(compareRanks(ranks[i - 1]!, ranks[i]!)).toBe(-1);
      expect(isValidRank(ranks[i]!)).toBe(true);
    }
  });

  it('inserts ranks strictly between adjacent bounds across 40 repeated splits', () => {
    let left = rankBetween(null, null);
    const right = rankAfter(left);
    expect(left < right).toBe(true);

    for (let i = 0; i < 40; i += 1) {
      const mid = rankBetween(left, right);
      expect(mid > left).toBe(true);
      expect(mid < right).toBe(true);
      expect(isValidRank(mid)).toBe(true);
      left = mid;
    }
  });

  it('supports rankBefore and throws on inverted bounds', () => {
    const first = rankBetween(null, null);
    const before = rankBefore(first);
    expect(before < first).toBe(true);
    expect(() => rankBetween('z', 'a')).toThrow();
  });
});
