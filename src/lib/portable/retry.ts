/**
 * Thực thi lại hàm bất đồng bộ theo chiến lược Exponential Backoff khi gặp lỗi tạm thời.
 *
 * Dependencies: None
 *
 * Input / Output:
 * - retryAsync<T>(fn: () => Promise<T>, options?: RetryOptions) => Promise<T>
 *
 * Ví dụ:
 * ```ts
 * const data = await retryAsync(() => fetchRemoteData(), { retries: 3, baseDelayMs: 200 });
 * ```
 */

export interface RetryOptions {
  /** Số lần thử lại sau lần chạy đầu tiên. Mặc định: 3 */
  retries?: number;
  /** Thời gian chờ cơ sở (ms). Mặc định: 200 */
  baseDelayMs?: number;
  /** Hệ số nhân thời gian chờ giữa các lần thử. Mặc định: 2 */
  backoffFactor?: number;
  /** Giới hạn thời gian chờ tối đa (ms). Mặc định: 10000 */
  maxDelayMs?: number;
  /** Hàm quyết định có nên thử lại với lỗi hiện tại không */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_BACKOFF_FACTOR = 2;
const DEFAULT_MAX_DELAY_MS = 10_000;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = Math.max(0, Math.trunc(options.retries ?? DEFAULT_RETRIES));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const backoffFactor = Math.max(1, options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR);
  const maxDelayMs = Math.max(0, options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= retries;
      const canRetry = options.shouldRetry ? options.shouldRetry(error, attempt + 1) : true;

      if (isLastAttempt || !canRetry) {
        throw error;
      }

      const rawDelay = baseDelayMs * backoffFactor ** attempt;
      const delayMs = Math.min(rawDelay, maxDelayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
