import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/portable/pagination';

describe('portable/pagination', () => {
  it('normalizes page, limit, offset and allow-listed sort fields', () => {
    const parsed = parsePaginationParams(
      { page: '2', limit: '250', sortBy: 'full_name', sortOrder: 'ASC' },
      { maxLimit: 100, allowedSortFields: ['created_at', 'full_name'] },
    );

    expect(parsed).toEqual({
      page: 2,
      limit: 100,
      offset: 100,
      sortBy: 'full_name',
      sortOrder: 'asc',
    });
  });

  it('blocks non-whitelisted sortBy fields and handles invalid numbers', () => {
    const parsed = parsePaginationParams(
      { page: '-5', limit: 'abc', sortBy: 'id; DROP TABLE users;--', sortOrder: 'invalid' },
      { defaultSortBy: 'created_at', allowedSortFields: ['created_at'] },
    );

    expect(parsed).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
  });

  it('builds accurate pagination metadata including empty results', () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });

    expect(buildPaginationMeta(0, 1, 20)).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
});
