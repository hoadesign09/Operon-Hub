/**
 * Bộ lập lịch Gantt & Thuật toán Đường găng CPM (Critical Path Method) thuần túy.
 * Hỗ trợ phát hiện chu trình DAG, tính Early/Late Start-Finish, Slack = 0 và Auto-Shift cho 4 kiểu FS/SS/FF/SF.
 *
 * Dependencies: None
 * Input / Output:
 *   - wouldCreateDependencyCycle(edges, predecessorId, successorId) => boolean
 *   - computeCriticalPath(nodes, edges) => CriticalPathResult
 *   - autoShiftDependents(nodes, edges, changedTaskId, newStartDate, newDueDate) => ShiftedTaskUpdate[]
 *
 * Ví dụ:
 * ```ts
 * const cpm = computeCriticalPath(
 *   [{ id: 1, startDate: '2026-11-01', dueDate: '2026-11-05' }, { id: 2, startDate: '2026-11-06', dueDate: '2026-11-10' }],
 *   [{ predecessorId: 1, successorId: 2, type: 'FS', lagDays: 0 }],
 * );
 * ```
 */

export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface GanttTaskNode {
  id: number;
  startDate: string | null;
  dueDate: string | null;
}

export interface GanttDependencyEdge {
  predecessorId: number;
  successorId: number;
  type: GanttDependencyType;
  lagDays: number;
}

export interface CriticalPathNodeResult {
  taskId: number;
  durationDays: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slackDays: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  hasCycle: boolean;
  projectDurationDays: number;
  criticalTaskIds: number[];
  nodes: Record<number, CriticalPathNodeResult>;
}

export interface ShiftedTaskUpdate {
  taskId: number;
  startDate: string;
  dueDate: string;
}

const MS_PER_DAY = 86400000;

function parseDayMs(iso: string): number {
  const clean = iso.slice(0, 10);
  const [y, m, d] = clean.split('-').map((n) => Number(n));
  return Date.UTC(y || 1970, (m || 1) - 1, d || 1);
}

function formatDayMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function diffDaysInclusive(startIso: string | null, dueIso: string | null): number {
  if (!startIso || !dueIso) {
    return 1;
  }
  const s = parseDayMs(startIso);
  const e = parseDayMs(dueIso);
  if (e < s) {
    return 1;
  }
  return Math.max(1, Math.round((e - s) / MS_PER_DAY) + 1);
}

export function wouldCreateDependencyCycle(
  edges: ReadonlyArray<{ predecessorId: number; successorId: number }>,
  predecessorId: number,
  successorId: number,
): boolean {
  if (predecessorId === successorId) {
    return true;
  }
  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.predecessorId) ?? [];
    list.push(edge.successorId);
    adjacency.set(edge.predecessorId, list);
  }
  const visited = new Set<number>();
  const stack: number[] = [successorId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === predecessorId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const nexts = adjacency.get(current) ?? [];
    for (const nextId of nexts) {
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    }
  }
  return false;
}

function computeForwardConstraint(
  predEs: number,
  predEf: number,
  succDuration: number,
  edge: GanttDependencyEdge,
): number {
  const lag = edge.lagDays || 0;
  switch (edge.type) {
    case 'FS':
      return predEf + lag;
    case 'SS':
      return predEs + lag;
    case 'FF':
      return Math.max(0, predEf + lag - succDuration);
    case 'SF':
      return Math.max(0, predEs + lag - succDuration);
  }
}

function computeBackwardConstraint(
  succLs: number,
  succLf: number,
  predDuration: number,
  edge: GanttDependencyEdge,
): number {
  const lag = edge.lagDays || 0;
  switch (edge.type) {
    case 'FS':
      return succLs - lag;
    case 'SS':
      return succLs - lag + predDuration;
    case 'FF':
      return succLf - lag;
    case 'SF':
      return succLf - lag + predDuration;
  }
}

export function computeCriticalPath(
  nodes: readonly GanttTaskNode[],
  edges: readonly GanttDependencyEdge[],
): CriticalPathResult {
  if (nodes.length === 0) {
    return {
      hasCycle: false,
      projectDurationDays: 0,
      criticalTaskIds: [],
      nodes: {},
    };
  }

  const nodeMap = new Map<number, GanttTaskNode>();
  const durationMap = new Map<number, number>();
  const inDegree = new Map<number, number>();
  const outgoing = new Map<number, GanttDependencyEdge[]>();
  const incoming = new Map<number, GanttDependencyEdge[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    durationMap.set(node.id, diffDaysInclusive(node.startDate, node.dueDate));
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.predecessorId) || !nodeMap.has(edge.successorId)) {
      continue;
    }
    outgoing.get(edge.predecessorId)!.push(edge);
    incoming.get(edge.successorId)!.push(edge);
    inDegree.set(edge.successorId, (inDegree.get(edge.successorId) ?? 0) + 1);
  }

  // Kahn's topological sort
  const queue: number[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const topoOrder: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);
    for (const edge of outgoing.get(current) ?? []) {
      const nextDeg = (inDegree.get(edge.successorId) ?? 1) - 1;
      inDegree.set(edge.successorId, nextDeg);
      if (nextDeg === 0) {
        queue.push(edge.successorId);
      }
    }
  }

  if (topoOrder.length !== nodes.length) {
    return {
      hasCycle: true,
      projectDurationDays: 0,
      criticalTaskIds: [],
      nodes: {},
    };
  }

  // Forward pass
  const earlyStart = new Map<number, number>();
  const earlyFinish = new Map<number, number>();

  for (const id of topoOrder) {
    const dur = durationMap.get(id) ?? 1;
    let es = 0;
    for (const edge of incoming.get(id) ?? []) {
      const predEs = earlyStart.get(edge.predecessorId) ?? 0;
      const predEf = earlyFinish.get(edge.predecessorId) ?? 0;
      const candidate = computeForwardConstraint(predEs, predEf, dur, edge);
      if (candidate > es) {
        es = candidate;
      }
    }
    earlyStart.set(id, es);
    earlyFinish.set(id, es + dur);
  }

  let projectDurationDays = 0;
  for (const ef of earlyFinish.values()) {
    if (ef > projectDurationDays) {
      projectDurationDays = ef;
    }
  }

  // Backward pass
  const lateStart = new Map<number, number>();
  const lateFinish = new Map<number, number>();

  for (let i = topoOrder.length - 1; i >= 0; i -= 1) {
    const id = topoOrder[i];
    const dur = durationMap.get(id) ?? 1;
    const outEdges = outgoing.get(id) ?? [];
    let lf = projectDurationDays;
    if (outEdges.length > 0) {
      lf = Number.POSITIVE_INFINITY;
      for (const edge of outEdges) {
        const succLs = lateStart.get(edge.successorId) ?? projectDurationDays;
        const succLf = lateFinish.get(edge.successorId) ?? projectDurationDays;
        const candidate = computeBackwardConstraint(succLs, succLf, dur, edge);
        if (candidate < lf) {
          lf = candidate;
        }
      }
    }
    lateFinish.set(id, lf);
    lateStart.set(id, lf - dur);
  }

  const resultNodes: Record<number, CriticalPathNodeResult> = {};
  const criticalTaskIds: number[] = [];

  for (const id of topoOrder) {
    const es = earlyStart.get(id) ?? 0;
    const ef = earlyFinish.get(id) ?? 0;
    const ls = lateStart.get(id) ?? 0;
    const lf = lateFinish.get(id) ?? 0;
    const slackDays = Math.max(0, ls - es);
    const isCritical = slackDays === 0 && projectDurationDays > 0;
    if (isCritical) {
      criticalTaskIds.push(id);
    }
    resultNodes[id] = {
      taskId: id,
      durationDays: durationMap.get(id) ?? 1,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      slackDays,
      isCritical,
    };
  }

  return {
    hasCycle: false,
    projectDurationDays,
    criticalTaskIds,
    nodes: resultNodes,
  };
}

export function autoShiftDependents(
  nodes: readonly GanttTaskNode[],
  edges: readonly GanttDependencyEdge[],
  changedTaskId: number,
  newStartDate: string,
  newDueDate: string,
): ShiftedTaskUpdate[] {
  const schedule = new Map<number, { startMs: number; dueMs: number; durationDays: number }>();
  for (const node of nodes) {
    const startIso = node.id === changedTaskId ? newStartDate : node.startDate;
    const dueIso = node.id === changedTaskId ? newDueDate : node.dueDate;
    if (!startIso && !dueIso) {
      continue;
    }
    const sIso = startIso ?? dueIso!;
    const eIso = dueIso ?? startIso!;
    const sMs = parseDayMs(sIso);
    const eMs = Math.max(sMs, parseDayMs(eIso));
    const dur = Math.max(1, Math.round((eMs - sMs) / MS_PER_DAY) + 1);
    schedule.set(node.id, { startMs: sMs, dueMs: eMs, durationDays: dur });
  }

  const outgoing = new Map<number, GanttDependencyEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.predecessorId) ?? [];
    list.push(edge);
    outgoing.set(edge.predecessorId, list);
  }

  const shifted = new Map<number, ShiftedTaskUpdate>();
  const queue: number[] = [changedTaskId];
  let guard = 0;

  while (queue.length > 0 && guard < nodes.length * 4 + 10) {
    guard += 1;
    const predId = queue.shift()!;
    const predSched = schedule.get(predId);
    if (!predSched) {
      continue;
    }

    for (const edge of outgoing.get(predId) ?? []) {
      const succSched = schedule.get(edge.successorId);
      if (!succSched) {
        continue;
      }

      const lagMs = (edge.lagDays || 0) * MS_PER_DAY;
      const spanMs = (succSched.durationDays - 1) * MS_PER_DAY;
      let minStartMs = succSched.startMs;

      if (edge.type === 'FS') {
        minStartMs = predSched.dueMs + MS_PER_DAY + lagMs;
      } else if (edge.type === 'SS') {
        minStartMs = predSched.startMs + lagMs;
      } else if (edge.type === 'FF') {
        const minDueMs = predSched.dueMs + lagMs;
        minStartMs = minDueMs - spanMs;
      } else if (edge.type === 'SF') {
        const minDueMs = predSched.startMs + lagMs;
        minStartMs = minDueMs - spanMs;
      }

      if (minStartMs > succSched.startMs) {
        const nextDueMs = minStartMs + spanMs;
        schedule.set(edge.successorId, {
          startMs: minStartMs,
          dueMs: nextDueMs,
          durationDays: succSched.durationDays,
        });
        shifted.set(edge.successorId, {
          taskId: edge.successorId,
          startDate: formatDayMs(minStartMs),
          dueDate: formatDayMs(nextDueMs),
        });
        queue.push(edge.successorId);
      }
    }
  }

  return Array.from(shifted.values());
}
