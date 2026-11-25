/**
 * Purpose: Pure fractional indexing (LexoRank-style) for O(1) drag-and-drop ordering without bulk reindexing.
 * Dependencies: None
 * Input/Output:
 *   - rankBetween(prevRank, nextRank) -> lexicographically ordered string strictly between prevRank and nextRank
 *   - generateInitialRanks(count) -> evenly spaced sorted rank strings
 *   - compareRanks(a, b) -> standard lexicographical comparator (-1 | 0 | 1)
 * Example:
 *   const mid = rankBetween('a', 'c'); // 'b'
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;
const MID_CHAR = ALPHABET[Math.floor(BASE / 2)]!;
const FIRST_CHAR = ALPHABET[0]!;
const LAST_CHAR = ALPHABET[BASE - 1]!;

function charIndex(char: string | undefined, fallback: number): number {
  if (!char) {
    return fallback;
  }
  const idx = ALPHABET.indexOf(char);
  return idx >= 0 ? idx : fallback;
}

export function compareRanks(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function isValidRank(rank: string): boolean {
  if (!rank || rank.length > 64) {
    return false;
  }
  for (let i = 0; i < rank.length; i += 1) {
    if (!ALPHABET.includes(rank[i]!)) {
      return false;
    }
  }
  return true;
}

/**
 * Generates a lexicographically sorted string strictly between `prev` and `next`.
 * Passing `(null, null)` returns the midpoint rank.
 */
export function rankBetween(prev: string | null | undefined, next: string | null | undefined): string {
  const left = prev && prev.length > 0 ? prev : '';
  const right = next && next.length > 0 ? next : '';

  if (left && right && left >= right) {
    throw new Error(`Invalid rank bounds: prev ("${left}") must be strictly less than next ("${right}").`);
  }

  if (!left && !right) {
    return MID_CHAR;
  }

  let prefix = '';
  let i = 0;

  while (true) {
    const leftIdx = i < left.length ? charIndex(left[i], 0) : 0;
    const rightIdx = right
      ? i < right.length
        ? charIndex(right[i], BASE - 1)
        : BASE - 1
      : BASE;

    if (leftIdx === rightIdx) {
      prefix += ALPHABET[leftIdx]!;
      i += 1;
      continue;
    }

    if (rightIdx - leftIdx > 1) {
      const midIdx = Math.floor((leftIdx + rightIdx) / 2);
      const candidate = prefix + ALPHABET[midIdx]!;
      if ((!left || candidate > left) && (!right || candidate < right)) {
        return candidate;
      }
    }

    // No integer gap at position i; copy left char and dive deeper
    if (i < left.length) {
      prefix += left[i]!;
      i += 1;
      continue;
    }

    // Left ended; if right has next char > 0, pick midpoint between 0 and right's next char
    if (right) {
      prefix += FIRST_CHAR;
      i += 1;
      continue;
    }

    // Only left is set and exhausted at LAST_CHAR
    return `${left}${MID_CHAR}`;
  }
}

/**
 * Generates a rank strictly before the given rank.
 */
export function rankBefore(firstRank: string | null | undefined): string {
  if (!firstRank) {
    return MID_CHAR;
  }
  return rankBetween(null, firstRank);
}

/**
 * Generates a rank strictly after the given rank.
 */
export function rankAfter(lastRank: string | null | undefined): string {
  if (!lastRank) {
    return MID_CHAR;
  }
  if (lastRank[lastRank.length - 1] === LAST_CHAR) {
    return `${lastRank}${MID_CHAR}`;
  }
  return rankBetween(lastRank, null);
}

/**
 * Generates `count` evenly spaced initial ranks in ascending lexicographical order.
 */
export function generateInitialRanks(count: number): string[] {
  if (count <= 0) {
    return [];
  }
  const results: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i += 1) {
    const nextRank: string = prev ? rankAfter(prev) : MID_CHAR;
    results.push(nextRank);
    prev = nextRank;
  }
  return results;
}
