'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconPlayerStop, IconStopwatch } from '@tabler/icons-react';
import type { TimeLogItemView } from '@/modules/projects/timelogs.service';
import { useI18n } from '@/shared/i18n/I18nContext';

function formatElapsed(startedAtIso: string | null, nowMs: number): string {
  if (!startedAtIso) return '00:00';
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(startedAtIso).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function QuickTimerWidget() {
  const { tr } = useI18n();
  const [activeTimer, setActiveTimer] = useState<TimeLogItemView | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadTimer() {
      try {
        const res = await fetch('/api/v1/pm/timelogs/timer');
        if (!res.ok) return;
        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: TimeLogItemView | null;
        } | null;
        if (mounted && json?.success) {
          setActiveTimer(json.data ?? null);
        }
      } catch {
        // Non-blocking widget
      }
    }

    void loadTimer();
    const onRefresh = () => {
      void loadTimer();
    };
    window.addEventListener('operon-timer-updated', onRefresh);
    const poll = window.setInterval(() => {
      void loadTimer();
    }, 60000);
    return () => {
      mounted = false;
      window.removeEventListener('operon-timer-updated', onRefresh);
      window.clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!activeTimer) return;
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [activeTimer]);

  if (!activeTimer) {
    return null;
  }

  async function handleStop() {
    if (!activeTimer || stopping) return;
    setStopping(true);
    try {
      const res = await fetch('/api/v1/pm/timelogs/timer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: activeTimer.id }),
      });
      if (res.ok) {
        setActiveTimer(null);
        window.dispatchEvent(new Event('operon-timer-updated'));
      }
    } finally {
      setStopping(false);
    }
  }

  return (
    <div
      className={`inline-flex h-8 items-center gap-2 rounded border px-2 text-xs font-semibold ${
        activeTimer.exceededWarningHours
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800'
      }`}
    >
      <IconStopwatch size={14} className="animate-pulse" />
      <Link
        href={`/projects/${activeTimer.projectCode}?taskId=${activeTimer.taskId}`}
        className="max-w-[120px] truncate hover:underline"
        title={`${activeTimer.taskKey} — ${activeTimer.taskTitle}`}
      >
        {activeTimer.taskKey}
      </Link>
      <span className="font-mono text-[11px] tabular-nums">
        {formatElapsed(activeTimer.startedAt, nowMs)}
      </span>
      {activeTimer.exceededWarningHours && (
        <span title={tr('Timer đã chạy quá 12 giờ', 'Timer running over 12 hours')}>
          <IconAlertTriangle size={13} className="text-red-600" />
        </span>
      )}
      <button
        type="button"
        disabled={stopping}
        onClick={() => void handleStop()}
        className="inline-flex items-center gap-0.5 rounded-xs bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        title={tr('Dừng bấm giờ', 'Stop timer')}
      >
        <IconPlayerStop size={11} />
        {tr('Dừng', 'Stop')}
      </button>
    </div>
  );
}
