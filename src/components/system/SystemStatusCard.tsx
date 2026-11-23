'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconCheck,
  IconDatabase,
  IconInbox,
  IconRefresh,
  IconServer,
} from '@tabler/icons-react';
import { formatDateTimeVN } from '@/lib/portable/date-utils';

interface HealthModuleItem {
  code: string;
  name: string;
  description?: string;
  basePath?: string;
  status: 'ACTIVE' | 'COMING_SOON' | 'DISABLED';
}

interface HealthPayload {
  app: string;
  version: string;
  status: 'HEALTHY' | 'DEGRADED';
  environment?: string;
  timestamp: string;
  database: {
    status: 'UP' | 'DOWN';
    latencyMs: number | null;
  };
  modules: HealthModuleItem[];
}

interface HealthApiResponse {
  success?: boolean;
  data?: HealthPayload;
  error?: {
    code?: string;
    message?: string;
  };
}

type ViewState = 'loading' | 'success' | 'error';

const HEALTH_API_ENDPOINT = '/api/v1/health';
const MODULE_STATUS_LABELS: Record<HealthModuleItem['status'], string> = {
  ACTIVE: 'Đang hoạt động',
  COMING_SOON: 'Sắp ra mắt',
  DISABLED: 'Tạm ẩn',
};

function getModuleBadgeClass(status: HealthModuleItem['status']): string {
  if (status === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  }
  if (status === 'COMING_SOON') {
    return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-500/20';
}

async function requestHealthStatus(signal: AbortSignal): Promise<{
  ok: boolean;
  payload: HealthPayload | null;
  errorMessage: string;
}> {
  const response = await fetch(HEALTH_API_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });

  const json = (await response.json().catch(() => null)) as HealthApiResponse | null;
  const data = json?.data ?? null;

  if (!response.ok || !json?.success || !data) {
    return {
      ok: false,
      payload: data,
      errorMessage:
        json?.error?.message ??
        'Hệ thống chưa thể kết nối đầy đủ tới máy chủ hoặc cơ sở dữ liệu.',
    };
  }

  return { ok: true, payload: data, errorMessage: '' };
}

function HealthLoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải trạng thái hệ thống">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-36 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
    </div>
  );
}

function HealthErrorBanner({
  errorMessage,
  timestamp,
  isBusy,
  onRetry,
}: {
  errorMessage: string;
  timestamp?: string;
  isBusy: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <IconAlertTriangle size={24} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-base font-semibold">Trạng thái hệ thống: Chưa sẵn sàng</h2>
            <p className="mt-1 text-sm text-rose-800">{errorMessage}</p>
            {timestamp && (
              <p className="mt-2 text-xs text-rose-700">
                Kiểm tra lúc: {formatDateTimeVN(timestamp)}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={isBusy}
          onClick={onRetry}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconRefresh size={16} className={isBusy ? 'animate-spin' : ''} />
          <span>Thử lại</span>
        </button>
      </div>
    </div>
  );
}

function HealthSummaryGrid({ payload }: { payload: HealthPayload }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Trạng thái Ứng dụng</span>
          <IconServer size={18} className="text-emerald-600" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            <IconCheck size={14} />
            {payload.status}
          </span>
          <span className="text-xs text-slate-500">({payload.environment ?? 'dev'})</span>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Cơ sở dữ liệu MySQL</span>
          <IconDatabase size={18} className="text-blue-600" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-900">{payload.database.status}</span>
          {payload.database.latencyMs !== null && (
            <span className="text-xs text-slate-500">
              Độ trễ: {payload.database.latencyMs} ms
            </span>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm text-slate-500">Thời điểm kiểm tra gần nhất</div>
        <div className="mt-3 text-lg font-semibold text-slate-900">
          {formatDateTimeVN(payload.timestamp)}
        </div>
      </article>
    </div>
  );
}

function ModuleRegistrySection({
  modules,
  isBusy,
  onReload,
}: {
  modules: HealthModuleItem[];
  isBusy: boolean;
  onReload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          Phân hệ đã đăng ký (Module Registry)
        </h2>
        <span className="text-xs text-slate-500">{modules.length} phân hệ</span>
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <IconInbox size={32} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Chưa có phân hệ nào được kích hoạt
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kiểm tra lại cấu hình Module Registry hoặc tải lại trạng thái hệ thống.
          </p>
          <button
            type="button"
            disabled={isBusy}
            onClick={onReload}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <IconRefresh size={14} />
            <span>Tải lại</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {modules.map((mod) => (
            <article
              key={mod.code}
              className="flex flex-col justify-between rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900" title={mod.name}>
                    {mod.name}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${getModuleBadgeClass(mod.status)}`}
                  >
                    {MODULE_STATUS_LABELS[mod.status]}
                  </span>
                </div>
                {mod.description && (
                  <p
                    className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600"
                    title={mod.description}
                  >
                    {mod.description}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                <span className="font-mono">{mod.code}</span>
                <span>{mod.basePath ?? '-'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function SystemStatusCard() {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyHealthResult = useCallback(
    (result: { ok: boolean; payload: HealthPayload | null; errorMessage: string }) => {
      setPayload(result.payload);
      setErrorMessage(result.errorMessage);
      setViewState(result.ok ? 'success' : 'error');
    },
    [],
  );

  const handleManualRefresh = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRefreshing(true);

    requestHealthStatus(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          applyHealthResult(result);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setPayload(null);
        setErrorMessage('Không thể gọi API kiểm tra trạng thái hệ thống. Vui lòng thử lại.');
        setViewState('error');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsRefreshing(false);
        }
      });
  }, [applyHealthResult]);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    requestHealthStatus(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          applyHealthResult(result);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setPayload(null);
        setErrorMessage('Không thể gọi API kiểm tra trạng thái hệ thống. Vui lòng thử lại.');
        setViewState('error');
      });

    return () => {
      controller.abort();
    };
  }, [applyHealthResult]);

  const isBusy = viewState === 'loading' || isRefreshing;
  const modules = payload?.modules ?? [];

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F172A] to-blue-600 text-cyan-300 shadow-sm">
            <IconBuildingSkyscraper size={26} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {payload?.app ?? 'Operon Hub'}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                v{payload?.version ?? '1.0.0'}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Cổng Quản lý Vận hành Doanh nghiệp SME — Kiến trúc đa phân hệ (HRM &amp; Mở rộng CRM)
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isBusy}
          onClick={handleManualRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <IconRefresh size={18} className={isBusy ? 'animate-spin' : ''} />
          <span>{isBusy ? 'Đang kiểm tra...' : 'Kiểm tra lại kết nối'}</span>
        </button>
      </header>

      {viewState === 'loading' && <HealthLoadingSkeleton />}

      {viewState === 'error' && (
        <HealthErrorBanner
          errorMessage={errorMessage}
          timestamp={payload?.timestamp}
          isBusy={isBusy}
          onRetry={handleManualRefresh}
        />
      )}

      {viewState === 'success' && payload && <HealthSummaryGrid payload={payload} />}

      {viewState !== 'loading' && (
        <ModuleRegistrySection
          modules={modules}
          isBusy={isBusy}
          onReload={handleManualRefresh}
        />
      )}
    </section>
  );
}
