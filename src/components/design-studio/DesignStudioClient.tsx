'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconColumns3,
  IconPalette,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';
import { PORTAL_THEME_SPECS, type PortalThemeId } from './showcase-data';
import { ThemeCompactErp } from './ThemeCompactErp';
import { ThemeMidnightCommand } from './ThemeMidnightCommand';
import { ThemeNordicExecutive } from './ThemeNordicExecutive';
import { ThemeObsidianDark } from './ThemeObsidianDark';
import { ThemeWarmCorporate } from './ThemeWarmCorporate';

export function DesignStudioClient() {
  const [selectedThemeId, setSelectedThemeId] = useState<PortalThemeId>('nordic-executive');
  const [isBarExpanded, setIsBarExpanded] = useState<boolean>(true);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [pickedFavorite, setPickedFavorite] = useState<PortalThemeId | null>(null);

  const currentSpec =
    PORTAL_THEME_SPECS.find((spec) => spec.id === selectedThemeId) ?? PORTAL_THEME_SPECS[0];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
      const num = Number(event.key);
      if (num >= 1 && num <= PORTAL_THEME_SPECS.length) {
        setSelectedThemeId(PORTAL_THEME_SPECS[num - 1].id);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function renderSelectedTheme() {
    switch (selectedThemeId) {
      case 'nordic-executive':
        return <ThemeNordicExecutive />;
      case 'midnight-command':
        return <ThemeMidnightCommand />;
      case 'warm-corporate':
        return <ThemeWarmCorporate />;
      case 'obsidian-dark':
        return <ThemeObsidianDark />;
      case 'compact-erp':
        return <ThemeCompactErp />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Studio Control Bar */}
      <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 text-slate-100 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <IconArrowLeft size={14} />
              <span>Portal</span>
            </Link>
            <div className="flex items-center gap-2">
              <IconPalette size={17} className="text-indigo-400" />
              <span className="text-xs font-bold tracking-wide text-white sm:text-sm">
                Operon Hub — UX/UI Design Studio
              </span>
            </div>
            <span className="hidden rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 md:inline">
              Phím tắt 1–5 để chuyển nhanh
            </span>
          </div>

          {/* 5 Theme Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PORTAL_THEME_SPECS.map((spec) => {
              const isSelected = spec.id === selectedThemeId;
              const isFav = pickedFavorite === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelectedThemeId(spec.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'bg-slate-900 text-slate-300 ring-1 ring-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
                    style={{ backgroundColor: spec.palette.primary }}
                  />
                  <span>
                    {spec.index}. {spec.name}
                  </span>
                  {isFav && <IconCheck size={12} className="text-emerald-300" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <IconColumns3 size={14} />
              <span>So sánh 5 phương án</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBarExpanded((v) => !v)}
              className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
              title={isBarExpanded ? 'Ẩn mô tả UX' : 'Hiện mô tả UX'}
            >
              {isBarExpanded ? <IconChevronUp size={15} /> : <IconChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* Collapsible UX Rationale Strip */}
        {isBarExpanded && (
          <div className="border-t border-slate-800/80 bg-slate-900/70">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-2.5 text-xs sm:px-6">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <div>
                  <span className="font-semibold text-indigo-300">
                    Phương án {currentSpec.index}: {currentSpec.name}
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span className="text-slate-300">{currentSpec.tagline}</span>
                </div>
                <div className="hidden text-[11px] text-slate-400 xl:block">
                  <strong className="text-slate-200">Điều hướng:</strong>{' '}
                  {currentSpec.navigationStyle}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-1.5 sm:flex">
                  {Object.entries(currentSpec.palette).map(([token, hex]) => (
                    <span
                      key={token}
                      title={`${token}: ${hex}`}
                      className="h-4 w-4 rounded border border-white/20"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPickedFavorite(currentSpec.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    pickedFavorite === currentSpec.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {pickedFavorite === currentSpec.id ? (
                    <>
                      <IconCheck size={14} />
                      <span>Đã đánh dấu phương án #{currentSpec.index}</span>
                    </>
                  ) : (
                    <>
                      <IconSparkles size={14} />
                      <span>Đánh dấu chọn phương án này</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Full-Viewport Theme Preview */}
      <div className="w-full">{renderSelectedTheme()}</div>

      {/* Comparison Matrix Modal */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Bảng So sánh 5 Phương án Giao diện UX/UI cho Operon Hub
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Mỗi phương án được thiết kế với kiến trúc điều hướng, bảng màu và mật độ dữ liệu riêng biệt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {PORTAL_THEME_SPECS.map((spec) => {
                const isSelected = spec.id === selectedThemeId;
                return (
                  <div
                    key={spec.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/30'
                        : 'border-slate-800 bg-slate-950/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {spec.index}. {spec.name}
                        </span>
                        <div className="flex gap-1">
                          {Object.values(spec.palette).map((hex) => (
                            <span
                              key={hex}
                              className="h-3.5 w-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-indigo-300">{spec.tagline}</p>
                      <p className="mt-2.5 text-[11px] text-slate-300">
                        <strong className="text-slate-100">Điều hướng:</strong>{' '}
                        {spec.navigationStyle}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        <strong className="text-slate-200">Phù hợp:</strong> {spec.bestFor}
                      </p>
                      <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
                        {spec.strengths.map((point) => (
                          <li key={point}>• {point}</li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedThemeId(spec.id);
                        setIsCompareOpen(false);
                      }}
                      className={`mt-4 w-full rounded-lg py-2 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-200 hover:bg-indigo-600 hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Đang xem phương án này' : `Xem trực tiếp Phương án #${spec.index}`}
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
