/**
 * Tiện ích thuần túy xử lý cây Sơ đồ Tổ chức (Org Chart): tính chỉ số độ sâu/quân số cộng dồn,
 * lọc cây giữ nguyên nhánh tổ tiên, làm phẳng kèm breadcrumb và tạo ký tự viết tắt avatar.
 *
 * Dependencies: None
 *
 * Input / Output:
 * - computeOrgTreeMetrics<T>(roots, getOwnHeadcount) => OrgTreeMetrics
 * - filterOrgHierarchy<T>(roots, predicate) => { nodes: T[]; matchedIds: Set<OrgNodeId>; ancestorIds: Set<OrgNodeId> }
 * - collectOrgNodeIds<T>(roots) => Set<OrgNodeId>
 * - findOrgNodePath<T>(roots, targetId) => T[]
 * - flattenOrgHierarchy<T>(roots) => Array<FlattenedOrgNode<T>>
 * - getOrgAvatarInitials(fullName: string) => string
 *
 * Ví dụ:
 * ```ts
 * const metrics = computeOrgTreeMetrics(tree, (n) => n.employeeCount);
 * const { nodes, matchedIds } = filterOrgHierarchy(tree, (n) => n.code.includes('IT'));
 * ```
 */

export type OrgNodeId = number | string;

export interface OrgHierarchyNode<TNode = unknown> {
  id: OrgNodeId;
  isActive?: boolean;
  children: TNode[];
}

export interface OrgTreeMetrics {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  maxDepth: number;
  totalHeadcount: number;
}

export interface OrgFilterResult<T extends OrgHierarchyNode<T>> {
  nodes: T[];
  matchedIds: Set<OrgNodeId>;
  ancestorIds: Set<OrgNodeId>;
}

export interface FlattenedOrgNode<T extends OrgHierarchyNode<T>> {
  node: T;
  depth: number;
  path: T[];
}

export function computeOrgTreeMetrics<T extends OrgHierarchyNode<T>>(
  roots: readonly T[],
  getOwnHeadcount: (node: T) => number = () => 0,
): OrgTreeMetrics {
  let totalNodes = 0;
  let activeNodes = 0;
  let inactiveNodes = 0;
  let maxDepth = 0;
  let totalHeadcount = 0;

  function traverse(nodes: readonly T[], depth: number): void {
    for (const node of nodes) {
      totalNodes += 1;
      if (node.isActive === false) {
        inactiveNodes += 1;
      } else {
        activeNodes += 1;
      }
      if (depth > maxDepth) {
        maxDepth = depth;
      }
      const headcount = getOwnHeadcount(node);
      if (Number.isFinite(headcount) && headcount > 0) {
        totalHeadcount += headcount;
      }
      if (node.children.length > 0) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(roots, 1);

  return {
    totalNodes,
    activeNodes,
    inactiveNodes,
    maxDepth,
    totalHeadcount,
  };
}

export function filterOrgHierarchy<T extends OrgHierarchyNode<T>>(
  roots: readonly T[],
  predicate: (node: T) => boolean,
): OrgFilterResult<T> {
  const matchedIds = new Set<OrgNodeId>();
  const ancestorIds = new Set<OrgNodeId>();

  function filterRecursive(nodes: readonly T[]): T[] {
    const result: T[] = [];
    for (const node of nodes) {
      const isDirectMatch = predicate(node);
      const filteredChildren = filterRecursive(node.children);

      if (isDirectMatch) {
        matchedIds.add(node.id);
      }
      if (filteredChildren.length > 0 && !isDirectMatch) {
        ancestorIds.add(node.id);
      }

      if (isDirectMatch || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: isDirectMatch && filteredChildren.length === 0 ? node.children : filteredChildren,
        });
      }
    }
    return result;
  }

  return {
    nodes: filterRecursive(roots),
    matchedIds,
    ancestorIds,
  };
}

export function collectOrgNodeIds<T extends OrgHierarchyNode<T>>(
  roots: readonly T[],
): Set<OrgNodeId> {
  const ids = new Set<OrgNodeId>();

  function walk(nodes: readonly T[]): void {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(roots);
  return ids;
}

export function findOrgNodePath<T extends OrgHierarchyNode<T>>(
  roots: readonly T[],
  targetId: OrgNodeId,
): T[] {
  function search(nodes: readonly T[], trail: T[]): T[] | null {
    for (const node of nodes) {
      const nextTrail = [...trail, node];
      if (node.id === targetId) {
        return nextTrail;
      }
      if (node.children.length > 0) {
        const found = search(node.children, nextTrail);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  return search(roots, []) ?? [];
}

export function flattenOrgHierarchy<T extends OrgHierarchyNode<T>>(
  roots: readonly T[],
): FlattenedOrgNode<T>[] {
  const output: FlattenedOrgNode<T>[] = [];

  function walk(nodes: readonly T[], depth: number, trail: T[]): void {
    for (const node of nodes) {
      const nextTrail = [...trail, node];
      output.push({ node, depth, path: nextTrail });
      if (node.children.length > 0) {
        walk(node.children, depth + 1, nextTrail);
      }
    }
  }

  walk(roots, 0, []);
  return output;
}

export function getOrgAvatarInitials(fullName: string | null | undefined): string {
  const cleaned = (fullName ?? '').trim();
  if (!cleaned) {
    return '??';
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const first = parts[0]![0] ?? '';
  const last = parts[parts.length - 1]![0] ?? '';
  return `${first}${last}`.toUpperCase();
}
