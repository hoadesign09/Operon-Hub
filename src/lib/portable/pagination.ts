/**
 * Chuẩn hóa tham số phân trang, sắp xếp an toàn (whitelist) và tạo metadata phân trang.
 *
 * Dependencies: None
 *
 * Input / Output:
 * - parsePaginationParams(query: PaginationQueryInput, options?: PaginationOptions) => NormalizedPagination
 * - buildPaginationMeta(total: number, page: number, limit: number) => PaginationMeta
 *
 * Ví dụ:
 * ```ts
 * const params = parsePaginationParams({ page: '2', limit: '25', sortBy: 'created_at' }, {
 *   allowedSortFields: ['created_at', 'full_name'],
 * });
 * const meta = buildPaginationMeta(120, params.page, params.limit);
 * ```
 */

export type SortOrder = 'asc' | 'desc';

export interface PaginationQueryInput {
  page?: string | number | null;
  limit?: string | number | null;
  sortBy?: string | null;
  sortOrder?: string | null;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
  allowedSortFields?: readonly string[];
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  offset: number;
  sortBy: string | null;
  sortOrder: SortOrder;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;
const DEFAULT_SORT_ORDER: SortOrder = 'desc';

function parsePositiveInt(
  value: string | number | null | undefined,
  fallback: number,
): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const truncated = Math.trunc(parsed);
  return truncated >= 1 ? truncated : fallback;
}

export function parsePaginationParams(
  query: PaginationQueryInput,
  options: PaginationOptions = {},
): NormalizedPagination {
  const defaultPage = options.defaultPage ?? DEFAULT_PAGE;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? DEFAULT_MAX_LIMIT;
  const defaultSortOrder = options.defaultSortOrder ?? DEFAULT_SORT_ORDER;

  const page = parsePositiveInt(query.page, defaultPage);
  const rawLimit = parsePositiveInt(query.limit, defaultLimit);
  const limit = Math.min(rawLimit, Math.max(1, maxLimit));
  const offset = (page - 1) * limit;

  const normalizedOrder =
    typeof query.sortOrder === 'string' && query.sortOrder.toLowerCase() === 'asc'
      ? 'asc'
      : typeof query.sortOrder === 'string' && query.sortOrder.toLowerCase() === 'desc'
        ? 'desc'
        : defaultSortOrder;

  let sortBy: string | null = options.defaultSortBy ?? null;
  if (
    typeof query.sortBy === 'string' &&
    query.sortBy.trim().length > 0 &&
    Array.isArray(options.allowedSortFields) &&
    options.allowedSortFields.includes(query.sortBy.trim())
  ) {
    sortBy = query.sortBy.trim();
  }

  return {
    page,
    limit,
    offset,
    sortBy,
    sortOrder: normalizedOrder,
  };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.trunc(total) : 0;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : DEFAULT_LIMIT;
  const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : DEFAULT_PAGE;
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1 && totalPages > 0,
  };
}
