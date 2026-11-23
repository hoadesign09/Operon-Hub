import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/portable/password-hasher';

describe('portable/password-hasher', () => {
  it('hashes and verifies a valid password with unique salts', async () => {
    const hashA = await hashPassword('Operon@2026');
    const hashB = await hashPassword('Operon@2026');

    expect(hashA).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hashA).not.toBe(hashB);
    expect(await verifyPassword('Operon@2026', hashA)).toBe(true);
    expect(await verifyPassword('Operon@2026', hashB)).toBe(true);
    expect(await verifyPassword('WrongPass@2026', hashA)).toBe(false);
  });

  it('throws when hashing an empty password', async () => {
    await expect(hashPassword('')).rejects.toThrow('không được để trống');
  });

  it('returns false safely for malformed or empty stored hashes', async () => {
    expect(await verifyPassword('', 'scrypt$16384$8$1$aa$bb')).toBe(false);
    expect(await verifyPassword('abc', '')).toBe(false);
    expect(await verifyPassword('abc', 'invalid-format')).toBe(false);
    expect(await verifyPassword('abc', 'bcrypt$16384$8$1$aa$bb')).toBe(false);
    expect(await verifyPassword('abc', 'scrypt$0$8$1$aa$bb')).toBe(false);
  });
});
