import { describe, expect, it } from 'vitest';
import {
  PORTAL_THEME_SPECS,
  SHOWCASE_APPROVALS,
  SHOWCASE_BRANCHES,
  SHOWCASE_DEPARTMENTS,
  SHOWCASE_PAYROLL_TREND,
} from '@/components/design-studio/showcase-data';

describe('Design Studio — 5 Portal UX/UI Themes', () => {
  it('defines exactly 5 distinct portal themes with unique ids and sequential indices', () => {
    expect(PORTAL_THEME_SPECS).toHaveLength(5);
    const ids = new Set(PORTAL_THEME_SPECS.map((t) => t.id));
    expect(ids.size).toBe(5);
    expect(PORTAL_THEME_SPECS.map((t) => t.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it('includes complete UX metadata and valid hex palettes for all 5 themes', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const theme of PORTAL_THEME_SPECS) {
      expect(theme.name.length).toBeGreaterThan(3);
      expect(theme.navigationStyle.length).toBeGreaterThan(5);
      expect(theme.strengths.length).toBeGreaterThanOrEqual(3);
      expect(theme.palette.canvas).toMatch(hexPattern);
      expect(theme.palette.surface).toMatch(hexPattern);
      expect(theme.palette.primary).toMatch(hexPattern);
      expect(theme.palette.accent).toMatch(hexPattern);
    }
  });

  it('provides consistent realistic Vietnamese SME showcase data', () => {
    expect(SHOWCASE_BRANCHES.length).toBeGreaterThanOrEqual(3);
    expect(SHOWCASE_DEPARTMENTS.length).toBe(5);
    expect(SHOWCASE_PAYROLL_TREND.length).toBe(6);
    expect(SHOWCASE_APPROVALS.length).toBeGreaterThanOrEqual(3);
  });
});
