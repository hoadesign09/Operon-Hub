import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('database/migrations/20261123_000012_init_hrm_assets.sql', () => {
  const sqlContent = fs.readFileSync(
    path.resolve(process.cwd(), 'database/migrations/20261123_000012_init_hrm_assets.sql'),
    'utf8',
  );

  it('có đủ khối UP/DOWN, InnoDB, utf8mb4_unicode_ci, DECIMAL(18,2) và đầy đủ FK/Index cho assets & asset_assignments', () => {
    expect(sqlContent).toContain('-- UP');
    expect(sqlContent).toContain('-- DOWN');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS assets');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS asset_assignments');
    expect(sqlContent).not.toMatch(/\bFLOAT\b|\bDOUBLE\b/i);
    expect(sqlContent).toContain('purchase_value DECIMAL(18,2)');
    expect(sqlContent).toContain('UNIQUE KEY uq_assets_asset_code (asset_code)');
    expect(sqlContent).toContain('fk_assets_branch_id');
    expect(sqlContent).toContain('fk_asset_assignments_asset_id');
    expect(sqlContent).toContain('fk_asset_assignments_employee_id');
    expect(sqlContent).toContain('DROP TABLE IF EXISTS asset_assignments;');
    expect(sqlContent).toContain('DROP TABLE IF EXISTS assets;');

    const utf8Matches = sqlContent.match(
      /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/g,
    );
    expect(utf8Matches?.length).toBe(2);
  });

  it('seed-core.ts khai báo 3 quyền hrm.assets.* và dữ liệu kho tài sản mẫu', () => {
    const seedContent = fs.readFileSync(
      path.resolve(process.cwd(), 'database/seed-core.ts'),
      'utf8',
    );
    expect(seedContent).toContain('hrm.assets.read');
    expect(seedContent).toContain('hrm.assets.manage');
    expect(seedContent).toContain('hrm.assets.export');
    expect(seedContent).toContain('TS-LT-001');
  });
});
