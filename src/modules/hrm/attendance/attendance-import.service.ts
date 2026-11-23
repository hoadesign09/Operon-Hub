import { getDb } from '@/config/database';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import { parseExcelBuffer, type ExcelPrimitiveValue } from '@/lib/portable/excel-importer';
import { recordAuditLog } from '@/modules/audit/audit.service';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import {
  buildSqlDateTime,
  computeAttendanceMetrics,
  parseFlexibleTime,
  parseFlexibleWorkDate,
  parseTimeToMinutes,
} from '@/modules/hrm/attendance/attendance-calculator';
import { isHolidayDate } from '@/modules/hrm/attendance/holidays.service';
import { isEmployeeMonthLocked } from '@/modules/hrm/attendance/attendance-summaries.service';
import { resolveEffectiveShift } from '@/modules/hrm/attendance/shifts.service';
import { AppError } from '@/shared/api-response';

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 2000;
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  '',
]);

const COLUMN_ALIASES = {
  employeeCode: ['mã nv', 'ma nv', 'employee_code', 'employeecode', 'mã nhân viên', 'ma nhan vien'],
  workDate: ['ngày công', 'ngay cong', 'work_date', 'workdate', 'ngày', 'ngay'],
  checkIn: ['giờ vào', 'gio vao', 'check_in', 'checkin', 'check in'],
  checkOut: ['giờ ra', 'gio ra', 'check_out', 'checkout', 'check out'],
  note: ['ghi chú', 'ghi chu', 'note'],
} as const;

export interface AttendanceImportErrorRow {
  rowNumber: number;
  employeeCode: string;
  workDate: string;
  message: string;
}

export interface AttendanceImportSummary {
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  errors: AttendanceImportErrorRow[];
}

export interface UploadedExcelInput {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function pickCellByAliases(
  rowValues: Record<string, ExcelPrimitiveValue>,
  aliases: readonly string[],
): ExcelPrimitiveValue {
  const aliasSet = new Set(aliases);
  for (const [header, value] of Object.entries(rowValues)) {
    if (aliasSet.has(normalizeKey(header))) {
      return value;
    }
  }
  return null;
}

export function validateImportExcelFile(file: Pick<UploadedExcelInput, 'name' | 'type' | 'size'>): void {
  const lowerName = file.name.trim().toLowerCase();
  if (!lowerName.endsWith('.xlsx')) {
    throw new AppError(
      'INVALID_FILE_TYPE',
      'Chỉ chấp nhận file Excel định dạng .xlsx (Microsoft Excel 2007+).',
      400,
    );
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new AppError(
      'INVALID_FILE_MIME',
      'Định dạng MIME file không hợp lệ, vui lòng tải lên file .xlsx chuẩn.',
      400,
    );
  }
  if (file.size <= 0) {
    throw new AppError('EMPTY_FILE', 'File tải lên không có dữ liệu.', 400);
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new AppError(
      'FILE_TOO_LARGE',
      'Dung lượng file vượt quá giới hạn 5MB. Vui lòng chia nhỏ file trước khi import.',
      400,
    );
  }
}

export async function buildAttendanceImportTemplateExcel(): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const sampleRows = [
    {
      employeeCode: 'NV0001',
      workDate: '2026-11-23',
      checkIn: '08:05',
      checkOut: '17:35',
      note: 'Import từ máy chấm công',
    },
    {
      employeeCode: 'NV0002',
      workDate: '2026-11-23',
      checkIn: '08:25',
      checkOut: '17:30',
      note: 'Đi muộn 25 phút',
    },
  ];

  const buffer = await buildExcelBuffer(
    sampleRows,
    [
      { header: 'Mã NV', key: 'employeeCode', width: 14 },
      { header: 'Ngày công', key: 'workDate', width: 16, align: 'center' },
      { header: 'Giờ vào', key: 'checkIn', width: 12, align: 'center' },
      { header: 'Giờ ra', key: 'checkOut', width: 12, align: 'center' },
      { header: 'Ghi chú', key: 'note', width: 32 },
    ],
    {
      sheetName: 'MauChamCong',
      title: 'MẪU IMPORT CHẤM CÔNG HÀNG NGÀY (OPERON HUB)',
      subtitle: 'Định dạng Ngày công: YYYY-MM-DD hoặc DD/MM/YYYY | Giờ vào/ra: HH:mm (ví dụ 08:00, 17:30)',
      autoFilter: false,
    },
  );

  return {
    buffer,
    fileName: 'mau-import-cham-cong.xlsx',
  };
}

export async function importAttendanceExcel(
  file: UploadedExcelInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AttendanceImportSummary> {
  validateImportExcelFile(file);

  let parsed;
  try {
    parsed = await parseExcelBuffer(file.buffer, {
      expectedHeaders: [...COLUMN_ALIASES.employeeCode, ...COLUMN_ALIASES.workDate],
      maxRows: MAX_IMPORT_ROWS,
    });
  } catch (err) {
    throw new AppError(
      'EXCEL_PARSE_ERROR',
      err instanceof Error ? err.message : 'Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng.',
      400,
    );
  }

  const normalizedHeaders = new Set(parsed.headers.map(normalizeKey));
  const hasEmpCol = COLUMN_ALIASES.employeeCode.some((a) => normalizedHeaders.has(a));
  const hasDateCol = COLUMN_ALIASES.workDate.some((a) => normalizedHeaders.has(a));
  if (!hasEmpCol || !hasDateCol) {
    throw new AppError(
      'INVALID_TEMPLATE_COLUMNS',
      'File Excel thiếu cột bắt buộc "Mã NV" (employee_code) hoặc "Ngày công" (work_date). Vui lòng tải file mẫu chuẩn.',
      400,
    );
  }

  if (parsed.rows.length === 0) {
    throw new AppError('EMPTY_IMPORT_DATA', 'File Excel không có dòng dữ liệu chấm công nào.', 400);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  const db = getDb();

  const employeeCodes = Array.from(
    new Set(
      parsed.rows
        .map((r) => pickCellByAliases(r.values, COLUMN_ALIASES.employeeCode))
        .filter((v): v is string | number => v !== null && String(v).trim().length > 0)
        .map((v) => String(v).trim().toUpperCase()),
    ),
  );

  const empMap = new Map<
    string,
    { id: number; branchId: number; departmentId: number; userId: number | null }
  >();

  if (employeeCodes.length > 0) {
    const empRows = await db
      .selectFrom('employees')
      .select(['id', 'employee_code', 'branch_id', 'department_id', 'user_id'])
      .where('employee_code', 'in', employeeCodes)
      .where('deleted_at', 'is', null)
      .execute();

    for (const row of empRows) {
      empMap.set(String(row.employee_code).toUpperCase(), {
        id: Number(row.id),
        branchId: Number(row.branch_id),
        departmentId: Number(row.department_id),
        userId: row.user_id !== null ? Number(row.user_id) : null,
      });
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: AttendanceImportErrorRow[] = [];

  for (const row of parsed.rows) {
    const rawCode = pickCellByAliases(row.values, COLUMN_ALIASES.employeeCode);
    const rawDate = pickCellByAliases(row.values, COLUMN_ALIASES.workDate);
    const rawIn = pickCellByAliases(row.values, COLUMN_ALIASES.checkIn);
    const rawOut = pickCellByAliases(row.values, COLUMN_ALIASES.checkOut);
    const rawNote = pickCellByAliases(row.values, COLUMN_ALIASES.note);

    const employeeCode = rawCode !== null ? String(rawCode).trim().toUpperCase() : '';
    const workDateDisplay = rawDate !== null ? String(rawDate).trim() : '';

    if (!employeeCode) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode: '',
        workDate: workDateDisplay,
        message: 'Thiếu mã nhân viên.',
      });
      continue;
    }

    const emp = empMap.get(employeeCode);
    if (!emp) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate: workDateDisplay,
        message: `Không tìm thấy nhân viên có mã "${employeeCode}".`,
      });
      continue;
    }

    if (!isEmployeeWithinScope(scope, emp, auth.userId)) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate: workDateDisplay,
        message: 'Nhân viên nằm ngoài phạm vi Data Scope của bạn.',
      });
      continue;
    }

    const workDate = parseFlexibleWorkDate(rawDate);
    if (!workDate) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate: workDateDisplay,
        message: 'Ngày công không hợp lệ (dùng YYYY-MM-DD hoặc DD/MM/YYYY).',
      });
      continue;
    }

    if (await isEmployeeMonthLocked(emp.id, workDate)) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate,
        message: 'Bảng công tháng của nhân viên này đã chốt khóa (LOCKED), không thể ghi đè.',
      });
      continue;
    }

    const checkInStr = rawIn !== null ? parseFlexibleTime(rawIn) : null;
    if (rawIn !== null && checkInStr === null) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate,
        message: `Giờ vào "${String(rawIn)}" không hợp lệ (định dạng HH:mm).`,
      });
      continue;
    }

    const checkOutStr = rawOut !== null ? parseFlexibleTime(rawOut) : null;
    if (rawOut !== null && checkOutStr === null) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate,
        message: `Giờ ra "${String(rawOut)}" không hợp lệ (định dạng HH:mm).`,
      });
      continue;
    }

    const [shift, holiday] = await Promise.all([
      resolveEffectiveShift(emp.id, emp.branchId, workDate),
      isHolidayDate(workDate, emp.branchId),
    ]);

    let metrics;
    try {
      metrics = computeAttendanceMetrics({
        checkInMinutes: parseTimeToMinutes(checkInStr),
        checkOutMinutes: parseTimeToMinutes(checkOutStr),
        shift,
        isHoliday: holiday,
      });
    } catch (err) {
      errors.push({
        rowNumber: row.rowNumber,
        employeeCode,
        workDate,
        message: err instanceof Error ? err.message : 'Thời gian vào/ra không hợp lệ.',
      });
      continue;
    }

    const noteText = rawNote !== null ? String(rawNote).trim().slice(0, 500) : null;

    const existing = await db
      .selectFrom('attendance_logs')
      .select(['id'])
      .where('employee_id', '=', emp.id)
      .where('work_date', '=', workDate)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable('attendance_logs')
        .set({
          shift_id: shift?.id ?? null,
          check_in_at: buildSqlDateTime(workDate, checkInStr),
          check_out_at: buildSqlDateTime(workDate, checkOutStr),
          source: 'IMPORT',
          late_minutes: metrics.lateMinutes,
          early_leave_minutes: metrics.earlyLeaveMinutes,
          worked_hours: metrics.workedHours.toFixed(2),
          status: metrics.status,
          note: noteText,
          deleted_at: null,
          updated_by: auth.userId,
        })
        .where('id', '=', Number(existing.id))
        .execute();
      updatedCount += 1;
    } else {
      await db
        .insertInto('attendance_logs')
        .values({
          employee_id: emp.id,
          work_date: workDate,
          shift_id: shift?.id ?? null,
          check_in_at: buildSqlDateTime(workDate, checkInStr),
          check_out_at: buildSqlDateTime(workDate, checkOutStr),
          source: 'IMPORT',
          late_minutes: metrics.lateMinutes,
          early_leave_minutes: metrics.earlyLeaveMinutes,
          worked_hours: metrics.workedHours.toFixed(2),
          status: metrics.status,
          note: noteText,
          created_by: auth.userId,
          updated_by: auth.userId,
        })
        .execute();
      createdCount += 1;
    }
  }

  const summary: AttendanceImportSummary = {
    totalRows: parsed.rows.length,
    createdCount,
    updatedCount,
    errorCount: errors.length,
    errors,
  };

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'IMPORT_ATTENDANCE_EXCEL',
    entityType: 'attendance_logs',
    entityId: file.name.slice(0, 80),
    newValues: {
      fileName: file.name,
      totalRows: summary.totalRows,
      createdCount: summary.createdCount,
      updatedCount: summary.updatedCount,
      errorCount: summary.errorCount,
    },
    ipAddress,
  });

  return summary;
}
