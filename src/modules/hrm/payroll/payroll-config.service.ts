import { getDb } from '@/config/database';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  DEFAULT_PAYROLL_CONFIG,
  DEFAULT_VN_PIT_BRACKETS,
  type PayrollConfig,
  type PitBracketConfig,
} from '@/modules/hrm/payroll/payroll-calculator';
import type { PayrollConfigInput } from '@/modules/hrm/payroll/payroll.schema';

export const PAYROLL_CONFIG_SETTING_KEY = 'hrm.payroll.config';

function normalizePitBrackets(raw: unknown): PitBracketConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_VN_PIT_BRACKETS;
  }

  const normalized: PitBracketConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const rate = Number(record.rate);
    const upTo = record.upTo === null ? null : Number(record.upTo);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      continue;
    }
    if (upTo !== null && (!Number.isFinite(upTo) || upTo <= 0)) {
      continue;
    }
    normalized.push({ upTo, rate });
  }

  return normalized.length > 0 ? normalized : DEFAULT_VN_PIT_BRACKETS;
}

export function parsePayrollConfigJson(raw: unknown): PayrollConfig {
  let obj: Record<string, unknown> | null = null;

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      obj = null;
    }
  }

  if (!obj) {
    return {
      ...DEFAULT_PAYROLL_CONFIG,
      pitBrackets: [...DEFAULT_VN_PIT_BRACKETS],
    };
  }

  const pickNum = (key: string, fallback: number): number => {
    const val = Number(obj?.[key]);
    return Number.isFinite(val) && val >= 0 ? val : fallback;
  };

  return {
    bhxhEmpRate: pickNum('bhxhEmpRate', DEFAULT_PAYROLL_CONFIG.bhxhEmpRate),
    bhytEmpRate: pickNum('bhytEmpRate', DEFAULT_PAYROLL_CONFIG.bhytEmpRate),
    bhtnEmpRate: pickNum('bhtnEmpRate', DEFAULT_PAYROLL_CONFIG.bhtnEmpRate),
    bhxhBhytSalaryCap: pickNum(
      'bhxhBhytSalaryCap',
      DEFAULT_PAYROLL_CONFIG.bhxhBhytSalaryCap,
    ),
    bhtnSalaryCap: pickNum('bhtnSalaryCap', DEFAULT_PAYROLL_CONFIG.bhtnSalaryCap),
    personalDeduction: pickNum(
      'personalDeduction',
      DEFAULT_PAYROLL_CONFIG.personalDeduction,
    ),
    dependentDeduction: pickNum(
      'dependentDeduction',
      DEFAULT_PAYROLL_CONFIG.dependentDeduction,
    ),
    workingHoursPerDay:
      pickNum('workingHoursPerDay', DEFAULT_PAYROLL_CONFIG.workingHoursPerDay) || 8,
    otRate150: pickNum('otRate150', DEFAULT_PAYROLL_CONFIG.otRate150) || 1.5,
    otRate200: pickNum('otRate200', DEFAULT_PAYROLL_CONFIG.otRate200) || 2.0,
    otRate300: pickNum('otRate300', DEFAULT_PAYROLL_CONFIG.otRate300) || 3.0,
    requireLockedAttendance:
      typeof obj.requireLockedAttendance === 'boolean'
        ? obj.requireLockedAttendance
        : DEFAULT_PAYROLL_CONFIG.requireLockedAttendance,
    pitBrackets: normalizePitBrackets(obj.pitBrackets),
  };
}

export async function getPayrollConfig(): Promise<PayrollConfig> {
  const db = getDb();
  const row = await db
    .selectFrom('settings')
    .select(['setting_value'])
    .where('setting_key', '=', PAYROLL_CONFIG_SETTING_KEY)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return {
      ...DEFAULT_PAYROLL_CONFIG,
      pitBrackets: [...DEFAULT_VN_PIT_BRACKETS],
    };
  }

  return parsePayrollConfigJson(row.setting_value);
}

export async function updatePayrollConfig(
  input: PayrollConfigInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<PayrollConfig> {
  const db = getDb();
  const existingRow = await db
    .selectFrom('settings')
    .select(['id', 'setting_value'])
    .where('setting_key', '=', PAYROLL_CONFIG_SETTING_KEY)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  const previousConfig = existingRow
    ? parsePayrollConfigJson(existingRow.setting_value)
    : { ...DEFAULT_PAYROLL_CONFIG, pitBrackets: [...DEFAULT_VN_PIT_BRACKETS] };

  const nextConfig: PayrollConfig = {
    bhxhEmpRate: input.bhxhEmpRate,
    bhytEmpRate: input.bhytEmpRate,
    bhtnEmpRate: input.bhtnEmpRate,
    bhxhBhytSalaryCap: input.bhxhBhytSalaryCap,
    bhtnSalaryCap: input.bhtnSalaryCap,
    personalDeduction: input.personalDeduction,
    dependentDeduction: input.dependentDeduction,
    workingHoursPerDay: input.workingHoursPerDay,
    otRate150: input.otRate150,
    otRate200: input.otRate200,
    otRate300: input.otRate300,
    requireLockedAttendance: input.requireLockedAttendance,
    pitBrackets: input.pitBrackets ?? previousConfig.pitBrackets,
  };

  const serialized = JSON.stringify(nextConfig);

  if (existingRow) {
    await db
      .updateTable('settings')
      .set({
        setting_value: serialized,
        updated_by: auth.userId,
      })
      .where('id', '=', Number(existingRow.id))
      .execute();
  } else {
    await db
      .insertInto('settings')
      .values({
        module_code: 'hrm',
        setting_key: PAYROLL_CONFIG_SETTING_KEY,
        setting_value: serialized,
        description:
          'Cấu hình tỷ lệ BHXH/BHYT/BHTN, mức trần, giảm trừ gia cảnh và biểu thuế TNCN lũy tiến 7 bậc',
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .execute();
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UPDATE_PAYROLL_CONFIG',
    entityType: 'settings',
    entityId: PAYROLL_CONFIG_SETTING_KEY,
    oldValues: { ...previousConfig },
    newValues: { ...nextConfig },
    ipAddress,
  });

  return nextConfig;
}
