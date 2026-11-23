/**
 * Tiện ích dựng cây phân cấp O(n), phát hiện vòng lặp cha-con và thu thập hậu duệ.
 * Phù hợp cho Sơ đồ tổ chức (Org Chart), Danh mục đa cấp, Vùng lãnh thổ CRM...
 *
 * Dependencies: None
 *
 * Input / Output:
 * - buildTree<T>(items: readonly T[]) => TreeNode<T>[]
 * - wouldCreateCycle(items, nodeId, candidateParentId) => boolean
 * - collectDescendantIds(items, rootId) => Array<number | string>
 *
 * Ví dụ:
 * ```ts
 * const tree = buildTree([{ id: 1, parentId: null, name: 'BOD' }, { id: 2, parentId: 1, name: 'HR' }]);
 * wouldCreateCycle(items, 1, 2); // true (gây vòng lặp 1 -> 2 -> 1)
 * ```
 */

export type TreeNodeId = number | string;

export interface FlatTreeInput {
  id: TreeNodeId;
  parentId: TreeNodeId | null | undefined;
}

export type TreeNode<T extends FlatTreeInput> = T & {
  children: TreeNode<T>[];
};

export function buildTree<T extends FlatTreeInput>(items: readonly T[]): TreeNode<T>[] {
  const nodeMap = new Map<TreeNodeId, TreeNode<T>>();
  const roots: TreeNode<T>[] = [];

  for (const item of items) {
    nodeMap.set(item.id, { ...item, children: [] });
  }

  for (const item of items) {
    const node = nodeMap.get(item.id);
    if (!node) {
      continue;
    }

    const parentId = item.parentId ?? null;
    if (parentId !== null && parentId !== item.id && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function collectDescendantIds<T extends FlatTreeInput>(
  items: readonly T[],
  rootId: TreeNodeId,
): TreeNodeId[] {
  const childrenByParent = new Map<TreeNodeId, TreeNodeId[]>();

  for (const item of items) {
    if (item.parentId === null || item.parentId === undefined) {
      continue;
    }
    const list = childrenByParent.get(item.parentId) ?? [];
    list.push(item.id);
    childrenByParent.set(item.parentId, list);
  }

  const visited = new Set<TreeNodeId>();
  const descendants: TreeNodeId[] = [];
  const queue: TreeNodeId[] = [...(childrenByParent.get(rootId) ?? [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current) || current === rootId) {
      continue;
    }
    visited.add(current);
    descendants.push(current);

    const nextChildren = childrenByParent.get(current);
    if (nextChildren) {
      for (const childId of nextChildren) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return descendants;
}

export function wouldCreateCycle<T extends FlatTreeInput>(
  items: readonly T[],
  nodeId: TreeNodeId,
  candidateParentId: TreeNodeId | null | undefined,
): boolean {
  if (candidateParentId === null || candidateParentId === undefined) {
    return false;
  }
  if (nodeId === candidateParentId) {
    return true;
  }
  const descendants = collectDescendantIds(items, nodeId);
  return descendants.includes(candidateParentId);
}
