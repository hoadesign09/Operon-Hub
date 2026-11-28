import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLASSIC_BUDGET_BARS,
  CLASSIC_DEMO_REQUESTS,
  CLASSIC_MONTHLY_CHART,
  CLASSIC_THEME_SPECS,
} from '@/components/design-studio/classic/classic-themes';
import {
  CLASSIC_BUDGET_OPTIONS,
  CLASSIC_DEPARTMENT_OPTIONS,
  formatStatusLabel,
  formatVndCompact,
  INITIAL_CLASSIC_ITEMS,
} from '@/components/design-studio/classic/classic-workspace-state';

describe('Classic Modern Design Studio (5 Distinct Full-Element Templates)', () => {
  it('defines exactly 5 distinct classic modern templates indexed 1..5', () => {
    expect(CLASSIC_THEME_SPECS).toHaveLength(5);
    expect(CLASSIC_THEME_SPECS.map((t) => t.index)).toEqual([1, 2, 3, 4, 5]);
    const uniqueIds = new Set(CLASSIC_THEME_SPECS.map((t) => t.id));
    expect(uniqueIds.size).toBe(5);
  });

  it('provides complete palette hex values and full element class tokens for every template', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    for (const theme of CLASSIC_THEME_SPECS) {
      expect(theme.name.trim().length).toBeGreaterThan(2);
      expect(theme.highlights.length).toBeGreaterThanOrEqual(3);

      for (const hex of Object.values(theme.palette)) {
        expect(hex).toMatch(hexRegex);
      }

      const requiredKeys: Array<keyof typeof theme.classes> = [
        'canvas',
        'topbar',
        'card',
        'heading1',
        'heading2',
        'bodyText',
        'btnPrimary',
        'btnSecondary',
        'btnOutline',
        'btnDanger',
        'btnDisabled',
        'input',
        'inputError',
        'select',
        'dropzone',
        'tableWrap',
        'tableHead',
        'tableRow',
        'badgeNeutral',
        'badgeSuccess',
        'badgeWarning',
        'badgeDanger',
        'alertInfo',
        'alertDanger',
        'tabsWrap',
        'progressTrack',
        'progressFill',
        'modalSurface',
      ];

      for (const key of requiredKeys) {
        expect(theme.classes[key].trim().length, `${theme.id}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('includes rich interactive dataset with all statuses, flags, budgets, and formatting helpers', () => {
    expect(CLASSIC_DEMO_REQUESTS.length).toBeGreaterThanOrEqual(5);
    expect(CLASSIC_BUDGET_BARS.length).toBeGreaterThanOrEqual(4);
    expect(CLASSIC_MONTHLY_CHART.length).toBe(6);

    expect(INITIAL_CLASSIC_ITEMS.length).toBe(12);
    expect(CLASSIC_BUDGET_OPTIONS.length).toBe(5);
    expect(CLASSIC_DEPARTMENT_OPTIONS.length).toBe(6);

    // Ensure urgent & over-budget flags exist for Advanced Filter verification
    expect(INITIAL_CLASSIC_ITEMS.some((i) => i.isUrgent)).toBe(true);
    expect(INITIAL_CLASSIC_ITEMS.some((i) => i.isOverBudget)).toBe(true);
    expect(new Set(INITIAL_CLASSIC_ITEMS.map((i) => i.status)).size).toBe(5);

    expect(formatVndCompact(48500000)).toContain('48.500.000');
    expect(formatStatusLabel('PENDING_APPROVAL')).toBe('Chờ phê duyệt');
  });

  it('applies Precision Grid (#5) globally in root layout, PortalShell, and globals.css', () => {
    const root = process.cwd();
    const layoutCode = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');
    const shellCode = fs.readFileSync(path.join(root, 'src/layouts/PortalShell.tsx'), 'utf8');
    const globalsCss = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

    expect(layoutCode).toContain('data-theme="precision-grid"');
    expect(shellCode).toContain('portal-precision-grid');
    expect(shellCode).toContain('#1D4E89');
    expect(globalsCss).toContain('.portal-precision-grid');
    expect(globalsCss).toContain('--pg-primary: #1d4e89');
  });
});
