/**
 * Precision Grid Reusable Skeleton Loading UI Kit
 * Dependencies: React, Tailwind CSS, .pg-skeleton in globals.css
 * Purpose: Provide consistent, accessible, zero-layout-shift skeleton loading states
 * across all Operon Hub pages, tables, cards, lists, modals, drawers, and shell chrome.
 */

import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'none' | 'xs' | 'sm' | 'full';
  tone?: 'light' | 'dark';
}

const ROUNDED_MAP: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded',
  full: 'rounded-full',
};

export function Skeleton({
  className = '',
  rounded = 'xs',
  tone = 'light',
  ...rest
}: SkeletonProps) {
  const toneClass = tone === 'dark' ? 'pg-skeleton-dark' : 'pg-skeleton';
  return (
    <div
      aria-hidden="true"
      className={`${toneClass} ${ROUNDED_MAP[rounded]} ${className}`.trim()}
      {...rest}
    />
  );
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = 'w-2/3',
  className = '',
}: {
  lines?: number;
  lastLineWidth?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, idx) => (
        <Skeleton
          key={idx}
          className={`h-3 ${idx === lines - 1 ? lastLineWidth : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonKpiGrid({
  count = 4,
  columnsClass = 'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4',
  compact = false,
  className = '',
}: {
  count?: number;
  columnsClass?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading metrics"
      className={`grid ${columnsClass} ${className}`.trim()}
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className={`rounded border border-[#CFD6DF] bg-white ${compact ? 'p-3.5' : 'p-4'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className={compact ? 'h-3 w-24' : 'h-8 w-8'} rounded="sm" />
            <Skeleton className="h-4 w-16" rounded="full" />
          </div>
          <div className={compact ? 'mt-2.5 space-y-1.5' : 'mt-3.5 space-y-2'}>
            <Skeleton className={compact ? 'h-6 w-20' : 'h-7 w-28'} />
            <Skeleton className="h-3 w-32" />
            {!compact && <Skeleton className="h-2.5 w-40" />}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

const DEFAULT_COL_WIDTHS = ['w-24', 'w-44', 'w-32', 'w-28', 'w-20', 'w-24', 'w-16', 'w-20'];

export function SkeletonTableRows({
  rows = 6,
  columns,
  columnWidths,
  showCheckbox = false,
}: {
  rows?: number;
  columns: number;
  columnWidths?: string[];
  showCheckbox?: boolean;
}) {
  const safeCols = Math.max(1, columns);
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={`sk-row-${rowIdx}`} aria-hidden="true" className="pointer-events-none">
          {Array.from({ length: safeCols }, (_, colIdx) => {
            if (showCheckbox && colIdx === 0) {
              return (
                <td key={`sk-cell-${rowIdx}-${colIdx}`} className="px-3 py-2.5">
                  <Skeleton className="h-4 w-4" rounded="xs" />
                </td>
              );
            }
            const widthClass =
              columnWidths?.[colIdx] ??
              DEFAULT_COL_WIDTHS[(colIdx + rowIdx) % DEFAULT_COL_WIDTHS.length];
            return (
              <td key={`sk-cell-${rowIdx}-${colIdx}`} className="px-3 py-2.5">
                <div className="space-y-1.5">
                  <Skeleton className={`h-3.5 max-w-full ${widthClass}`} />
                  {colIdx === (showCheckbox ? 2 : 1) && (
                    <Skeleton className="h-2.5 w-24 max-w-full opacity-75" />
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTable({
  rows = 6,
  columns = 6,
  showToolbar = true,
  showPagination = true,
  className = '',
}: {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
  showPagination?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table"
      className={`overflow-hidden rounded border border-[#CFD6DF] bg-white ${className}`.trim()}
    >
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CFD6DF] bg-[#F8F9FB] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-52" rounded="sm" />
            <Skeleton className="h-8 w-32" rounded="sm" />
            <Skeleton className="h-8 w-28" rounded="sm" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24" rounded="sm" />
            <Skeleton className="h-8 w-28" rounded="sm" />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[#CFD6DF] bg-[#F1F4F8]">
              {Array.from({ length: columns }, (_, idx) => (
                <th key={`sk-th-${idx}`} className="px-3 py-2.5 text-left">
                  <Skeleton className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SkeletonTableRows rows={rows} columns={columns} />
          </tbody>
        </table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between border-t border-[#CFD6DF] bg-[#F8F9FB] px-4 py-2.5">
          <Skeleton className="h-3.5 w-40" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-7 w-7" rounded="sm" />
            <Skeleton className="h-7 w-7" rounded="sm" />
            <Skeleton className="h-7 w-7" rounded="sm" />
          </div>
        </div>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonCardGrid({
  count = 6,
  columnsClass = 'grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  lines = 2,
  showBadge = true,
  showFooter = true,
  className = '',
}: {
  count?: number;
  columnsClass?: string;
  lines?: number;
  showBadge?: boolean;
  showFooter?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading cards"
      className={`grid ${columnsClass} ${className}`.trim()}
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={`sk-card-${idx}`}
          className="flex flex-col justify-between rounded border border-[#CFD6DF] bg-white p-4"
        >
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 shrink-0" rounded="sm" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              </div>
              {showBadge && <Skeleton className="h-5 w-16 shrink-0" rounded="full" />}
            </div>
            <SkeletonText lines={lines} className="mt-3.5" />
          </div>
          {showFooter && (
            <div className="mt-4 flex items-center justify-between border-t border-[#E2E7EE] pt-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" rounded="sm" />
            </div>
          )}
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonListRows({
  rows = 4,
  showAvatar = false,
  showMeta = true,
  compact = false,
  divided = true,
  className = '',
}: {
  rows?: number;
  showAvatar?: boolean;
  showMeta?: boolean;
  compact?: boolean;
  divided?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading list"
      className={`${divided ? 'divide-y divide-[#E2E7EE]' : 'space-y-2'} ${className}`.trim()}
    >
      {Array.from({ length: rows }, (_, idx) => (
        <div
          key={`sk-list-${idx}`}
          className={`flex items-center justify-between gap-3 ${
            divided ? (compact ? 'py-2.5' : 'py-3') : 'rounded border border-[#E2E7EE] bg-white p-3'
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {showAvatar && (
              <Skeleton className={compact ? 'h-7 w-7 shrink-0' : 'h-9 w-9 shrink-0'} rounded="full" />
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className={`h-3.5 ${idx % 2 === 0 ? 'w-3/4' : 'w-2/3'}`} />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
          {showMeta && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-16" rounded="full" />
              {!compact && <Skeleton className="h-2.5 w-12" />}
            </div>
          )}
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonFormFields({
  fields = 6,
  columns = 2,
  showActions = true,
  className = '',
}: {
  fields?: number;
  columns?: 1 | 2;
  showActions?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading form"
      className={`space-y-4 ${className}`.trim()}
    >
      <div className={`grid grid-cols-1 gap-3.5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {Array.from({ length: fields }, (_, idx) => (
          <div key={`sk-field-${idx}`} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" rounded="sm" />
          </div>
        ))}
      </div>
      {showActions && (
        <div className="flex justify-end gap-2 border-t border-[#E2E7EE] pt-3">
          <Skeleton className="h-8 w-20" rounded="sm" />
          <Skeleton className="h-8 w-28" rounded="sm" />
        </div>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonDetailPage({
  showKpis = true,
  kpiCount = 4,
  showTabs = false,
  showBottomWorkflow = true,
  showSidebarCard = true,
  className = '',
}: {
  showKpis?: boolean;
  kpiCount?: number;
  showTabs?: boolean;
  showBottomWorkflow?: boolean;
  showSidebarCard?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading detail"
      className={`w-full space-y-5 ${className}`.trim()}
    >
      {/* Breadcrumb & Header Card */}
      <div className="rounded border border-[#CFD6DF] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-20" rounded="full" />
              <Skeleton className="h-5 w-24" rounded="full" />
            </div>
            <Skeleton className="h-6 w-72 max-w-full" />
            <Skeleton className="h-3 w-96 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-24" rounded="sm" />
            <Skeleton className="h-8 w-28" rounded="sm" />
            <Skeleton className="h-8 w-28" rounded="sm" />
          </div>
        </div>
      </div>

      {showKpis && (
        <SkeletonKpiGrid
          count={kpiCount}
          compact
          columnsClass={
            kpiCount === 3
              ? 'grid-cols-1 gap-3 sm:grid-cols-3'
              : 'grid-cols-2 gap-3 lg:grid-cols-4'
          }
        />
      )}

      {showTabs && (
        <div className="flex flex-wrap gap-2 border-b border-[#CFD6DF] pb-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24" rounded="sm" />
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className={`grid grid-cols-1 gap-5 ${showSidebarCard ? 'lg:grid-cols-3' : ''}`}>
        <div className={`space-y-4 ${showSidebarCard ? 'lg:col-span-2' : ''}`}>
          <div className="rounded border border-[#CFD6DF] bg-white p-5">
            <Skeleton className="mb-4 h-4 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-4 w-44 max-w-full" />
                </div>
              ))}
            </div>
          </div>
          <SkeletonTable rows={4} columns={5} showToolbar={false} showPagination={false} />
        </div>

        {showSidebarCard && (
          <div className="space-y-4">
            <div className="rounded border border-[#CFD6DF] bg-white p-4">
              <Skeleton className="mb-3 h-4 w-32" />
              <SkeletonListRows rows={3} compact showAvatar />
            </div>
            <div className="rounded border border-[#CFD6DF] bg-white p-4">
              <Skeleton className="mb-3 h-4 w-36" />
              <SkeletonText lines={4} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Full-Width Approval / Timeline Block */}
      {showBottomWorkflow && (
        <div className="w-full rounded border border-[#CFD6DF] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-24" rounded="full" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((step) => (
              <div key={step} className="rounded border border-[#E2E7EE] bg-[#F8F9FB] p-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6" rounded="full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="mt-2.5 h-3 w-36" />
                <Skeleton className="mt-1.5 h-2.5 w-24" />
              </div>
            ))}
          </div>
        </div>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonOrgTree({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading organization chart"
      className={`rounded border border-[#CFD6DF] bg-white p-6 ${className}`.trim()}
    >
      <div className="flex flex-col items-center">
        {/* Root Node */}
        <div className="w-64 rounded border border-[#CFD6DF] bg-[#F8F9FB] p-3.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0" rounded="full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        </div>
        <div className="h-6 w-px bg-[#CFD6DF]" />
        <div className="hidden h-px w-3/4 bg-[#CFD6DF] md:block" />
        {/* Branch Nodes */}
        <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((branch) => (
            <div key={branch} className="space-y-3 rounded border border-[#E2E7EE] bg-[#F8F9FB] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" rounded="full" />
              </div>
              <SkeletonListRows rows={2} compact showAvatar />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonKanbanBoard({
  columns = 4,
  cardsPerColumn = 3,
  className = '',
}: {
  columns?: number;
  cardsPerColumn?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading board"
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 ${className}`.trim()}
    >
      {Array.from({ length: columns }, (_, colIdx) => (
        <div
          key={`sk-col-${colIdx}`}
          className="rounded border border-[#CFD6DF] bg-[#F8F9FB] p-3"
        >
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-8" rounded="full" />
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: cardsPerColumn }, (_, cardIdx) => (
              <div
                key={`sk-kcard-${colIdx}-${cardIdx}`}
                className="rounded border border-[#CFD6DF] bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" rounded="full" />
                </div>
                <Skeleton className="mt-2 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3 w-3/4" />
                <div className="mt-3 flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-5" rounded="full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonGanttChart({
  rows = 6,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  const barOffsets = ['ml-[5%] w-[32%]', 'ml-[18%] w-[40%]', 'ml-[10%] w-[28%]', 'ml-[35%] w-[35%]', 'ml-[22%] w-[45%]', 'ml-[45%] w-[30%]'];
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading timeline"
      className={`overflow-hidden rounded border border-[#CFD6DF] bg-white ${className}`.trim()}
    >
      <div className="grid grid-cols-12 border-b border-[#CFD6DF] bg-[#F1F4F8] px-4 py-2.5">
        <div className="col-span-4">
          <Skeleton className="h-3.5 w-28" />
        </div>
        <div className="col-span-8 flex justify-between gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-3 w-10" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#E2E7EE]">
        {Array.from({ length: rows }, (_, idx) => (
          <div key={`sk-gantt-${idx}`} className="grid grid-cols-12 items-center px-4 py-3">
            <div className="col-span-4 space-y-1.5 pr-4">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <div className="col-span-8">
              <Skeleton className={`h-5 ${barOffsets[idx % barOffsets.length]}`} rounded="sm" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonCalendarGrid({
  rows = 5,
  cols = 7,
  className = '',
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading calendar"
      className={`overflow-hidden rounded border border-[#CFD6DF] bg-white ${className}`.trim()}
    >
      <div className="grid grid-cols-7 border-b border-[#CFD6DF] bg-[#F1F4F8]">
        {Array.from({ length: cols }, (_, i) => (
          <div key={`sk-dow-${i}`} className="border-r border-[#E2E7EE] px-2 py-2 last:border-r-0">
            <Skeleton className="mx-auto h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: rows * cols }, (_, i) => (
          <div
            key={`sk-day-${i}`}
            className="min-h-[76px] border-r border-b border-[#E2E7EE] p-2"
          >
            <Skeleton className="h-3 w-5" />
            {i % 3 === 0 && <Skeleton className="mt-2 h-4 w-full" rounded="xs" />}
            {i % 5 === 1 && <Skeleton className="mt-1.5 h-3.5 w-3/4" rounded="xs" />}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonDashboard({
  showBanner = false,
  className = '',
}: {
  showBanner?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
      className={`w-full space-y-5 ${className}`.trim()}
    >
      {showBanner && (
        <div className="rounded border border-[#163D6B] bg-[#1D4E89] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton tone="dark" className="h-3 w-36" />
              <Skeleton tone="dark" className="h-6 w-60" />
              <Skeleton tone="dark" className="h-3 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton tone="dark" className="h-8 w-24" rounded="sm" />
              <Skeleton tone="dark" className="h-8 w-24" rounded="sm" />
            </div>
          </div>
        </div>
      )}

      <SkeletonKpiGrid
        count={6}
        columnsClass="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[1, 2].map((chart) => (
          <div key={chart} className="rounded border border-[#CFD6DF] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20" rounded="full" />
            </div>
            <div className="flex h-52 items-end gap-3 pt-4">
              {[42, 68, 55, 84, 60, 74, 48, 90].map((pct, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <Skeleton className="w-full" style={{ height: `${pct}%` }} rounded="xs" />
                  </div>
                  <Skeleton className="h-2.5 w-6 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[1, 2, 3].map((panel) => (
          <div key={panel} className="rounded border border-[#CFD6DF] bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-16" />
            </div>
            <SkeletonListRows rows={3} compact />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export type SkeletonPageVariant =
  | 'table'
  | 'dashboard'
  | 'detail'
  | 'cards'
  | 'org'
  | 'kanban'
  | 'calendar'
  | 'split';

export function SkeletonPage({
  variant = 'table',
  showKpis = true,
  className = '',
}: {
  variant?: SkeletonPageVariant;
  showKpis?: boolean;
  className?: string;
}) {
  if (variant === 'dashboard') {
    return <SkeletonDashboard showBanner className={className} />;
  }
  if (variant === 'detail') {
    return <SkeletonDetailPage className={className} />;
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className={`w-full space-y-5 ${className}`.trim()}
    >
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#CFD6DF] bg-white px-5 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" rounded="sm" />
          <Skeleton className="h-8 w-32" rounded="sm" />
        </div>
      </div>

      {showKpis && <SkeletonKpiGrid count={4} compact />}

      {variant === 'cards' && <SkeletonCardGrid count={6} />}
      {variant === 'org' && <SkeletonOrgTree />}
      {variant === 'kanban' && <SkeletonKanbanBoard />}
      {variant === 'calendar' && <SkeletonCalendarGrid />}
      {variant === 'split' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="rounded border border-[#CFD6DF] bg-white p-4">
              <SkeletonListRows rows={6} showAvatar />
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded border border-[#CFD6DF] bg-white p-5">
              <SkeletonFormFields fields={6} />
            </div>
          </div>
        </div>
      )}
      {variant === 'table' && <SkeletonTable rows={7} columns={6} />}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function SkeletonPortalShell() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading workspace"
      className="portal-precision-grid flex min-h-screen w-full bg-[#EFF1F4] text-slate-900"
    >
      {/* Left Precision Grid Sidebar Skeleton (228px) */}
      <aside className="hidden h-screen w-[228px] shrink-0 flex-col border-r border-[#CFD6DF] bg-[#F8F9FB] lg:flex">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-[#CFD6DF] bg-white px-3.5">
          <Skeleton className="h-7 w-7 shrink-0" rounded="sm" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-hidden px-3 py-3">
          {[4, 5, 4, 3].map((count, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-2 px-1 py-1">
                  <Skeleton className="h-4 w-4 shrink-0" rounded="xs" />
                  <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-28' : 'w-24'}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-[#CFD6DF] bg-white p-2.5">
          <div className="flex items-center gap-2.5 p-1">
            <Skeleton className="h-7 w-7 shrink-0" rounded="full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Shell Skeleton */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-3 border-b border-[#CFD6DF] bg-white px-4 sm:px-5">
          <div className="space-y-1">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32" rounded="sm" />
            <Skeleton className="h-8 w-16" rounded="sm" />
            <Skeleton className="h-8 w-8" rounded="sm" />
            <Skeleton className="h-8 w-20" rounded="sm" />
          </div>
        </header>
        <main className="w-full min-w-0 flex-1 p-4 sm:p-5">
          <SkeletonPage variant="table" />
        </main>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
