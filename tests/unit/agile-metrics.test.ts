import { describe, expect, it } from 'vitest';
import {
  computeBurndownSeries,
  computeProjectEvm,
  computeVelocitySeries,
} from '@/lib/portable/agile-metrics';

describe('portable/agile-metrics', () => {
  it('computes ideal and actual burndown series across a sprint window', () => {
    const series = computeBurndownSeries({
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      asOfDate: '2026-11-03',
      tasks: [
        { effort: 8, completedDate: '2026-11-02' },
        { effort: 12, completedDate: null },
      ],
    });

    expect(series).toHaveLength(5);
    expect(series[0]).toMatchObject({ date: '2026-11-01', idealRemaining: 20, actualRemaining: 20 });
    expect(series[1]).toMatchObject({ date: '2026-11-02', idealRemaining: 15, actualRemaining: 12 });
    expect(series[2]).toMatchObject({ date: '2026-11-03', idealRemaining: 10, actualRemaining: 12 });
    expect(series[3].actualRemaining).toBeNull();
    expect(series[4]).toMatchObject({ date: '2026-11-05', idealRemaining: 0, actualRemaining: null });
  });

  it('computes sprint velocity and average completion rate', () => {
    const result = computeVelocitySeries([
      { sprintId: 1, name: 'Sprint 1', committedPoints: 20, completedPoints: 18 },
      { sprintId: 2, name: 'Sprint 2', committedPoints: 25, completedPoints: 25 },
    ]);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].completionRate).toBe(90);
    expect(result.items[1].completionRate).toBe(100);
    expect(result.averageVelocity).toBe(21.5);
    expect(result.averageCompletionRate).toBe(95);
  });

  it('computes Earned Value Management (EVM) and burn rate accurately', () => {
    const evm = computeProjectEvm({
      plannedBudget: 100_000_000,
      actualCost: 40_000_000,
      progressPercent: 50,
      plannedProgressPercent: 60,
    });

    expect(evm.earnedValue).toBe(50_000_000);
    expect(evm.plannedValue).toBe(60_000_000);
    expect(evm.costVariance).toBe(10_000_000);
    expect(evm.scheduleVariance).toBe(-10_000_000);
    expect(evm.costPerformanceIndex).toBe(1.25);
    expect(evm.burnRatePercent).toBe(40);
  });
});
