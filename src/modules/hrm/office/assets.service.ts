import {
  getDb,
  type AssetAssignmentStatus,
  type AssetCategory,
  type AssetStatus,
  type EmploymentStatus,
} from '@/config/database';
import { roundCurrency } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer, type ExcelColumn } from '@/lib/portable/excel-exporter';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import {
  isEmployeeWithinScope,
  resolveEmployeeAccessScope,
} from '@/modules/hrm/employees/employees.scope';
import type {
  AssignAssetInput,
  CreateAssetInput,
  ReturnAssetInput,
  UpdateAssetInput,
} from '@/modules/hrm/office/assets.schema';
import { AppError } from '@/shared/api-response';

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  LAPTOP: 'Laptop / Máy tính',
  MONITOR: 'Màn hình',
  PHONE: 'Điện thoại / Thiết bị di động',
  FURNITURE: 'Nội thất văn phòng',
  OTHER: 'Thiết bị khác',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  AVAILABLE: 'Sẵn sàng',
  ASSIGNED: 'Đang cấp phát',
  MAINTENANCE: 'Đang bảo trì',
  RETIRED: 'Đã thanh lý',
};

export interface AssetListItem {
  id: number;
  branchId: number;
  branchCode: string;
  branchName: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyExpiryDate: string | null;
  purchaseValue: number;
  status: AssetStatus;
  note: string | null;
  activeAssignmentId: number | null;
  holderEmployeeId: number | null;
  holderEmployeeCode: string | null;
  holderEmployeeName: string | null;
  holderDepartmentName: string | null;
  holderEmploymentStatus: EmploymentStatus | null;
  assignedAt: string | null;
  createdAt: string;
}

export interface AssetAssignmentItem {
  id: number;
  assetId: number;
  assetCode: string;
  assetName: string;
  assetCategory: AssetCategory;
  serialNumber: string | null;
  branchId: number;
  branchName: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentId: number;
  departmentName: string;
  positionName: string;
  assignedByName: string | null;
  returnedByName: string | null;
  assignedAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  conditionOnAssign: string;
  conditionOnReturn: string | null;
  status: AssetAssignmentStatus;
  note: string | null;
}

export interface AssetInventoryStats {
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  retired: number;
  totalValue: number;
}

export interface OffboardingAssetAlertItem {
  assignmentId: number;
  assetId: number;
  assetCode: string;
  assetName: string;
  category: AssetCategory;
  serialNumber: string | null;
  branchId: number;
  branchName: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  employmentStatus: EmploymentStatus;
  terminationDate: string | null;
  assignedAt: string;
}

export interface AssetListQuery {
  branchId?: string | null;
  category?: string | null;
  status?: string | null;
  search?: string | null;
  page?: string | null;
  limit?: string | null;
}

const VALID_CATEGORIES = new Set<AssetCategory>([
  'LAPTOP',
  'MONITOR',
  'PHONE',
  'FURNITURE',
  'OTHER',
]);
const VALID_STATUSES = new Set<AssetStatus>([
  'AVAILABLE',
  'ASSIGNED',
  'MAINTENANCE',
  'RETIRED',
]);

function toIsoDateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function parseDateOrNow(isoDate?: string | null): Date {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return new Date(`${isoDate}T09:00:00+07:00`);
  }
  return new Date();
}

function assertBranchWriteAllowed(auth: AuthContext, branchId: number): void {
  if (auth.isSuperAdmin || auth.dataScope === 'ALL' || auth.hasAllBranches) {
    return;
  }
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền thao tác tài sản thuộc chi nhánh ngoài phạm vi quản lý.',
      403,
    );
  }
}

export async function getUnreturnedAssetsForEmployee(employeeId: number): Promise<
  Array<{
    assignmentId: number;
    assetId: number;
    assetCode: string;
    assetName: string;
    category: AssetCategory;
    assignedAt: string;
  }>
> {
  const db = getDb();
  const rows = await db
    .selectFrom('asset_assignments as aa')
    .innerJoin('assets as a', 'a.id', 'aa.asset_id')
    .select([
      'aa.id as assignment_id',
      'a.id as asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.category',
      'aa.assigned_at',
    ])
    .where('aa.employee_id', '=', employeeId)
    .where('aa.status', '=', 'ACTIVE')
    .where('aa.deleted_at', 'is', null)
    .where('a.deleted_at', 'is', null)
    .orderBy('aa.assigned_at', 'asc')
    .execute();

  return rows.map((r) => ({
    assignmentId: Number(r.assignment_id),
    assetId: Number(r.asset_id),
    assetCode: String(r.asset_code),
    assetName: String(r.asset_name),
    category: r.category,
    assignedAt: formatDateVN(r.assigned_at),
  }));
}

async function buildFilteredAssetsQuery(auth: AuthContext, query: AssetListQuery) {
  const scope = await resolveEmployeeAccessScope(auth);
  if (
    (scope.mode === 'BRANCH' && scope.branchIds.length === 0) ||
    (scope.mode === 'OWN' && scope.selfEmployeeId === null) ||
    (scope.mode === 'DEPARTMENT' &&
      scope.departmentIds.length === 0 &&
      scope.selfEmployeeId === null)
  ) {
    return null;
  }

  const db = getDb();
  let builder = db
    .selectFrom('assets as a')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .leftJoin('asset_assignments as aa', (join) =>
      join
        .onRef('aa.asset_id', '=', 'a.id')
        .on('aa.status', '=', 'ACTIVE')
        .on('aa.deleted_at', 'is', null),
    )
    .leftJoin('employees as e', 'e.id', 'aa.employee_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .where('a.deleted_at', 'is', null);

  if (scope.mode === 'BRANCH') {
    builder = builder.where('a.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    builder = builder.where((eb) => {
      const clauses = [];
      if (scope.departmentIds.length > 0) {
        clauses.push(eb('e.department_id', 'in', scope.departmentIds));
      }
      if (scope.selfEmployeeId !== null) {
        clauses.push(eb('aa.employee_id', '=', scope.selfEmployeeId));
      }
      return eb.or(clauses);
    });
  } else if (scope.mode === 'OWN' && scope.selfEmployeeId !== null) {
    builder = builder.where('aa.employee_id', '=', scope.selfEmployeeId);
  }

  if (query.branchId && Number(query.branchId) > 0) {
    const bid = Number(query.branchId);
    if (scope.mode === 'BRANCH' && !scope.branchIds.includes(bid)) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn không có quyền xem tài sản của chi nhánh này.',
        403,
      );
    }
    builder = builder.where('a.branch_id', '=', bid);
  }

  if (query.category && VALID_CATEGORIES.has(query.category as AssetCategory)) {
    builder = builder.where('a.category', '=', query.category as AssetCategory);
  }
  if (query.status && VALID_STATUSES.has(query.status as AssetStatus)) {
    builder = builder.where('a.status', '=', query.status as AssetStatus);
  }
  if (query.search && query.search.trim().length > 0) {
    const kw = `%${query.search.trim()}%`;
    builder = builder.where((eb) =>
      eb.or([
        eb('a.asset_code', 'like', kw),
        eb('a.name', 'like', kw),
        eb('a.serial_number', 'like', kw),
        eb('a.brand', 'like', kw),
        eb('e.employee_code', 'like', kw),
        eb('e.full_name', 'like', kw),
      ]),
    );
  }

  return builder;
}

function mapAssetRow(row: {
  id: number | bigint;
  branch_id: number | bigint;
  branch_code: string;
  branch_name: string;
  asset_code: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: Date | string | null;
  warranty_expiry_date: Date | string | null;
  purchase_value: string | number;
  status: AssetStatus;
  note: string | null;
  active_assignment_id: number | bigint | null;
  holder_employee_id: number | bigint | null;
  holder_employee_code: string | null;
  holder_employee_name: string | null;
  holder_department_name: string | null;
  holder_employment_status: EmploymentStatus | null;
  assigned_at: Date | string | null;
  created_at: Date | string;
}): AssetListItem {
  return {
    id: Number(row.id),
    branchId: Number(row.branch_id),
    branchCode: String(row.branch_code),
    branchName: String(row.branch_name),
    assetCode: String(row.asset_code),
    name: String(row.name),
    category: row.category,
    brand: row.brand ? String(row.brand) : null,
    model: row.model ? String(row.model) : null,
    serialNumber: row.serial_number ? String(row.serial_number) : null,
    purchaseDate: toIsoDateOnly(row.purchase_date),
    warrantyExpiryDate: toIsoDateOnly(row.warranty_expiry_date),
    purchaseValue: Number(row.purchase_value),
    status: row.status,
    note: row.note ? String(row.note) : null,
    activeAssignmentId:
      row.active_assignment_id !== null ? Number(row.active_assignment_id) : null,
    holderEmployeeId:
      row.holder_employee_id !== null ? Number(row.holder_employee_id) : null,
    holderEmployeeCode: row.holder_employee_code ? String(row.holder_employee_code) : null,
    holderEmployeeName: row.holder_employee_name ? String(row.holder_employee_name) : null,
    holderDepartmentName: row.holder_department_name
      ? String(row.holder_department_name)
      : null,
    holderEmploymentStatus: row.holder_employment_status ?? null,
    assignedAt: row.assigned_at ? formatDateVN(row.assigned_at) : null,
    createdAt: formatDateTimeVN(row.created_at),
  };
}

export async function listAssets(
  auth: AuthContext,
  query: AssetListQuery,
): Promise<{
  items: AssetListItem[];
  stats: AssetInventoryStats;
  meta: PaginationMeta;
}> {
  const pagination = parsePaginationParams(
    { page: query.page ?? undefined, limit: query.limit ?? undefined },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const emptyStats: AssetInventoryStats = {
    total: 0,
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
    totalValue: 0,
  };

  const baseQuery = await buildFilteredAssetsQuery(auth, query);
  if (!baseQuery) {
    return {
      items: [],
      stats: emptyStats,
      meta: buildPaginationMeta(0, pagination.page, pagination.limit),
    };
  }

  const [metricRows, rows] = await Promise.all([
    baseQuery.select(['a.status', 'a.purchase_value']).execute(),
    baseQuery
      .select([
        'a.id',
        'a.branch_id',
        'b.code as branch_code',
        'b.name as branch_name',
        'a.asset_code',
        'a.name',
        'a.category',
        'a.brand',
        'a.model',
        'a.serial_number',
        'a.purchase_date',
        'a.warranty_expiry_date',
        'a.purchase_value',
        'a.status',
        'a.note',
        'aa.id as active_assignment_id',
        'aa.employee_id as holder_employee_id',
        'e.employee_code as holder_employee_code',
        'e.full_name as holder_employee_name',
        'd.name as holder_department_name',
        'e.employment_status as holder_employment_status',
        'aa.assigned_at',
        'a.created_at',
      ])
      .orderBy('a.asset_code', 'asc')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .execute(),
  ]);

  const stats: AssetInventoryStats = {
    total: metricRows.length,
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
    totalValue: 0,
  };

  for (const r of metricRows) {
    if (r.status === 'AVAILABLE') stats.available += 1;
    else if (r.status === 'ASSIGNED') stats.assigned += 1;
    else if (r.status === 'MAINTENANCE') stats.maintenance += 1;
    else if (r.status === 'RETIRED') stats.retired += 1;
    stats.totalValue += Number(r.purchase_value);
  }
  stats.totalValue = roundCurrency(stats.totalValue, 0);

  return {
    items: rows.map(mapAssetRow),
    stats,
    meta: buildPaginationMeta(metricRows.length, pagination.page, pagination.limit),
  };
}

async function getAssetByIdRaw(assetId: number) {
  const db = getDb();
  return db
    .selectFrom('assets as a')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .leftJoin('asset_assignments as aa', (join) =>
      join
        .onRef('aa.asset_id', '=', 'a.id')
        .on('aa.status', '=', 'ACTIVE')
        .on('aa.deleted_at', 'is', null),
    )
    .leftJoin('employees as e', 'e.id', 'aa.employee_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'a.id',
      'a.branch_id',
      'b.code as branch_code',
      'b.name as branch_name',
      'a.asset_code',
      'a.name',
      'a.category',
      'a.brand',
      'a.model',
      'a.serial_number',
      'a.purchase_date',
      'a.warranty_expiry_date',
      'a.purchase_value',
      'a.status',
      'a.note',
      'aa.id as active_assignment_id',
      'aa.employee_id as holder_employee_id',
      'e.employee_code as holder_employee_code',
      'e.full_name as holder_employee_name',
      'e.department_id as holder_department_id',
      'e.user_id as holder_user_id',
      'd.name as holder_department_name',
      'e.employment_status as holder_employment_status',
      'aa.assigned_at',
      'a.created_at',
    ])
    .where('a.id', '=', assetId)
    .where('a.deleted_at', 'is', null)
    .executeTakeFirst();
}

export async function getAssetDetail(
  assetId: number,
  auth: AuthContext,
): Promise<{ asset: AssetListItem; assignments: AssetAssignmentItem[] }> {
  const row = await getAssetByIdRaw(assetId);
  if (!row) {
    throw new AppError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản.', 404);
  }

  const scope = await resolveEmployeeAccessScope(auth);
  if (scope.mode === 'BRANCH' && !scope.branchIds.includes(Number(row.branch_id))) {
    throw new AppError(
      'FORBIDDEN',
      'Bạn không có quyền xem tài sản ngoài chi nhánh được phân công.',
      403,
    );
  } else if (scope.mode === 'DEPARTMENT' || scope.mode === 'OWN') {
    const holderAllowed =
      row.holder_employee_id !== null &&
      row.holder_department_id !== null &&
      isEmployeeWithinScope(
        scope,
        {
          id: Number(row.holder_employee_id),
          branchId: Number(row.branch_id),
          departmentId: Number(row.holder_department_id),
          userId: row.holder_user_id !== null ? Number(row.holder_user_id) : null,
        },
        auth.userId,
      );
    if (!holderAllowed) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền xem tài sản này.', 403);
    }
  }

  const db = getDb();
  const assignRows = await db
    .selectFrom('asset_assignments as aa')
    .innerJoin('assets as a', 'a.id', 'aa.asset_id')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .innerJoin('employees as e', 'e.id', 'aa.employee_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .leftJoin('users as ab', 'ab.id', 'aa.assigned_by')
    .leftJoin('users as rb', 'rb.id', 'aa.returned_by')
    .select([
      'aa.id',
      'aa.asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.category as asset_category',
      'a.serial_number',
      'a.branch_id',
      'b.name as branch_name',
      'aa.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.department_id',
      'd.name as department_name',
      'pos.name as position_name',
      'ab.full_name as assigned_by_name',
      'rb.full_name as returned_by_name',
      'aa.assigned_at',
      'aa.expected_return_at',
      'aa.returned_at',
      'aa.condition_on_assign',
      'aa.condition_on_return',
      'aa.status',
      'aa.note',
    ])
    .where('aa.asset_id', '=', assetId)
    .where('aa.deleted_at', 'is', null)
    .orderBy('aa.assigned_at', 'desc')
    .orderBy('aa.id', 'desc')
    .execute();

  return {
    asset: mapAssetRow(row),
    assignments: assignRows.map((r) => ({
      id: Number(r.id),
      assetId: Number(r.asset_id),
      assetCode: String(r.asset_code),
      assetName: String(r.asset_name),
      assetCategory: r.asset_category,
      serialNumber: r.serial_number ? String(r.serial_number) : null,
      branchId: Number(r.branch_id),
      branchName: String(r.branch_name),
      employeeId: Number(r.employee_id),
      employeeCode: String(r.employee_code),
      employeeName: String(r.employee_name),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      positionName: String(r.position_name),
      assignedByName: r.assigned_by_name ? String(r.assigned_by_name) : null,
      returnedByName: r.returned_by_name ? String(r.returned_by_name) : null,
      assignedAt: formatDateTimeVN(r.assigned_at),
      expectedReturnAt: toIsoDateOnly(r.expected_return_at),
      returnedAt: r.returned_at ? formatDateTimeVN(r.returned_at) : null,
      conditionOnAssign: String(r.condition_on_assign),
      conditionOnReturn: r.condition_on_return ? String(r.condition_on_return) : null,
      status: r.status,
      note: r.note ? String(r.note) : null,
    })),
  };
}

export async function createAsset(
  input: CreateAssetInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AssetListItem> {
  assertBranchWriteAllowed(auth, input.branchId);
  const db = getDb();

  const normalizedCode = input.assetCode.trim().toUpperCase();
  const [branch, dupCode] = await Promise.all([
    db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', input.branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('assets')
      .select(['id'])
      .where('asset_code', '=', normalizedCode)
      .executeTakeFirst(),
  ]);

  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'Không tìm thấy chi nhánh quản lý.', 404);
  }
  if (dupCode) {
    throw new AppError(
      'ASSET_CODE_DUPLICATE',
      `Mã tài sản "${normalizedCode}" đã tồn tại.`,
      409,
    );
  }

  const inserted = await db
    .insertInto('assets')
    .values({
      branch_id: input.branchId,
      asset_code: normalizedCode,
      name: input.name.trim(),
      category: input.category,
      brand: input.brand?.trim() || null,
      model: input.model?.trim() || null,
      serial_number: input.serialNumber?.trim() || null,
      purchase_date: input.purchaseDate ?? null,
      warranty_expiry_date: input.warrantyExpiryDate ?? null,
      purchase_value: roundCurrency(input.purchaseValue, 0).toFixed(2),
      status: input.status,
      note: input.note?.trim() || null,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const assetId = Number(inserted.insertId);
  const createdRow = await getAssetByIdRaw(assetId);
  const mapped = mapAssetRow(createdRow!);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'CREATE_ASSET',
    entityType: 'assets',
    entityId: String(assetId),
    newValues: { ...mapped },
    ipAddress,
  });

  return mapped;
}

export async function updateAsset(
  assetId: number,
  input: UpdateAssetInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AssetListItem> {
  const existing = await getAssetByIdRaw(assetId);
  if (!existing) {
    throw new AppError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản.', 404);
  }

  assertBranchWriteAllowed(auth, Number(existing.branch_id));
  if (input.branchId !== undefined) {
    assertBranchWriteAllowed(auth, input.branchId);
  }

  if (input.status !== undefined && input.status !== existing.status) {
    if (input.status === 'ASSIGNED') {
      throw new AppError(
        'INVALID_STATUS_CHANGE',
        'Không thể đổi trực tiếp sang trạng thái Đang cấp phát. Vui lòng sử dụng chức năng Cấp phát tài sản.',
        400,
      );
    }
    if (existing.status === 'ASSIGNED') {
      throw new AppError(
        'ASSET_CURRENTLY_ASSIGNED',
        'Tài sản đang được cấp phát. Vui lòng thực hiện Thu hồi trước khi đổi trạng thái.',
        409,
      );
    }
  }

  const db = getDb();
  let normalizedCode = existing.asset_code;
  if (input.assetCode !== undefined) {
    normalizedCode = input.assetCode.trim().toUpperCase();
    if (normalizedCode !== existing.asset_code) {
      const dup = await db
        .selectFrom('assets')
        .select(['id'])
        .where('asset_code', '=', normalizedCode)
        .where('id', '!=', assetId)
        .executeTakeFirst();
      if (dup) {
        throw new AppError(
          'ASSET_CODE_DUPLICATE',
          `Mã tài sản "${normalizedCode}" đã tồn tại.`,
          409,
        );
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    asset_code: normalizedCode,
    updated_by: auth.userId,
  };
  if (input.branchId !== undefined) updatePayload.branch_id = input.branchId;
  if (input.name !== undefined) updatePayload.name = input.name.trim();
  if (input.category !== undefined) updatePayload.category = input.category;
  if (input.brand !== undefined) updatePayload.brand = input.brand?.trim() || null;
  if (input.model !== undefined) updatePayload.model = input.model?.trim() || null;
  if (input.serialNumber !== undefined) {
    updatePayload.serial_number = input.serialNumber?.trim() || null;
  }
  if (input.purchaseDate !== undefined) updatePayload.purchase_date = input.purchaseDate;
  if (input.warrantyExpiryDate !== undefined) {
    updatePayload.warranty_expiry_date = input.warrantyExpiryDate;
  }
  if (input.purchaseValue !== undefined) {
    updatePayload.purchase_value = roundCurrency(input.purchaseValue, 0).toFixed(2);
  }
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.note !== undefined) updatePayload.note = input.note?.trim() || null;

  await db
    .updateTable('assets')
    .set(updatePayload)
    .where('id', '=', assetId)
    .execute();

  const updated = mapAssetRow((await getAssetByIdRaw(assetId))!);
  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'UPDATE_ASSET',
    entityType: 'assets',
    entityId: String(assetId),
    oldValues: {
      assetCode: existing.asset_code,
      name: existing.name,
      status: existing.status,
      purchaseValue: Number(existing.purchase_value),
    },
    newValues: {
      assetCode: updated.assetCode,
      name: updated.name,
      status: updated.status,
      purchaseValue: updated.purchaseValue,
    },
    ipAddress,
  });

  return updated;
}

export async function deleteAsset(
  assetId: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const existing = await getAssetByIdRaw(assetId);
  if (!existing) {
    throw new AppError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản.', 404);
  }
  assertBranchWriteAllowed(auth, Number(existing.branch_id));

  if (existing.status === 'ASSIGNED' || existing.active_assignment_id !== null) {
    throw new AppError(
      'ASSET_CURRENTLY_ASSIGNED',
      'Không thể xóa tài sản đang được cấp phát cho nhân viên. Hãy thu hồi thiết bị trước.',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('assets')
    .set({ deleted_at: new Date(), updated_by: auth.userId })
    .where('id', '=', assetId)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'DELETE_ASSET',
    entityType: 'assets',
    entityId: String(assetId),
    oldValues: { assetCode: existing.asset_code, name: existing.name },
    ipAddress,
  });
}

export async function assignAsset(
  assetId: number,
  input: AssignAssetInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ asset: AssetListItem; assignmentId: number }> {
  const db = getDb();

  const employee = await db
    .selectFrom('employees')
    .select(['id', 'user_id', 'employee_code', 'full_name', 'branch_id', 'employment_status'])
    .where('id', '=', input.employeeId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!employee) {
    throw new AppError('EMPLOYEE_NOT_FOUND', 'Không tìm thấy nhân viên tiếp nhận.', 404);
  }
  if (
    employee.employment_status === 'RESIGNED' ||
    employee.employment_status === 'TERMINATED'
  ) {
    throw new AppError(
      'EMPLOYEE_NOT_ACTIVE',
      'Không thể cấp phát tài sản cho nhân viên đã nghỉ việc hoặc chấm dứt hợp đồng.',
      400,
    );
  }

  const assignedDate = parseDateOrNow(input.assignedAt);
  let assignmentId = 0;
  let assetCode = '';
  let assetName = '';

  await db.transaction().execute(async (trx) => {
    const lockedAsset = await trx
      .selectFrom('assets')
      .select(['id', 'branch_id', 'asset_code', 'name', 'status'])
      .where('id', '=', assetId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedAsset) {
      throw new AppError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản.', 404);
    }
    assertBranchWriteAllowed(auth, Number(lockedAsset.branch_id));

    if (lockedAsset.status !== 'AVAILABLE') {
      throw new AppError(
        'ASSET_NOT_AVAILABLE',
        `Tài sản "${lockedAsset.asset_code}" hiện đang ở trạng thái ${ASSET_STATUS_LABELS[lockedAsset.status]}, không thể cấp phát.`,
        409,
      );
    }

    const activeExisting = await trx
      .selectFrom('asset_assignments')
      .select(['id'])
      .where('asset_id', '=', assetId)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (activeExisting) {
      throw new AppError(
        'ASSET_NOT_AVAILABLE',
        'Tài sản hiện đang có lượt cấp phát chưa thu hồi.',
        409,
      );
    }

    const inserted = await trx
      .insertInto('asset_assignments')
      .values({
        asset_id: assetId,
        employee_id: input.employeeId,
        assigned_by: auth.userId,
        returned_by: null,
        assigned_at: assignedDate,
        expected_return_at: input.expectedReturnAt ?? null,
        returned_at: null,
        condition_on_assign: input.conditionOnAssign.trim(),
        condition_on_return: null,
        status: 'ACTIVE',
        note: input.note?.trim() || null,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .executeTakeFirstOrThrow();

    assignmentId = Number(inserted.insertId);
    assetCode = String(lockedAsset.asset_code);
    assetName = String(lockedAsset.name);

    await trx
      .updateTable('assets')
      .set({ status: 'ASSIGNED', updated_by: auth.userId })
      .where('id', '=', assetId)
      .execute();
  });

  if (employee.user_id !== null) {
    await db
      .insertInto('notifications')
      .values({
        user_id: Number(employee.user_id),
        module_code: 'hrm',
        type: 'ASSET',
        title: `Bạn được cấp phát thiết bị ${assetCode}`,
        message: `Tài sản "${assetName}" (${assetCode}) đã được bàn giao cho bạn. Xem chi tiết và tải biên bản bàn giao tại mục Tài sản của tôi.`,
        link_url: '/my/assets',
        is_read: 0,
      })
      .execute();
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ASSIGN_ASSET',
    entityType: 'asset_assignments',
    entityId: String(assignmentId),
    newValues: {
      assetId,
      assetCode,
      employeeId: input.employeeId,
      employeeCode: employee.employee_code,
      conditionOnAssign: input.conditionOnAssign.trim(),
    },
    ipAddress,
  });

  const updatedAsset = mapAssetRow((await getAssetByIdRaw(assetId))!);
  return { asset: updatedAsset, assignmentId };
}

export async function returnAsset(
  assetId: number,
  input: ReturnAssetInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<{ asset: AssetListItem; assignmentId: number }> {
  const db = getDb();
  const returnedDate = parseDateOrNow(input.returnedAt);

  let assignmentId = 0;
  let assetCode = '';
  let assetName = '';
  let targetEmployeeId = 0;

  await db.transaction().execute(async (trx) => {
    const lockedAsset = await trx
      .selectFrom('assets')
      .select(['id', 'branch_id', 'asset_code', 'name', 'status'])
      .where('id', '=', assetId)
      .where('deleted_at', 'is', null)
      .forUpdate()
      .executeTakeFirst();

    if (!lockedAsset) {
      throw new AppError('ASSET_NOT_FOUND', 'Không tìm thấy tài sản.', 404);
    }
    assertBranchWriteAllowed(auth, Number(lockedAsset.branch_id));

    const activeAssignment = await trx
      .selectFrom('asset_assignments')
      .select(['id', 'employee_id'])
      .where('asset_id', '=', assetId)
      .where('status', '=', 'ACTIVE')
      .where('deleted_at', 'is', null)
      .executeTakeFirst();

    if (lockedAsset.status !== 'ASSIGNED' || !activeAssignment) {
      throw new AppError(
        'ASSET_NOT_ASSIGNED',
        'Tài sản hiện không ở trạng thái đang cấp phát để thu hồi.',
        409,
      );
    }

    assignmentId = Number(activeAssignment.id);
    targetEmployeeId = Number(activeAssignment.employee_id);
    assetCode = String(lockedAsset.asset_code);
    assetName = String(lockedAsset.name);

    await trx
      .updateTable('asset_assignments')
      .set({
        status: 'RETURNED',
        returned_at: returnedDate,
        returned_by: auth.userId,
        condition_on_return: input.conditionOnReturn.trim(),
        note: input.note?.trim() || null,
        updated_by: auth.userId,
      })
      .where('id', '=', assignmentId)
      .execute();

    await trx
      .updateTable('assets')
      .set({ status: input.nextStatus, updated_by: auth.userId })
      .where('id', '=', assetId)
      .execute();
  });

  const emp = await db
    .selectFrom('employees')
    .select(['user_id', 'employee_code'])
    .where('id', '=', targetEmployeeId)
    .executeTakeFirst();

  if (emp && emp.user_id !== null) {
    await db
      .insertInto('notifications')
      .values({
        user_id: Number(emp.user_id),
        module_code: 'hrm',
        type: 'ASSET',
        title: `Đã xác nhận thu hồi thiết bị ${assetCode}`,
        message: `Hành chính đã tiếp nhận bàn giao trả tài sản "${assetName}" (${assetCode}). Bạn có thể tải biên bản thu hồi tại mục Tài sản của tôi.`,
        link_url: '/my/assets',
        is_read: 0,
      })
      .execute();
  }

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'RETURN_ASSET',
    entityType: 'asset_assignments',
    entityId: String(assignmentId),
    newValues: {
      assetId,
      assetCode,
      employeeId: targetEmployeeId,
      nextStatus: input.nextStatus,
      conditionOnReturn: input.conditionOnReturn.trim(),
    },
    ipAddress,
  });

  const updatedAsset = mapAssetRow((await getAssetByIdRaw(assetId))!);
  return { asset: updatedAsset, assignmentId };
}

export async function listOffboardingAssetAlerts(
  auth: AuthContext,
): Promise<OffboardingAssetAlertItem[]> {
  const scope = await resolveEmployeeAccessScope(auth);
  if (scope.mode === 'BRANCH' && scope.branchIds.length === 0) {
    return [];
  }

  const db = getDb();
  let query = db
    .selectFrom('asset_assignments as aa')
    .innerJoin('assets as a', 'a.id', 'aa.asset_id')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .innerJoin('employees as e', 'e.id', 'aa.employee_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'aa.id as assignment_id',
      'a.id as asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.category',
      'a.serial_number',
      'a.branch_id',
      'b.name as branch_name',
      'e.id as employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'd.name as department_name',
      'e.employment_status',
      'e.termination_date',
      'aa.assigned_at',
    ])
    .where('aa.status', '=', 'ACTIVE')
    .where('aa.deleted_at', 'is', null)
    .where('a.deleted_at', 'is', null)
    .where('e.employment_status', 'in', ['RESIGNED', 'TERMINATED']);

  if (scope.mode === 'BRANCH') {
    query = query.where('a.branch_id', 'in', scope.branchIds);
  } else if (scope.mode === 'DEPARTMENT') {
    if (scope.departmentIds.length === 0) return [];
    query = query.where('e.department_id', 'in', scope.departmentIds);
  } else if (scope.mode === 'OWN') {
    if (scope.selfEmployeeId === null) return [];
    query = query.where('e.id', '=', scope.selfEmployeeId);
  }

  const rows = await query.orderBy('aa.assigned_at', 'asc').execute();

  return rows.map((r) => ({
    assignmentId: Number(r.assignment_id),
    assetId: Number(r.asset_id),
    assetCode: String(r.asset_code),
    assetName: String(r.asset_name),
    category: r.category,
    serialNumber: r.serial_number ? String(r.serial_number) : null,
    branchId: Number(r.branch_id),
    branchName: String(r.branch_name),
    employeeId: Number(r.employee_id),
    employeeCode: String(r.employee_code),
    employeeName: String(r.employee_name),
    departmentName: String(r.department_name),
    employmentStatus: r.employment_status,
    terminationDate: toIsoDateOnly(r.termination_date),
    assignedAt: formatDateVN(r.assigned_at),
  }));
}

export async function exportAssetsExcel(
  auth: AuthContext,
  query: AssetListQuery,
): Promise<{ buffer: Buffer; fileName: string }> {
  const { items } = await listAssets(auth, {
    ...query,
    page: '1',
    limit: '100',
  });

  const columns: ExcelColumn<AssetListItem>[] = [
    { header: 'Mã tài sản', key: 'assetCode', width: 15 },
    { header: 'Tên tài sản', key: 'name', width: 28 },
    {
      header: 'Loại thiết bị',
      key: 'category',
      width: 22,
      value: (r) => ASSET_CATEGORY_LABELS[r.category],
    },
    { header: 'Hãng', key: 'brand', width: 14 },
    { header: 'Model', key: 'model', width: 16 },
    { header: 'Số Serial', key: 'serialNumber', width: 18 },
    { header: 'Chi nhánh', key: 'branchName', width: 20 },
    {
      header: 'Ngày mua',
      key: 'purchaseDate',
      width: 14,
      value: (r) => (r.purchaseDate ? formatDateVN(r.purchaseDate) : ''),
    },
    {
      header: 'Hạn bảo hành',
      key: 'warrantyExpiryDate',
      width: 14,
      value: (r) => (r.warrantyExpiryDate ? formatDateVN(r.warrantyExpiryDate) : ''),
    },
    { header: 'Nguyên giá (VNĐ)', key: 'purchaseValue', width: 18, numFmt: '#,##0' },
    {
      header: 'Trạng thái',
      key: 'status',
      width: 16,
      value: (r) => ASSET_STATUS_LABELS[r.status],
    },
    { header: 'Mã NV đang giữ', key: 'holderEmployeeCode', width: 15 },
    { header: 'Người đang sử dụng', key: 'holderEmployeeName', width: 24 },
    { header: 'Ngày cấp phát', key: 'assignedAt', width: 14 },
  ];

  const buffer = await buildExcelBuffer(items, columns, {
    sheetName: 'KhoTaiSan',
    freezeHeader: true,
    autoFilter: true,
  });

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return {
    buffer,
    fileName: `danh-sach-tai-san-${dateStamp}.xlsx`,
  };
}

export async function listMyAssets(auth: AuthContext): Promise<{
  activeItems: AssetAssignmentItem[];
  historyItems: AssetAssignmentItem[];
}> {
  const db = getDb();
  const emp = await db
    .selectFrom('employees')
    .select(['id'])
    .where('user_id', '=', auth.userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();

  if (!emp) {
    return { activeItems: [], historyItems: [] };
  }

  const rows = await db
    .selectFrom('asset_assignments as aa')
    .innerJoin('assets as a', 'a.id', 'aa.asset_id')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .innerJoin('employees as e', 'e.id', 'aa.employee_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .leftJoin('users as ab', 'ab.id', 'aa.assigned_by')
    .leftJoin('users as rb', 'rb.id', 'aa.returned_by')
    .select([
      'aa.id',
      'aa.asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.category as asset_category',
      'a.serial_number',
      'a.branch_id',
      'b.name as branch_name',
      'aa.employee_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.department_id',
      'd.name as department_name',
      'pos.name as position_name',
      'ab.full_name as assigned_by_name',
      'rb.full_name as returned_by_name',
      'aa.assigned_at',
      'aa.expected_return_at',
      'aa.returned_at',
      'aa.condition_on_assign',
      'aa.condition_on_return',
      'aa.status',
      'aa.note',
    ])
    .where('aa.employee_id', '=', Number(emp.id))
    .where('aa.deleted_at', 'is', null)
    .where('a.deleted_at', 'is', null)
    .orderBy('aa.assigned_at', 'desc')
    .execute();

  const mapped: AssetAssignmentItem[] = rows.map((r) => ({
    id: Number(r.id),
    assetId: Number(r.asset_id),
    assetCode: String(r.asset_code),
    assetName: String(r.asset_name),
    assetCategory: r.asset_category,
    serialNumber: r.serial_number ? String(r.serial_number) : null,
    branchId: Number(r.branch_id),
    branchName: String(r.branch_name),
    employeeId: Number(r.employee_id),
    employeeCode: String(r.employee_code),
    employeeName: String(r.employee_name),
    departmentId: Number(r.department_id),
    departmentName: String(r.department_name),
    positionName: String(r.position_name),
    assignedByName: r.assigned_by_name ? String(r.assigned_by_name) : null,
    returnedByName: r.returned_by_name ? String(r.returned_by_name) : null,
    assignedAt: formatDateTimeVN(r.assigned_at),
    expectedReturnAt: toIsoDateOnly(r.expected_return_at),
    returnedAt: r.returned_at ? formatDateTimeVN(r.returned_at) : null,
    conditionOnAssign: String(r.condition_on_assign),
    conditionOnReturn: r.condition_on_return ? String(r.condition_on_return) : null,
    status: r.status,
    note: r.note ? String(r.note) : null,
  }));

  return {
    activeItems: mapped.filter((i) => i.status === 'ACTIVE'),
    historyItems: mapped.filter((i) => i.status === 'RETURNED'),
  };
}

export async function getAssetAssignmentForPdf(
  assignmentId: number,
  auth: AuthContext,
): Promise<AssetAssignmentItem & { purchaseValue: number; brand: string | null; model: string | null }> {
  const db = getDb();
  const row = await db
    .selectFrom('asset_assignments as aa')
    .innerJoin('assets as a', 'a.id', 'aa.asset_id')
    .innerJoin('branches as b', 'b.id', 'a.branch_id')
    .innerJoin('employees as e', 'e.id', 'aa.employee_id')
    .innerJoin('departments as d', 'd.id', 'e.department_id')
    .innerJoin('positions as pos', 'pos.id', 'e.position_id')
    .leftJoin('users as ab', 'ab.id', 'aa.assigned_by')
    .leftJoin('users as rb', 'rb.id', 'aa.returned_by')
    .select([
      'aa.id',
      'aa.asset_id',
      'a.asset_code',
      'a.name as asset_name',
      'a.category as asset_category',
      'a.brand',
      'a.model',
      'a.serial_number',
      'a.purchase_value',
      'a.branch_id',
      'b.name as branch_name',
      'aa.employee_id',
      'e.user_id as employee_user_id',
      'e.employee_code',
      'e.full_name as employee_name',
      'e.department_id',
      'd.name as department_name',
      'pos.name as position_name',
      'ab.full_name as assigned_by_name',
      'rb.full_name as returned_by_name',
      'aa.assigned_at',
      'aa.expected_return_at',
      'aa.returned_at',
      'aa.condition_on_assign',
      'aa.condition_on_return',
      'aa.status',
      'aa.note',
    ])
    .where('aa.id', '=', assignmentId)
    .where('aa.deleted_at', 'is', null)
    .where('a.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ASSIGNMENT_NOT_FOUND', 'Không tìm thấy biên bản cấp phát tài sản.', 404);
  }

  const isOwner =
    row.employee_user_id !== null && Number(row.employee_user_id) === auth.userId;
  if (!isOwner) {
    if (!hasRequiredPermission(auth, 'hrm.assets.read')) {
      throw new AppError('FORBIDDEN', 'Bạn không có quyền tải biên bản bàn giao này.', 403);
    }
    const scope = await resolveEmployeeAccessScope(auth);
    if (scope.mode === 'BRANCH' && !scope.branchIds.includes(Number(row.branch_id))) {
      throw new AppError(
        'FORBIDDEN',
        'Bạn không có quyền tải biên bản tài sản ngoài chi nhánh quản lý.',
        403,
      );
    } else if (scope.mode === 'DEPARTMENT' || scope.mode === 'OWN') {
      const allowed = isEmployeeWithinScope(
        scope,
        {
          id: Number(row.employee_id),
          branchId: Number(row.branch_id),
          departmentId: Number(row.department_id),
          userId: row.employee_user_id !== null ? Number(row.employee_user_id) : null,
        },
        auth.userId,
      );
      if (!allowed) {
        throw new AppError('FORBIDDEN', 'Bạn không có quyền tải biên bản bàn giao này.', 403);
      }
    }
  }

  return {
    id: Number(row.id),
    assetId: Number(row.asset_id),
    assetCode: String(row.asset_code),
    assetName: String(row.asset_name),
    assetCategory: row.asset_category,
    brand: row.brand ? String(row.brand) : null,
    model: row.model ? String(row.model) : null,
    serialNumber: row.serial_number ? String(row.serial_number) : null,
    purchaseValue: Number(row.purchase_value),
    branchId: Number(row.branch_id),
    branchName: String(row.branch_name),
    employeeId: Number(row.employee_id),
    employeeCode: String(row.employee_code),
    employeeName: String(row.employee_name),
    departmentId: Number(row.department_id),
    departmentName: String(row.department_name),
    positionName: String(row.position_name),
    assignedByName: row.assigned_by_name ? String(row.assigned_by_name) : null,
    returnedByName: row.returned_by_name ? String(row.returned_by_name) : null,
    assignedAt: formatDateTimeVN(row.assigned_at),
    expectedReturnAt: toIsoDateOnly(row.expected_return_at),
    returnedAt: row.returned_at ? formatDateTimeVN(row.returned_at) : null,
    conditionOnAssign: String(row.condition_on_assign),
    conditionOnReturn: row.condition_on_return ? String(row.condition_on_return) : null,
    status: row.status,
    note: row.note ? String(row.note) : null,
  };
}
