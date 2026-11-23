import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationSql, splitSqlStatements } from '../../database/migrator';

describe('database/000002 Core Auth, RBAC & Branches migration', () => {
  it('contains all 8 Core tables with utf8mb4, proper constraints, and reverse DOWN drops', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'database',
      'migrations',
      '20261123_000002_init_core_auth_rbac_branches.sql',
    );
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = parseMigrationSql(content, '20261123_000002_init_core_auth_rbac_branches.sql');

    const upStatements = splitSqlStatements(parsed.upSql);
    const downStatements = splitSqlStatements(parsed.downSql);

    expect(upStatements).toHaveLength(8);
    expect(downStatements).toHaveLength(8);

    const expectedTables = [
      'branches',
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'refresh_tokens',
      'audit_logs',
    ];
    for (const table of expectedTables) {
      expect(parsed.upSql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(parsed.downSql).toContain(`DROP TABLE IF EXISTS ${table}`);
    }

    expect(parsed.upSql).toContain('fk_role_permissions_role_id');
    expect(parsed.upSql).toContain('fk_user_roles_branch_id');
    expect(parsed.upSql).toContain('uq_refresh_tokens_token_hash');
    expect(parsed.upSql).toContain('utf8mb4_unicode_ci');

    // audit_logs must be dropped before users, and user_roles before branches
    expect(parsed.downSql.indexOf('DROP TABLE IF EXISTS audit_logs')).toBeLessThan(
      parsed.downSql.indexOf('DROP TABLE IF EXISTS users'),
    );
    expect(parsed.downSql.indexOf('DROP TABLE IF EXISTS user_roles')).toBeLessThan(
      parsed.downSql.indexOf('DROP TABLE IF EXISTS branches'),
    );
  });
});
