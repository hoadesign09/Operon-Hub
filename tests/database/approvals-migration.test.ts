import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql, splitSqlStatements } from '../../database/migrator';

describe('database/000003 Approvals & Notifications migration', () => {
  it('contains all 5 tables with utf8mb4, FKs, indexes and reverse DOWN drops', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'database',
      'migrations',
      '20261123_000003_init_core_approvals_notifications.sql',
    );
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseMigrationSql(
      content,
      '20261123_000003_init_core_approvals_notifications.sql',
    );

    expect(splitSqlStatements(parsed.upSql)).toHaveLength(5);
    expect(splitSqlStatements(parsed.downSql)).toHaveLength(5);

    const expectedTables = [
      'approval_workflows',
      'approval_workflow_steps',
      'approval_requests',
      'approval_histories',
      'notifications',
    ];
    for (const table of expectedTables) {
      expect(parsed.upSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(parsed.downSql).toContain(`DROP TABLE IF EXISTS ${table}`);
    }

    expect(parsed.upSql).toContain('uq_approval_workflow_steps_order');
    expect(parsed.upSql).toContain('idx_notifications_user_unread');
    expect(parsed.upSql).toContain('utf8mb4_unicode_ci');

    expect(parsed.downSql.indexOf('DROP TABLE IF EXISTS approval_histories')).toBeLessThan(
      parsed.downSql.indexOf('DROP TABLE IF EXISTS approval_requests'),
    );
    expect(parsed.downSql.indexOf('DROP TABLE IF EXISTS approval_requests')).toBeLessThan(
      parsed.downSql.indexOf('DROP TABLE IF EXISTS approval_workflows'),
    );
  });
});
