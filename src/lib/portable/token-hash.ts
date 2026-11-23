/**
 * Sinh token ngẫu nhiên mật mã học và băm SHA-256 hex phục vụ lưu trữ Refresh Token an toàn.
 *
 * Dependencies: None (Node.js built-in `node:crypto`)
 *
 * Input / Output:
 * - generateSecureToken(byteLength?: number) => string (base64url)
 * - sha256Hex(value: string) => string (64-char hex)
 *
 * Ví dụ:
 * ```ts
 * const rawToken = generateSecureToken(32);
 * const hashed = sha256Hex(rawToken); // lưu vào DB
 * ```
 */
import { createHash, randomBytes } from 'node:crypto';

const DEFAULT_TOKEN_BYTES = 32;
const MIN_TOKEN_BYTES = 16;

export function generateSecureToken(byteLength: number = DEFAULT_TOKEN_BYTES): string {
  const safeBytes = Math.max(MIN_TOKEN_BYTES, Math.trunc(byteLength));
  return randomBytes(safeBytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Giá trị cần băm SHA-256 không được để trống.');
  }
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
