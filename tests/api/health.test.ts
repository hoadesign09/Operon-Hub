import { describe, expect, it, vi, beforeEach } from 'vitest';

const pingDatabaseMock = vi.fn();

vi.mock('@/config/database', () => ({
  pingDatabase: () => pingDatabaseMock(),
}));

import { GET } from '@/app/api/v1/health/route';

describe('API GET /api/v1/health', () => {
  beforeEach(() => {
    pingDatabaseMock.mockReset();
  });

  it('returns 200 HEALTHY with module list when MySQL ping succeeds', async () => {
    pingDatabaseMock.mockResolvedValue({ ok: true, latencyMs: 5 });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('HEALTHY');
    expect(json.data.database).toEqual({ status: 'UP', latencyMs: 5 });
    expect(Array.isArray(json.data.modules)).toBe(true);
    expect(json.data.modules.map((m: { code: string }) => m.code)).toEqual([
      'core',
      'hrm',
      'projects',
      'crm',
    ]);
  });

  it('returns 503 DEGRADED without leaking sensitive info when MySQL ping fails', async () => {
    pingDatabaseMock.mockResolvedValue({
      ok: false,
      latencyMs: null,
      errorCode: 'DATABASE_UNAVAILABLE',
    });

    const response = await GET();
    const json = await response.json();
    const serialized = JSON.stringify(json);

    expect(response.status).toBe(503);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(json.data.status).toBe('DEGRADED');
    expect(json.data.database).toEqual({ status: 'DOWN', latencyMs: null });
    expect(serialized).not.toContain('DB_PASSWORD');
    expect(serialized).not.toContain('root');
  });
});
