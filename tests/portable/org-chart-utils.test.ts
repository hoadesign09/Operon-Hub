import { describe, expect, it } from 'vitest';
import {
  collectOrgNodeIds,
  computeOrgTreeMetrics,
  filterOrgHierarchy,
  findOrgNodePath,
  flattenOrgHierarchy,
  getOrgAvatarInitials,
  type OrgHierarchyNode,
} from '@/lib/portable/org-chart-utils';

interface SampleDept extends OrgHierarchyNode<SampleDept> {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  headcount: number;
  children: SampleDept[];
}

const SAMPLE_TREE: SampleDept[] = [
  {
    id: 1,
    code: 'BOD',
    name: 'Ban Giám đốc',
    isActive: true,
    headcount: 2,
    children: [
      {
        id: 2,
        code: 'TECH',
        name: 'Khối Công nghệ',
        isActive: true,
        headcount: 3,
        children: [
          {
            id: 4,
            code: 'ENG-FE',
            name: 'Nhóm Frontend',
            isActive: true,
            headcount: 6,
            children: [],
          },
          {
            id: 5,
            code: 'ENG-QA',
            name: 'Nhóm QA',
            isActive: false,
            headcount: 2,
            children: [],
          },
        ],
      },
      {
        id: 3,
        code: 'HR',
        name: 'Phòng Nhân sự',
        isActive: true,
        headcount: 4,
        children: [],
      },
    ],
  },
];

describe('Portable Org Chart Utils (Zero Dependencies)', () => {
  it('computes tree metrics (total, active, inactive, maxDepth, headcount) accurately', () => {
    const metrics = computeOrgTreeMetrics(SAMPLE_TREE, (n) => n.headcount);
    expect(metrics).toEqual({
      totalNodes: 5,
      activeNodes: 4,
      inactiveNodes: 1,
      maxDepth: 3,
      totalHeadcount: 17,
    });
    expect(computeOrgTreeMetrics([])).toEqual({
      totalNodes: 0,
      activeNodes: 0,
      inactiveNodes: 0,
      maxDepth: 0,
      totalHeadcount: 0,
    });
  });

  it('filters hierarchy keeping ancestor path intact when a deep leaf matches', () => {
    const res = filterOrgHierarchy(SAMPLE_TREE, (n) => n.code === 'ENG-FE');
    expect(res.matchedIds.has(4)).toBe(true);
    expect(res.matchedIds.size).toBe(1);
    expect(res.ancestorIds.has(1)).toBe(true);
    expect(res.ancestorIds.has(2)).toBe(true);
    expect(res.nodes).toHaveLength(1);
    expect(res.nodes[0]!.children).toHaveLength(1);
    expect(res.nodes[0]!.children[0]!.id).toBe(2);
    expect(res.nodes[0]!.children[0]!.children.map((c) => c.id)).toEqual([4]);
  });

  it('preserves full subtree when a parent node directly matches', () => {
    const res = filterOrgHierarchy(SAMPLE_TREE, (n) => n.code === 'TECH');
    expect(res.matchedIds.has(2)).toBe(true);
    expect(res.nodes[0]!.children[0]!.children).toHaveLength(2);
  });

  it('collects all node IDs, finds breadcrumb path, and flattens hierarchy with depth', () => {
    const allIds = collectOrgNodeIds(SAMPLE_TREE);
    expect([...allIds].sort()).toEqual([1, 2, 3, 4, 5]);

    const path = findOrgNodePath(SAMPLE_TREE, 4);
    expect(path.map((n) => n.code)).toEqual(['BOD', 'TECH', 'ENG-FE']);
    expect(findOrgNodePath(SAMPLE_TREE, 999)).toEqual([]);

    const flat = flattenOrgHierarchy(SAMPLE_TREE);
    expect(flat.map((item) => `${item.node.code}@L${item.depth}`)).toEqual([
      'BOD@L0',
      'TECH@L1',
      'ENG-FE@L2',
      'ENG-QA@L2',
      'HR@L1',
    ]);
  });

  it('generates clean uppercase avatar initials for single, multi-word, and empty names', () => {
    expect(getOrgAvatarInitials('Nguyễn Minh Anh')).toBe('NA');
    expect(getOrgAvatarInitials('Admin')).toBe('AD');
    expect(getOrgAvatarInitials('  ')).toBe('??');
    expect(getOrgAvatarInitials(null)).toBe('??');
  });
});
