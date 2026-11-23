import { describe, expect, it } from 'vitest';
import { generateSecureToken, sha256Hex } from '@/lib/portable/token-hash';

describe('portable/token-hash', () => {
  it('generates unique high-entropy URL-safe tokens', () => {
    const tokenA = generateSecureToken(32);
    const tokenB = generateSecureToken(32);

    expect(tokenA).not.toBe(tokenB);
    expect(tokenA.length).toBeGreaterThanOrEqual(40);
    expect(/^[A-Za-z0-9_-]+$/.test(tokenA)).toBe(true);
  });

  it('produces deterministic 64-char SHA-256 hex digest and rejects empty input', () => {
    const digestA = sha256Hex('operon-refresh-token');
    const digestB = sha256Hex('operon-refresh-token');

    expect(digestA).toBe(digestB);
    expect(digestA).toMatch(/^[0-9a-f]{64}$/);
    expect(() => sha256Hex('')).toThrow('không được để trống');
  });
});
