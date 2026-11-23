import { describe, expect, it } from 'vitest';
import { hasRequiredPermission, resolveHighestDataScope } from '@/modules/auth/auth.service';
import { signAccessToken, verifyAccessToken } from '@/modules/auth/jwt';

const TEST_SECRET = 'test_secret_key_operon_hub_minimum_32_chars';

describe('core/jwt & RBAC rules', () => {
  it('signs and verifies HS256 access tokens cleanly', async () => {
    const token = await signAccessToken(
      { userId: 42, email: 'hr@operonhub.local' },
      TEST_SECRET,
      '10m',
    );
    const verified = await verifyAccessToken(token, TEST_SECRET);

    expect(verified).toEqual({ userId: 42, email: 'hr@operonhub.local' });
    expect(await verifyAccessToken(token, 'wrong_secret_key_1234567890123456')).toBeNull();
    expect(await verifyAccessToken('malformed.token', TEST_SECRET)).toBeNull();
  });

  it('resolves highest data scope by strict hierarchy (ALL > BRANCH > DEPARTMENT > OWN)', () => {
    expect(resolveHighestDataScope([])).toBe('OWN');
    expect(resolveHighestDataScope(['OWN', 'DEPARTMENT'])).toBe('DEPARTMENT');
    expect(resolveHighestDataScope(['OWN', 'BRANCH', 'DEPARTMENT'])).toBe('BRANCH');
    expect(resolveHighestDataScope(['BRANCH', 'ALL', 'OWN'])).toBe('ALL');
  });

  it('enforces permission checks with Super Admin bypass', () => {
    expect(
      hasRequiredPermission(
        { isSuperAdmin: true, permissions: [] },
        'core.branches.delete',
      ),
    ).toBe(true);

    expect(
      hasRequiredPermission(
        { isSuperAdmin: false, permissions: ['core.branches.read'] },
        'core.branches.read',
      ),
    ).toBe(true);

    expect(
      hasRequiredPermission(
        { isSuperAdmin: false, permissions: ['core.branches.read'] },
        'core.branches.delete',
      ),
    ).toBe(false);
  });
});
