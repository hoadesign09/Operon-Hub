/**
 * Băm và xác thực mật khẩu an toàn bằng Node.js native crypto (scrypt + timingSafeEqual).
 *
 * Dependencies: None (Node.js built-in `node:crypto`)
 *
 * Input / Output:
 * - hashPassword(plain: string, options?: PasswordHashOptions) => Promise<string>
 * - verifyPassword(plain: string, storedHash: string) => Promise<boolean>
 *
 * Ví dụ:
 * ```ts
 * const hash = await hashPassword('MatKhau@123');
 * const isValid = await verifyPassword('MatKhau@123', hash); // true
 * ```
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface PasswordHashOptions {
  cost?: number;
  blockSize?: number;
  parallelization?: number;
  keyLength?: number;
  saltLength?: number;
}

const HASH_PREFIX = 'scrypt';
const DEFAULT_COST = 16384;
const DEFAULT_BLOCK_SIZE = 8;
const DEFAULT_PARALLELIZATION = 1;
const DEFAULT_KEY_LENGTH = 64;
const DEFAULT_SALT_LENGTH = 16;
const EXPECTED_PARTS_COUNT = 6;

function deriveScryptKey(
  plain: string,
  salt: Buffer,
  keyLength: number,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, keyLength, params, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function hashPassword(
  plain: string,
  options: PasswordHashOptions = {},
): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('Mật khẩu đầu vào không được để trống.');
  }

  const cost = options.cost ?? DEFAULT_COST;
  const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
  const parallelization = options.parallelization ?? DEFAULT_PARALLELIZATION;
  const keyLength = options.keyLength ?? DEFAULT_KEY_LENGTH;
  const saltLength = options.saltLength ?? DEFAULT_SALT_LENGTH;

  const salt = randomBytes(saltLength);
  const derivedKey = await deriveScryptKey(plain, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
  });

  return [
    HASH_PREFIX,
    String(cost),
    String(blockSize),
    String(parallelization),
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join('$');
}

export async function verifyPassword(
  plain: string,
  storedHash: string,
): Promise<boolean> {
  if (typeof plain !== 'string' || plain.length === 0) {
    return false;
  }
  if (typeof storedHash !== 'string' || storedHash.length === 0) {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== EXPECTED_PARTS_COUNT || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  const saltHex = parts[4];
  const expectedHex = parts[5];

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelization) ||
    cost <= 0 ||
    blockSize <= 0 ||
    parallelization <= 0
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(expectedHex, 'hex');
  if (salt.length === 0 || expectedKey.length === 0) {
    return false;
  }

  try {
    const derivedKey = await deriveScryptKey(plain, salt, expectedKey.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
    });
    if (derivedKey.length !== expectedKey.length) {
      return false;
    }
    return timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}
