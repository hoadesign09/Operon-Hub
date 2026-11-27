import { describe, expect, it } from 'vitest';
import {
  calculateSlaDeadlines,
  canTransitionItTicketStatus,
  computeEffectiveSlaHours,
  evaluateSlaStatus,
  formatTicketCode,
  shiftSlaDeadlineByMinutes,
  type ServiceTicketStatus,
} from '@/lib/portable/sla-calculator';

describe('Portable SLA & Ticket State Machine (Zero Dependencies)', () => {
  it('computes priority-adjusted SLA hours safely with resolution >= response', () => {
    expect(computeEffectiveSlaHours(4, 24, { priority: 'MEDIUM' })).toEqual({
      effectiveResponseHours: 4,
      effectiveResolutionHours: 24,
    });
    expect(computeEffectiveSlaHours(4, 24, { priority: 'URGENT' })).toEqual({
      effectiveResponseHours: 2,
      effectiveResolutionHours: 12,
    });
    expect(computeEffectiveSlaHours(2, 8, { priority: 'HIGH' })).toEqual({
      effectiveResponseHours: 2,
      effectiveResolutionHours: 6,
    });
    expect(computeEffectiveSlaHours(4, 24, { priority: 'LOW' })).toEqual({
      effectiveResponseHours: 6,
      effectiveResolutionHours: 36,
    });
    // Floor at 1 hour minimum
    expect(computeEffectiveSlaHours(1, 1, { priority: 'URGENT' })).toEqual({
      effectiveResponseHours: 1,
      effectiveResolutionHours: 1,
    });
  });

  it('calculates SLA deadlines including paused minutes and shifts deadlines cleanly', () => {
    const start = new Date('2026-11-26T08:00:00.000Z');
    const result = calculateSlaDeadlines(start, 2, 8, {
      priority: 'MEDIUM',
      pausedMinutes: 30,
    });
    expect(result.responseDueAt.toISOString()).toBe('2026-11-26T10:30:00.000Z');
    expect(result.resolutionDueAt.toISOString()).toBe('2026-11-26T16:30:00.000Z');

    const shifted = shiftSlaDeadlineByMinutes(result.resolutionDueAt, 45);
    expect(shifted?.toISOString()).toBe('2026-11-26T17:15:00.000Z');
    expect(shiftSlaDeadlineByMinutes(null, 30)).toBeNull();
  });

  it('evaluates ON_TRACK, AT_RISK, BREACHED, MET, PAUSED, and NONE SLA statuses accurately', () => {
    const start = new Date('2026-11-26T08:00:00.000Z');
    const due = new Date('2026-11-26T16:00:00.000Z'); // 8h window

    // 6 hours left -> ON_TRACK
    expect(
      evaluateSlaStatus({
        startedAt: start,
        dueAt: due,
        now: new Date('2026-11-26T10:00:00.000Z'),
      }).status,
    ).toBe('ON_TRACK');

    // 1.5 hours left (<= 25% of 8h) -> AT_RISK
    expect(
      evaluateSlaStatus({
        startedAt: start,
        dueAt: due,
        now: new Date('2026-11-26T14:30:00.000Z'),
      }).status,
    ).toBe('AT_RISK');

    // Past due -> BREACHED with positive overdueMinutes
    const breached = evaluateSlaStatus({
      startedAt: start,
      dueAt: due,
      now: new Date('2026-11-26T16:45:00.000Z'),
    });
    expect(breached.status).toBe('BREACHED');
    expect(breached.overdueMinutes).toBe(45);

    // Completed before due -> MET
    expect(
      evaluateSlaStatus({
        dueAt: due,
        completedAt: new Date('2026-11-26T15:00:00.000Z'),
      }).status,
    ).toBe('MET');

    // Completed after due -> BREACHED
    expect(
      evaluateSlaStatus({
        dueAt: due,
        completedAt: new Date('2026-11-26T17:00:00.000Z'),
      }).status,
    ).toBe('BREACHED');

    // Paused while open
    expect(
      evaluateSlaStatus({
        dueAt: due,
        isPaused: true,
        now: new Date('2026-11-26T12:00:00.000Z'),
      }).status,
    ).toBe('PAUSED');

    // No due date
    expect(evaluateSlaStatus({ dueAt: null }).status).toBe('NONE');
  });

  it('enforces valid IT ticket lifecycle transitions and blocks terminal mutations', () => {
    expect(canTransitionItTicketStatus('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionItTicketStatus('DRAFT', 'OPEN')).toBe(true);
    expect(canTransitionItTicketStatus('PENDING_APPROVAL', 'OPEN')).toBe(true);
    expect(canTransitionItTicketStatus('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionItTicketStatus('IN_PROGRESS', 'WAITING_USER')).toBe(true);
    expect(canTransitionItTicketStatus('WAITING_USER', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionItTicketStatus('IN_PROGRESS', 'RESOLVED')).toBe(true);
    expect(canTransitionItTicketStatus('RESOLVED', 'CLOSED')).toBe(true);
    expect(canTransitionItTicketStatus('RESOLVED', 'IN_PROGRESS')).toBe(true); // REOPEN

    const terminals: ServiceTicketStatus[] = ['CLOSED', 'REJECTED', 'CANCELLED'];
    for (const st of terminals) {
      expect(canTransitionItTicketStatus(st, 'OPEN')).toBe(false);
      expect(canTransitionItTicketStatus(st, 'IN_PROGRESS')).toBe(false);
    }
    expect(canTransitionItTicketStatus('OPEN', 'CLOSED')).toBe(false);
  });

  it('formats sequential ticket codes consistently', () => {
    expect(formatTicketCode('itr', '202611', 7)).toBe('ITR-202611-0007');
    expect(formatTicketCode('ITR', '202611', 125)).toBe('ITR-202611-0125');
  });
});
