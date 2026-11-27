/**
 * Pure SLA & Service Desk Ticket State Machine Calculator (Cross-Project Portable).
 *
 * Purpose: Compute SLA response/resolution deadlines, evaluate live SLA compliance
 *          (ON_TRACK / AT_RISK / BREACHED / MET / PAUSED), validate ticket status transitions,
 *          and format sequential ticket codes with zero business or framework coupling.
 * Dependencies: None
 *
 * Example:
 *   const deadlines = calculateSlaDeadlines(new Date(), 4, 24, { priority: 'HIGH' });
 *   const status = evaluateSlaStatus({ dueAt: deadlines.resolutionDueAt, now: new Date() });
 */

export type SlaPriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SlaHealthStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET' | 'PAUSED' | 'NONE';

export type ServiceTicketStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_USER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED';

export interface SlaPriorityMultipliers {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  URGENT: number;
}

export interface CalculateSlaOptions {
  priority?: SlaPriorityLevel;
  multipliers?: Partial<SlaPriorityMultipliers>;
  pausedMinutes?: number;
  minHours?: number;
}

export interface SlaDeadlinesResult {
  effectiveResponseHours: number;
  effectiveResolutionHours: number;
  responseDueAt: Date;
  resolutionDueAt: Date;
}

export interface EvaluateSlaInput {
  dueAt: Date | string | null | undefined;
  completedAt?: Date | string | null;
  startedAt?: Date | string | null;
  now?: Date;
  isPaused?: boolean;
  atRiskRatio?: number;
  atRiskMinMinutes?: number;
}

export interface EvaluateSlaResult {
  status: SlaHealthStatus;
  remainingMinutes: number | null;
  overdueMinutes: number;
}

const DEFAULT_PRIORITY_MULTIPLIERS: SlaPriorityMultipliers = {
  URGENT: 0.5,
  HIGH: 0.75,
  MEDIUM: 1,
  LOW: 1.5,
};

const TICKET_TRANSITIONS: Record<ServiceTicketStatus, readonly ServiceTicketStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'OPEN', 'CANCELLED'],
  PENDING_APPROVAL: ['OPEN', 'REJECTED', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_USER', 'RESOLVED'],
  WAITING_USER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
};

function toValidDate(input: Date | string | null | undefined): Date | null {
  if (!input) {
    return null;
  }
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeEffectiveSlaHours(
  baseResponseHours: number,
  baseResolutionHours: number,
  options?: Pick<CalculateSlaOptions, 'priority' | 'multipliers' | 'minHours'>,
): { effectiveResponseHours: number; effectiveResolutionHours: number } {
  const minHours = Math.max(1, Math.floor(options?.minHours ?? 1));
  const priority = options?.priority ?? 'MEDIUM';
  const merged: SlaPriorityMultipliers = {
    ...DEFAULT_PRIORITY_MULTIPLIERS,
    ...(options?.multipliers ?? {}),
  };
  const multiplier = merged[priority] ?? 1;

  const safeResponse = Math.max(minHours, Math.round(Math.max(1, baseResponseHours) * multiplier));
  const safeResolutionRaw = Math.max(
    minHours,
    Math.round(Math.max(1, baseResolutionHours) * multiplier),
  );
  const safeResolution = Math.max(safeResponse, safeResolutionRaw);

  return {
    effectiveResponseHours: safeResponse,
    effectiveResolutionHours: safeResolution,
  };
}

export function calculateSlaDeadlines(
  startTime: Date | string,
  baseResponseHours: number,
  baseResolutionHours: number,
  options?: CalculateSlaOptions,
): SlaDeadlinesResult {
  const start = toValidDate(startTime) ?? new Date();
  const { effectiveResponseHours, effectiveResolutionHours } = computeEffectiveSlaHours(
    baseResponseHours,
    baseResolutionHours,
    options,
  );
  const pausedMs = Math.max(0, Math.floor(options?.pausedMinutes ?? 0)) * 60_000;

  return {
    effectiveResponseHours,
    effectiveResolutionHours,
    responseDueAt: new Date(start.getTime() + effectiveResponseHours * 3_600_000 + pausedMs),
    resolutionDueAt: new Date(start.getTime() + effectiveResolutionHours * 3_600_000 + pausedMs),
  };
}

export function shiftSlaDeadlineByMinutes(
  currentDueAt: Date | string | null | undefined,
  additionalMinutes: number,
): Date | null {
  const due = toValidDate(currentDueAt);
  if (!due) {
    return null;
  }
  const safeMinutes = Math.max(0, Math.round(additionalMinutes));
  return new Date(due.getTime() + safeMinutes * 60_000);
}

export function evaluateSlaStatus(input: EvaluateSlaInput): EvaluateSlaResult {
  const due = toValidDate(input.dueAt);
  if (!due) {
    return {
      status: input.isPaused ? 'PAUSED' : 'NONE',
      remainingMinutes: null,
      overdueMinutes: 0,
    };
  }

  const completed = toValidDate(input.completedAt);
  if (completed) {
    const diffMinutes = Math.round((completed.getTime() - due.getTime()) / 60_000);
    if (diffMinutes <= 0) {
      return {
        status: 'MET',
        remainingMinutes: Math.abs(diffMinutes),
        overdueMinutes: 0,
      };
    }
    return {
      status: 'BREACHED',
      remainingMinutes: 0,
      overdueMinutes: diffMinutes,
    };
  }

  if (input.isPaused) {
    const now = input.now ?? new Date();
    const remaining = Math.max(0, Math.round((due.getTime() - now.getTime()) / 60_000));
    return {
      status: 'PAUSED',
      remainingMinutes: remaining,
      overdueMinutes: 0,
    };
  }

  const now = input.now ?? new Date();
  const remainingMs = due.getTime() - now.getTime();
  if (remainingMs < 0) {
    return {
      status: 'BREACHED',
      remainingMinutes: 0,
      overdueMinutes: Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000)),
    };
  }

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  const atRiskRatio = input.atRiskRatio ?? 0.25;
  const atRiskMinMinutes = input.atRiskMinMinutes ?? 120;
  const started = toValidDate(input.startedAt);
  let thresholdMinutes = atRiskMinMinutes;

  if (started && due.getTime() > started.getTime()) {
    const totalWindowMinutes = (due.getTime() - started.getTime()) / 60_000;
    thresholdMinutes = Math.max(atRiskMinMinutes, Math.round(totalWindowMinutes * atRiskRatio));
  }

  return {
    status: remainingMinutes <= thresholdMinutes ? 'AT_RISK' : 'ON_TRACK',
    remainingMinutes,
    overdueMinutes: 0,
  };
}

export function canTransitionItTicketStatus(
  fromStatus: ServiceTicketStatus,
  toStatus: ServiceTicketStatus,
): boolean {
  if (fromStatus === toStatus) {
    return false;
  }
  return TICKET_TRANSITIONS[fromStatus].includes(toStatus);
}

export function formatTicketCode(
  prefix: string,
  yearMonth: string,
  sequence: number,
  padLength = 4,
): string {
  const safePrefix = prefix.trim().toUpperCase() || 'TKT';
  const safeSeq = Math.max(1, Math.floor(sequence));
  return `${safePrefix}-${yearMonth}-${String(safeSeq).padStart(padLength, '0')}`;
}
