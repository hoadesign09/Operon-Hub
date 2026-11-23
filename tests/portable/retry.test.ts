import { describe, expect, it, vi } from 'vitest';
import { retryAsync } from '@/lib/portable/retry';

describe('portable/retry', () => {
  it('retries failed attempts until succeeding', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('temporary error');
      }
      return 'ok';
    });

    const result = await retryAsync(fn, { retries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying early when shouldRetry returns false', async () => {
    const fn = vi.fn(async () => {
      throw new Error('fatal');
    });

    await expect(
      retryAsync(fn, {
        retries: 3,
        baseDelayMs: 1,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
