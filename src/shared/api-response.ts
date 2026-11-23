import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { PaginationMeta } from '@/lib/portable/pagination';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody<T = undefined> {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  data?: T;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ApiErrorDetail[];

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function ok<T>(
  data: T,
  meta?: PaginationMeta,
  status: number = 200,
): NextResponse<ApiSuccessBody<T>> {
  const body: ApiSuccessBody<T> = meta ? { success: true, data, meta } : { success: true, data };
  return NextResponse.json(body, { status });
}

export function created<T>(data: T): NextResponse<ApiSuccessBody<T>> {
  return ok(data, undefined, 201);
}

export function fail<T = undefined>(
  code: string,
  message: string,
  status: number = 400,
  details?: ApiErrorDetail[],
  extraData?: T,
): NextResponse<ApiErrorBody<T>> {
  const body: ApiErrorBody<T> = {
    success: false,
    error: details && details.length > 0 ? { code, message, details } : { code, message },
  };
  if (extraData !== undefined) {
    body.data = extraData;
  }
  return NextResponse.json(body, { status });
}

export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) {
        return fail(error.code, error.message, error.statusCode, error.details);
      }

      if (error instanceof ZodError) {
        const details: ApiErrorDetail[] = error.issues.map((issue) => ({
          field: issue.path.join('.') || undefined,
          message: issue.message,
        }));
        return fail('VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ.', 400, details);
      }

      return fail(
        'INTERNAL_SERVER_ERROR',
        'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
        500,
      );
    }
  };
}
