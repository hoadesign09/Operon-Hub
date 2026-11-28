import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as SkeletonKit from '@/components/ui/Skeleton';

const ROOT_DIR = process.cwd();

function collectFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, predicate));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

describe('Precision Grid Global Skeleton Loading UI System', () => {
  it('exports all reusable Skeleton primitives and layout presets', () => {
    const expectedExports = [
      'Skeleton',
      'SkeletonText',
      'SkeletonKpiGrid',
      'SkeletonTableRows',
      'SkeletonTable',
      'SkeletonCardGrid',
      'SkeletonListRows',
      'SkeletonFormFields',
      'SkeletonDetailPage',
      'SkeletonOrgTree',
      'SkeletonKanbanBoard',
      'SkeletonGanttChart',
      'SkeletonCalendarGrid',
      'SkeletonDashboard',
      'SkeletonPage',
      'SkeletonPortalShell',
    ] as const;

    for (const name of expectedExports) {
      expect(typeof SkeletonKit[name]).toBe('function');
    }
  });

  it('defines accessible shimmer animation and reduced-motion fallback in globals.css', () => {
    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/app/globals.css'), 'utf-8');
    expect(css).toContain('@keyframes pg-skeleton-shimmer');
    expect(css).toContain('.pg-skeleton');
    expect(css).toContain('.pg-skeleton-dark');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('provides Next.js App Router loading.tsx skeletons across root, portal, and specialized routes', () => {
    const requiredLoadingFiles = [
      'src/app/loading.tsx',
      'src/app/(portal)/loading.tsx',
      'src/app/(portal)/dashboard/loading.tsx',
      'src/app/(portal)/projects/dashboard/loading.tsx',
      'src/app/(portal)/services/loading.tsx',
      'src/app/(portal)/hrm/organization/loading.tsx',
      'src/app/(portal)/hrm/employees/[id]/loading.tsx',
      'src/app/(portal)/projects/[code]/loading.tsx',
      'src/app/(portal)/services/payments/[id]/loading.tsx',
      'src/app/(portal)/services/payments/budgets/[id]/loading.tsx',
      'src/app/(portal)/services/proposals/[id]/loading.tsx',
      'src/app/(portal)/services/it-requests/[id]/loading.tsx',
      'src/app/(portal)/my/profile/loading.tsx',
      'src/app/design-studio/loading.tsx',
    ];

    for (const relPath of requiredLoadingFiles) {
      const fullPath = path.join(ROOT_DIR, relPath);
      expect(fs.existsSync(fullPath), `Missing ${relPath}`).toBe(true);
      const src = fs.readFileSync(fullPath, 'utf-8');
      expect(src).toContain('@/components/ui/Skeleton');
    }
  });

  it('uses SkeletonPortalShell in PortalShell and eliminates ad-hoc skeleton pulse blocks across all portal pages', () => {
    const shellSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/layouts/PortalShell.tsx'), 'utf-8');
    expect(shellSrc).toContain('SkeletonPortalShell');

    const portalPages = collectFiles(path.join(ROOT_DIR, 'src/app/(portal)'), (file) =>
      file.endsWith(`${path.sep}page.tsx`),
    );
    expect(portalPages.length).toBeGreaterThanOrEqual(35);

    const legacyPulsePages: string[] = [];
    for (const pageFile of portalPages) {
      const content = fs.readFileSync(pageFile, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        if (!line.includes('animate-pulse')) continue;
        // Allow live status indicator dots (e.g. meeting IN_PROGRESS indicator dot)
        if (
          line.includes('dotCls') ||
          (line.includes('rounded-full') && (line.includes('h-1.5') || line.includes('h-2')))
        ) {
          continue;
        }
        legacyPulsePages.push(path.relative(ROOT_DIR, pageFile));
        break;
      }
    }

    expect(legacyPulsePages).toEqual([]);
  });

  it('keeps SkeletonDashboard chart bars non-collapsing with h-full flex container', () => {
    const skeletonSrc = fs.readFileSync(
      path.join(ROOT_DIR, 'src/components/ui/Skeleton.tsx'),
      'utf-8',
    );
    expect(skeletonSrc).toContain('flex h-full flex-1 flex-col items-center justify-end gap-2');
    expect(skeletonSrc).toContain('flex w-full flex-1 items-end');
  });
});
