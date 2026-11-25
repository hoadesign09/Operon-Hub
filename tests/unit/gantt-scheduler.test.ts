import { describe, expect, it } from 'vitest';
import {
  autoShiftDependents,
  computeCriticalPath,
  wouldCreateDependencyCycle,
} from '@/lib/portable/gantt-scheduler';

describe('portable/gantt-scheduler', () => {
  it('detects direct and transitive dependency cycles in DAG', () => {
    const edges = [
      { predecessorId: 1, successorId: 2 },
      { predecessorId: 2, successorId: 3 },
    ];
    expect(wouldCreateDependencyCycle(edges, 3, 1)).toBe(true);
    expect(wouldCreateDependencyCycle(edges, 2, 2)).toBe(true);
    expect(wouldCreateDependencyCycle(edges, 1, 3)).toBe(false);
  });

  it('identifies the Critical Path (Slack = 0) and non-critical slack days', () => {
    // Path A: 1 (5d) -> 2 (5d) = 10d (Critical)
    // Path B: 1 (5d) -> 3 (2d) = 7d (Slack = 3d)
    const nodes = [
      { id: 1, startDate: '2026-11-01', dueDate: '2026-11-05' },
      { id: 2, startDate: '2026-11-06', dueDate: '2026-11-10' },
      { id: 3, startDate: '2026-11-06', dueDate: '2026-11-07' },
    ];
    const edges = [
      { predecessorId: 1, successorId: 2, type: 'FS' as const, lagDays: 0 },
      { predecessorId: 1, successorId: 3, type: 'FS' as const, lagDays: 0 },
    ];

    const cpm = computeCriticalPath(nodes, edges);
    expect(cpm.hasCycle).toBe(false);
    expect(cpm.projectDurationDays).toBe(10);
    expect(cpm.criticalTaskIds).toEqual([1, 2]);
    expect(cpm.nodes[1].isCritical).toBe(true);
    expect(cpm.nodes[2].isCritical).toBe(true);
    expect(cpm.nodes[3].isCritical).toBe(false);
    expect(cpm.nodes[3].slackDays).toBe(3);
  });

  it('auto-shifts FS and SS downstream dependents preserving duration and lag', () => {
    const nodes = [
      { id: 1, startDate: '2026-11-01', dueDate: '2026-11-03' },
      { id: 2, startDate: '2026-11-04', dueDate: '2026-11-06' }, // 3 days
      { id: 3, startDate: '2026-11-05', dueDate: '2026-11-06' }, // 2 days
    ];
    const edges = [
      { predecessorId: 1, successorId: 2, type: 'FS' as const, lagDays: 1 },
      { predecessorId: 2, successorId: 3, type: 'SS' as const, lagDays: 1 },
    ];

    // Push task 1 by +2 days -> 2026-11-03..2026-11-05
    const shifted = autoShiftDependents(nodes, edges, 1, '2026-11-03', '2026-11-05');
    const t2 = shifted.find((s) => s.taskId === 2);
    const t3 = shifted.find((s) => s.taskId === 3);

    expect(t2).toEqual({ taskId: 2, startDate: '2026-11-07', dueDate: '2026-11-09' });
    expect(t3).toEqual({ taskId: 3, startDate: '2026-11-08', dueDate: '2026-11-09' });
  });
});
