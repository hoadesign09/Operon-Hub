import { describe, expect, it } from 'vitest';
import {
  buildTree,
  collectDescendantIds,
  wouldCreateCycle,
} from '@/lib/portable/tree-utils';

describe('portable/tree-utils', () => {
  const sampleNodes = [
    { id: 1, parentId: null, name: 'BOD' },
    { id: 2, parentId: 1, name: 'HR' },
    { id: 3, parentId: 1, name: 'TECH' },
    { id: 4, parentId: 3, name: 'BACKEND' },
    { id: 5, parentId: 999, name: 'ORPHAN_ROOT' },
  ];

  it('builds nested tree cleanly in O(n) and elevates orphans to roots', () => {
    const tree = buildTree(sampleNodes);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children.map((c) => c.id)).toEqual([2, 3]);
    expect(tree[0].children[1].children.map((c) => c.id)).toEqual([4]);
    expect(tree[1].id).toBe(5);
  });

  it('collects all descendant IDs accurately', () => {
    expect(collectDescendantIds(sampleNodes, 1).sort()).toEqual([2, 3, 4]);
    expect(collectDescendantIds(sampleNodes, 3)).toEqual([4]);
    expect(collectDescendantIds(sampleNodes, 4)).toEqual([]);
  });

  it('detects direct self-loops and multi-level ancestor-descendant cycles', () => {
    expect(wouldCreateCycle(sampleNodes, 1, 1)).toBe(true);
    expect(wouldCreateCycle(sampleNodes, 1, 4)).toBe(true);
    expect(wouldCreateCycle(sampleNodes, 3, 4)).toBe(true);
    expect(wouldCreateCycle(sampleNodes, 4, 2)).toBe(false);
    expect(wouldCreateCycle(sampleNodes, 2, null)).toBe(false);
  });
});
