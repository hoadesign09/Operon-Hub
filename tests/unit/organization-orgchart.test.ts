import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '@/modules/hrm/organization/organization.schema';

function walkTsxFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTsxFiles(full, acc);
    else if (entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

describe('HRM Organization Schema & Full-Width Portal Standard', () => {
  it('validates optional managerEmployeeId in create & update department schemas', () => {
    const created = createDepartmentSchema.parse({
      branchId: 1,
      parentId: null,
      managerEmployeeId: 12,
      code: 'eng_core',
      name: 'Phòng Kỹ thuật Lõi',
      nameEn: 'Core Engineering',
      sortOrder: 1,
      isActive: true,
    });
    expect(created.code).toBe('ENG_CORE');
    expect(created.managerEmployeeId).toBe(12);

    const cleared = updateDepartmentSchema.parse({
      managerEmployeeId: null,
    });
    expect(cleared.managerEmployeeId).toBeNull();
  });

  it('enforces full-width root layout across every portal page (zero mx-auto max-w- page wrappers)', () => {
    const root = process.cwd();
    const portalDir = path.join(root, 'src/app/(portal)');
    const portalPages = walkTsxFiles(portalDir);
    expect(portalPages.length).toBeGreaterThanOrEqual(20);

    const violations: string[] = [];
    const pageContainerRegex = /className="[^"]*\bmx-auto\b[^"]*\bmax-w-(?:3xl|4xl|5xl|6xl|7xl|\[1\d{3}px\])/;

    for (const file of portalPages) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (pageContainerRegex.test(line)) {
          violations.push(`${path.relative(root, file).replace(/\\/g, '/')}:${idx + 1} -> ${line.trim()}`);
        }
      });
    }

    expect(violations, `Portal pages still constraining width:\n${violations.join('\n')}`).toEqual([]);
  });
});
