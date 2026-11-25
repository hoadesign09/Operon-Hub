/**
 * Thuật toán thuần túy tính chỉ số Agile & Quản trị Dự án: Burndown Chart, Sprint Velocity và EVM cơ bản.
 * Không phụ thuộc nghiệp vụ dự án (Zero Business Coupling).
 *
 * Dependencies: None
 * Input / Output:
 *   - computeBurndownSeries(input) => BurndownPoint[]
 *   - computeVelocitySeries(sprints) => VelocitySeriesResult
 *   - computeProjectEvm(input) => ProjectEvmMetrics
 *
 * Ví dụ:
 * ```ts
 * const points = computeBurndownSeries({
 *   startDate: '2026-11-01',
 *   endDate: '2026-11-14',
 *   tasks: [{ effort: 5, completedDate: '2026-11-03' }, { effort: 8, completedDate: null }],
 * });
 * ```
 */

export interface BurndownTaskSample {
  effort: number;
  completedDate: string | null;
}

export interface BurndownInput {
  startDate: string;
  endDate: string;
  tasks: readonly BurndownTaskSample[];
  asOfDate?: string;
}

export interface BurndownPoint {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
  completedCumulative: number;
}

export interface VelocitySprintSample {
  sprintId: number | string;
  name: string;
  committedPoints: number;
  completedPoints: number;
}

export interface VelocitySeriesItem {
  sprintId: number | string;
  name: string;
  committedPoints: number;
  completedPoints: number;
  completionRate: number;
}

export interface VelocitySeriesResult {
  items: VelocitySeriesItem[];
  averageVelocity: number;
  averageCompletionRate: number;
}

export interface ProjectEvmInput {
  plannedBudget: number;
  actualCost: number;
  progressPercent: number;
  plannedProgressPercent?: number;
}

export interface ProjectEvmMetrics {
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  scheduleVariance: number;
  costPerformanceIndex: number | null;
  schedulePerformanceIndex: number | null;
  burnRatePercent: number;
}

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseIsoDayUtc(iso: string): Date {
  const clean = iso.slice(0, 10);
  const [y, m, d] = clean.split('-').map((n) => Number(n));
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
}

function formatIsoDayUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function computeBurndownSeries(input: BurndownInput): BurndownPoint[] {
  const start = parseIsoDayUtc(input.startDate);
  const end = parseIsoDayUtc(input.endDate);
  if (end.getTime() < start.getTime()) {
    return [];
  }

  const totalEffort = roundTwo(
    input.tasks.reduce((sum, item) => sum + Math.max(0, Number(item.effort) || 0), 0),
  );
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const asOfIso = input.asOfDate ? input.asOfDate.slice(0, 10) : null;

  const series: BurndownPoint[] = [];
  for (let dayIdx = 0; dayIdx <= totalDays; dayIdx += 1) {
    const currentDate = addDaysUtc(start, dayIdx);
    const currentIso = formatIsoDayUtc(currentDate);
    const idealRemaining = roundTwo(
      Math.max(0, totalEffort - (totalEffort * dayIdx) / totalDays),
    );

    const isFutureDay = asOfIso !== null && currentIso > asOfIso;
    let completedCumulative = 0;
    if (!isFutureDay) {
      for (const task of input.tasks) {
        const eff = Math.max(0, Number(task.effort) || 0);
        if (task.completedDate && task.completedDate.slice(0, 10) <= currentIso) {
          completedCumulative += eff;
        }
      }
    }
    completedCumulative = roundTwo(completedCumulative);

    series.push({
      date: currentIso,
      idealRemaining,
      actualRemaining: isFutureDay ? null : roundTwo(Math.max(0, totalEffort - completedCumulative)),
      completedCumulative,
    });
  }

  return series;
}

export function computeVelocitySeries(
  sprints: readonly VelocitySprintSample[],
): VelocitySeriesResult {
  if (sprints.length === 0) {
    return { items: [], averageVelocity: 0, averageCompletionRate: 0 };
  }

  const items: VelocitySeriesItem[] = sprints.map((s) => {
    const committed = Math.max(0, Number(s.committedPoints) || 0);
    const completed = Math.max(0, Number(s.completedPoints) || 0);
    const completionRate = committed > 0 ? roundTwo((completed / committed) * 100) : 0;
    return {
      sprintId: s.sprintId,
      name: s.name,
      committedPoints: roundTwo(committed),
      completedPoints: roundTwo(completed),
      completionRate,
    };
  });

  const avgVel = roundTwo(
    items.reduce((sum, item) => sum + item.completedPoints, 0) / items.length,
  );
  const avgRate = roundTwo(
    items.reduce((sum, item) => sum + item.completionRate, 0) / items.length,
  );

  return {
    items,
    averageVelocity: avgVel,
    averageCompletionRate: avgRate,
  };
}

export function computeProjectEvm(input: ProjectEvmInput): ProjectEvmMetrics {
  const budget = Math.max(0, Number(input.plannedBudget) || 0);
  const actualCost = Math.max(0, Number(input.actualCost) || 0);
  const progress = Math.min(100, Math.max(0, Number(input.progressPercent) || 0));
  const plannedProgress =
    input.plannedProgressPercent !== undefined
      ? Math.min(100, Math.max(0, Number(input.plannedProgressPercent) || 0))
      : progress;

  const plannedValue = roundTwo((budget * plannedProgress) / 100);
  const earnedValue = roundTwo((budget * progress) / 100);
  const costVariance = roundTwo(earnedValue - actualCost);
  const scheduleVariance = roundTwo(earnedValue - plannedValue);
  const costPerformanceIndex = actualCost > 0 ? roundTwo(earnedValue / actualCost) : null;
  const schedulePerformanceIndex = plannedValue > 0 ? roundTwo(earnedValue / plannedValue) : null;
  const burnRatePercent = budget > 0 ? roundTwo((actualCost / budget) * 100) : 0;

  return {
    plannedValue,
    earnedValue,
    actualCost: roundTwo(actualCost),
    costVariance,
    scheduleVariance,
    costPerformanceIndex,
    schedulePerformanceIndex,
    burnRatePercent,
  };
}
