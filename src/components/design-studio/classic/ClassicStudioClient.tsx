'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconColumns3,
  IconLayoutGrid,
  IconPalette,
  IconX,
} from '@tabler/icons-react';
import { DesignStudioClient } from '../DesignStudioClient';
import { CLASSIC_THEME_SPECS, type ClassicThemeId } from './classic-themes';
import { ClassicThemeFrame, type ClassicPreviewMode } from './ClassicThemeFrame';

interface ClassicStudioClientProps {
  allowLegacySwitch?: boolean;
}

export function ClassicStudioClient({ allowLegacySwitch = true }: ClassicStudioClientProps) {
  const [studioMode, setStudioMode] = useState<'classic' | 'legacy'>('classic');
  const [selectedId, setSelectedId] = useState<ClassicThemeId>('precision-grid');
  const [previewMode, setPreviewMode] = useState<ClassicPreviewMode>('all');
  const [isInfoExpanded, setIsInfoExpanded] = useState(true);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [pickedTheme, setPickedTheme] = useState<ClassicThemeId | null>('precision-grid');

  const currentTheme =
    CLASSIC_THEME_SPECS.find((item) => item.id === selectedId) ?? CLASSIC_THEME_SPECS[0];

  useEffect(() => {
    if (studioMode !== 'classic') return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const idx = Number(event.key);
      if (idx >= 1 && idx <= CLASSIC_THEME_SPECS.length) {
        setSelectedId(CLASSIC_THEME_SPECS[idx - 1].id);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [studioMode]);

  if (studioMode === 'legacy') {
    return (
      <div className="min-h-screen w-full">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-200">
          <span>Đang xem bộ 5 giao diện bản cũ (Legacy Studio)</span>
          <button
            type="button"
            onClick={() => setStudioMode('classic')}
            className="rounded-md bg-white px-3 py-1 font-semibold text-zinc-900 hover:bg-zinc-200"
          >
            ← Quay lại 5 Template Classic Hiện đại
          </button>
        </div>
        <DesignStudioClient />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950">
      {/* Sticky Minimal Studio Control Bar */}
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 text-zinc-100 backdrop-blur-xs">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <IconArrowLeft size={14} />
              <span>Portal</span>
            </Link>
            <div className="flex items-center gap-2">
              <IconPalette size={16} className="text-zinc-300" />
              <span className="text-xs font-semibold tracking-tight text-white sm:text-sm">
                Classic Modern Studio (5 Templates)
              </span>
            </div>
            <span className="hidden rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 xl:inline">
              Phím 1–5 để chuyển nhanh
            </span>
          </div>

          {/* 5 Classic Template Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CLASSIC_THEME_SPECS.map((spec) => {
              const active = spec.id === selectedId;
              const isPicked = pickedTheme === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelectedId(spec.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-white text-zinc-950 font-semibold'
                      : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/20"
                    style={{ backgroundColor: spec.palette.primary }}
                  />
                  <span>
                    {spec.index}. {spec.name}
                  </span>
                  {isPicked && <IconCheck size={12} className="text-emerald-600" />}
                </button>
              );
            })}
          </div>

          {/* Right Controls: View Scope, Compare & Legacy */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-[11px]">
              {(
                [
                  ['all', 'Đầy đủ'],
                  ['workspace', 'Màn hình thực tế'],
                  ['elements', 'Bộ Element'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded px-2.5 py-1 font-medium transition ${
                    previewMode === mode
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              <IconColumns3 size={14} />
              <span className="hidden sm:inline">So sánh 5 mẫu</span>
            </button>

            {allowLegacySwitch && (
              <button
                type="button"
                onClick={() => setStudioMode('legacy')}
                className="hidden items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 2xl:inline-flex"
              >
                <IconLayoutGrid size={13} />
                <span>Bản cũ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsInfoExpanded((v) => !v)}
              className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-white"
              aria-label="Thu gọn hoặc mở rộng mô tả"
            >
              {isInfoExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Collapsible Template Rationale Strip */}
        {isInfoExpanded && (
          <div className="border-t border-zinc-800/90 bg-zinc-900/90 px-4 py-2 text-xs sm:px-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div>
                  <span className="font-semibold text-white">
                    Mẫu #{currentTheme.index}: {currentTheme.name}
                  </span>
                  <span className="mx-2 text-zinc-600">|</span>
                  <span className="text-zinc-300">{currentTheme.subtitle}</span>
                </div>
                <span className="hidden text-[11px] text-zinc-400 lg:inline">
                  {currentTheme.navigationSummary}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-1 sm:flex">
                  {Object.entries(currentTheme.palette).map(([k, hex]) => (
                    <span
                      key={k}
                      title={`${k}: ${hex}`}
                      className="h-4 w-4 rounded-xs border border-white/20"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPickedTheme(currentTheme.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                    pickedTheme === currentTheme.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-zinc-950 hover:bg-zinc-200'
                  }`}
                >
                  <IconCheck size={13} />
                  <span>
                    {pickedTheme === currentTheme.id
                      ? `Đã chốt xem Mẫu #${currentTheme.index} (${currentTheme.name})`
                      : `Đánh dấu chọn Mẫu #${currentTheme.index}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Full-Viewport Template Canvas */}
      <ClassicThemeFrame theme={currentTheme} previewMode={previewMode} />

      {/* Side-by-Side Comparison Modal */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-zinc-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  So sánh 5 Template Giao diện Classic Hiện đại cho Operon Hub
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Cả 5 mẫu đều tối giản, tiết chế màu sắc, toàn chiều rộng (Full-Width) và phủ toàn bộ element hệ thống.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CLASSIC_THEME_SPECS.map((spec) => {
                const isSelected = spec.id === selectedId;
                return (
                  <div
                    key={spec.id}
                    className={`flex flex-col justify-between rounded-lg border p-4 ${
                      isSelected
                        ? 'border-white bg-zinc-800/80'
                        : 'border-zinc-800 bg-zinc-950/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          {spec.index}. {spec.name}
                        </span>
                        <div className="flex gap-1">
                          {Object.values(spec.palette).map((hex, idx) => (
                            <span
                              key={`${spec.id}-${idx}`}
                              className="h-3.5 w-3.5 rounded-xs border border-white/25"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-zinc-300">{spec.subtitle}</p>
                      <p className="mt-2.5 text-[11px] text-zinc-400">
                        <strong className="text-zinc-200">Điều hướng:</strong> {spec.navigationSummary}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        <strong className="text-zinc-200">Mật độ:</strong> {spec.densityLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        <strong className="text-zinc-200">Phù hợp:</strong> {spec.bestFor}
                      </p>
                      <ul className="mt-3 space-y-1 text-[11px] text-zinc-300">
                        {spec.highlights.map((hl) => (
                          <li key={hl} className="flex items-start gap-1.5">
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                            <span>{hl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(spec.id);
                        setIsCompareOpen(false);
                      }}
                      className={`mt-4 w-full rounded-md py-2 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-white text-zinc-950'
                          : 'border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {isSelected ? 'Đang xem mẫu này' : `Mở xem Mẫu #${spec.index}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
