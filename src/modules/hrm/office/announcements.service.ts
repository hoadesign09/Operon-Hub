import {
  getDb,
  type AnnouncementCategory,
  type AnnouncementStatus,
  type EmploymentStatus,
} from '@/config/database';
import {
  buildPaginationMeta,
  parsePaginationParams,
  type PaginationMeta,
} from '@/lib/portable/pagination';
import { recordAuditLog } from '@/modules/audit/audit.service';
import { hasRequiredPermission, type AuthContext } from '@/modules/auth/auth.service';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/modules/hrm/office/announcements.schema';
import { AppError } from '@/shared/api-response';

const ACTIVE_EMPLOYMENT_STATUSES: EmploymentStatus[] = ['PROBATION', 'ACTIVE', 'ON_LEAVE'];

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  GENERAL: 'Thông báo chung',
  HR_POLICY: 'Chính sách Nhân sự',
  EVENT: 'Sự kiện nội bộ',
  URGENT: 'Khẩn cấp',
};

export interface AnnouncementItem {
  id: number;
  branchId: number | null;
  branchCode: string | null;
  branchName: string | null;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isPinned: boolean;
  publishedAt: string | null;
  status: AnnouncementStatus;
  authorId: number;
  authorName: string;
  isReadByMe: boolean;
  myReadAt: string | null;
  readCount: number;
  targetEmployeeCount: number;
  readRatePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementStats {
  total: number;
  unreadCount: number;
  pinnedCount: number;
  urgentCount: number;
}

export interface AnnouncementReaderItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  branchName: string;
  departmentName: string;
  positionName: string;
  isRead: boolean;
  readAt: string | null;
}

export interface AnnouncementReadersResult {
  summary: {
    targetEmployeeCount: number;
    readCount: number;
    unreadCount: number;
    readRatePercent: number;
  };
  items: AnnouncementReaderItem[];
}

function toIsoString(val: Date | string | null | undefined): string | null {
  if (!val) {
    return null;
  }
  const d = val instanceof Date ? val : new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toISOString();
}

export function computeReadRatePercent(readCount: number, targetEmployeeCount: number): number {
  if (targetEmployeeCount <= 0 || readCount <= 0) {
    return 0;
  }
  const raw = Math.round((readCount / targetEmployeeCount) * 1000) / 10;
  return Math.min(100, raw);
}

async function resolveSelfEmployeeId(userId: number): Promise<number | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees')
    .select(['id'])
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
  return row ? Number(row.id) : null;
}

function assertAnnouncementManageBranch(auth: AuthContext, branchId: number | null): void {
  if (auth.isSuperAdmin || auth.hasAllBranches) {
    return;
  }
  if (branchId === null) {
    throw new AppError(
      'FORBIDDEN_COMPANY_ANNOUNCEMENT',
      'Tài khoản phạm vi chi nhánh chỉ được tạo hoặc sửa thông báo trong chi nhánh của mình.',
      403,
    );
  }
  if (!auth.branchIds.includes(branchId)) {
    throw new AppError(
      'FORBIDDEN_BRANCH',
      'Bạn không có quyền quản trị thông báo thuộc chi nhánh này.',
      403,
    );
  }
}

async function notifyUrgentAnnouncementPublished(
  announcementId: number,
  title: string,
  branchId: number | null,
  authorUserId: number,
): Promise<number> {
  const db = getDb();
  let targetQuery = db
    .selectFrom('employees')
    .innerJoin('users', 'users.id', 'employees.user_id')
    .select(['users.id as user_id'])
    .where('employees.deleted_at', 'is', null)
    .where('employees.employment_status', 'in', ACTIVE_EMPLOYMENT_STATUSES)
    .where('employees.user_id', 'is not', null)
    .where('users.status', '=', 'ACTIVE')
    .where('users.deleted_at', 'is', null)
    .distinct();

  if (branchId !== null) {
    targetQuery = targetQuery.where('employees.branch_id', '=', branchId);
  }

  const rows = await targetQuery.execute();
  const userIds = rows
    .map((r) => Number(r.user_id))
    .filter((uid) => uid > 0 && uid !== authorUserId);

  if (userIds.length === 0) {
    return 0;
  }

  await db
    .insertInto('notifications')
    .values(
      userIds.map((userId) => ({
        user_id: userId,
        module_code: 'hrm',
        type: 'ANNOUNCEMENT_URGENT',
        title: `[KHẨN] ${title}`,
        message: 'Có thông báo nội bộ khẩn cấp mới vừa được phát hành. Vui lòng mở xem và xác nhận đã đọc.',
        link_url: `/hrm/office/announcements?highlight=${announcementId}`,
        is_read: 0,
      })),
    )
    .execute();

  return userIds.length;
}

async function loadTargetEmployeeCountsByBranch(): Promise<{
  companyTotal: number;
  byBranch: Map<number, number>;
}> {
  const db = getDb();
  const rows = await db
    .selectFrom('employees')
    .select(['branch_id', (eb) => eb.fn.count<number>('id').as('cnt')])
    .where('deleted_at', 'is', null)
    .where('employment_status', 'in', ACTIVE_EMPLOYMENT_STATUSES)
    .groupBy('branch_id')
    .execute();

  const byBranch = new Map<number, number>();
  let companyTotal = 0;
  for (const row of rows) {
    const cnt = Number(row.cnt ?? 0);
    byBranch.set(Number(row.branch_id), cnt);
    companyTotal += cnt;
  }
  return { companyTotal, byBranch };
}

export async function listAnnouncements(
  auth: AuthContext,
  query: {
    branchId?: string | null;
    category?: string | null;
    status?: string | null;
    readFilter?: string | null;
    pinnedOnly?: string | null;
    search?: string | null;
    page?: string | null;
    limit?: string | null;
  },
): Promise<{ items: AnnouncementItem[]; stats: AnnouncementStats; meta: PaginationMeta }> {
  const db = getDb();
  const canManage = hasRequiredPermission(auth, 'hrm.announcements.manage');
  const pagination = parsePaginationParams(
    { page: query.page, limit: query.limit },
    { defaultLimit: 20, maxLimit: 100 },
  );

  const selfEmployeeId = await resolveSelfEmployeeId(auth.userId);
  const requestedBranchId = query.branchId ? Number(query.branchId) : null;

  let visibleQuery = db
    .selectFrom('announcements')
    .leftJoin('branches', 'branches.id', 'announcements.branch_id')
    .innerJoin('users as author', 'author.id', 'announcements.author_id')
    .where('announcements.deleted_at', 'is', null);

  if (!auth.isSuperAdmin && !auth.hasAllBranches) {
    if (auth.branchIds.length > 0) {
      visibleQuery = visibleQuery.where((eb) =>
        eb.or([
          eb('announcements.branch_id', 'is', null),
          eb('announcements.branch_id', 'in', auth.branchIds),
        ]),
      );
    } else {
      visibleQuery = visibleQuery.where('announcements.branch_id', 'is', null);
    }
  }

  if (!canManage) {
    visibleQuery = visibleQuery.where('announcements.status', '=', 'PUBLISHED');
  } else if (
    query.status === 'DRAFT' ||
    query.status === 'PUBLISHED' ||
    query.status === 'ARCHIVED'
  ) {
    visibleQuery = visibleQuery.where('announcements.status', '=', query.status);
  }

  if (requestedBranchId && Number.isInteger(requestedBranchId) && requestedBranchId > 0) {
    visibleQuery = visibleQuery.where((eb) =>
      eb.or([
        eb('announcements.branch_id', 'is', null),
        eb('announcements.branch_id', '=', requestedBranchId),
      ]),
    );
  }

  if (
    query.category === 'GENERAL' ||
    query.category === 'HR_POLICY' ||
    query.category === 'EVENT' ||
    query.category === 'URGENT'
  ) {
    visibleQuery = visibleQuery.where('announcements.category', '=', query.category);
  }

  if (query.pinnedOnly === 'true' || query.pinnedOnly === '1') {
    visibleQuery = visibleQuery.where('announcements.is_pinned', '=', 1);
  }

  const keyword = query.search?.trim();
  if (keyword) {
    const like = `%${keyword}%`;
    visibleQuery = visibleQuery.where((eb) =>
      eb.or([eb('announcements.title', 'like', like), eb('announcements.content', 'like', like)]),
    );
  }

  const allMatchingRows = await visibleQuery
    .select([
      'announcements.id',
      'announcements.branch_id',
      'branches.code as branch_code',
      'branches.name as branch_name',
      'announcements.title',
      'announcements.content',
      'announcements.category',
      'announcements.is_pinned',
      'announcements.published_at',
      'announcements.status',
      'announcements.author_id',
      'author.full_name as author_name',
      'announcements.created_at',
      'announcements.updated_at',
    ])
    .orderBy('announcements.is_pinned', 'desc')
    .orderBy('announcements.published_at', 'desc')
    .orderBy('announcements.created_at', 'desc')
    .orderBy('announcements.id', 'desc')
    .execute();

  const announcementIds = allMatchingRows.map((r) => Number(r.id));
  const [targetCounts, readCountsRows, myReadRows] = await Promise.all([
    loadTargetEmployeeCountsByBranch(),
    announcementIds.length > 0
      ? db
          .selectFrom('announcement_reads')
          .innerJoin('employees', 'employees.id', 'announcement_reads.employee_id')
          .select([
            'announcement_reads.announcement_id',
            (eb) => eb.fn.count<number>('announcement_reads.employee_id').as('cnt'),
          ])
          .where('announcement_reads.announcement_id', 'in', announcementIds)
          .where('employees.deleted_at', 'is', null)
          .where('employees.employment_status', 'in', ACTIVE_EMPLOYMENT_STATUSES)
          .groupBy('announcement_reads.announcement_id')
          .execute()
      : Promise.resolve([]),
    announcementIds.length > 0 && selfEmployeeId !== null
      ? db
          .selectFrom('announcement_reads')
          .select(['announcement_id', 'read_at'])
          .where('announcement_id', 'in', announcementIds)
          .where('employee_id', '=', selfEmployeeId)
          .execute()
      : Promise.resolve([]),
  ]);

  const readCountMap = new Map<number, number>(
    readCountsRows.map((r) => [Number(r.announcement_id), Number(r.cnt ?? 0)]),
  );
  const myReadMap = new Map<number, string>(
    myReadRows.map((r) => [Number(r.announcement_id), toIsoString(r.read_at) ?? new Date().toISOString()]),
  );

  const enriched: AnnouncementItem[] = allMatchingRows.map((row) => {
    const id = Number(row.id);
    const branchId = row.branch_id !== null ? Number(row.branch_id) : null;
    const targetEmployeeCount =
      branchId === null
        ? targetCounts.companyTotal
        : targetCounts.byBranch.get(branchId) ?? 0;
    const readCount = readCountMap.get(id) ?? 0;
    const myReadAt = myReadMap.get(id) ?? null;

    return {
      id,
      branchId,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      title: row.title,
      content: row.content,
      category: row.category,
      isPinned: Number(row.is_pinned) === 1,
      publishedAt: toIsoString(row.published_at),
      status: row.status,
      authorId: Number(row.author_id),
      authorName: row.author_name,
      isReadByMe: myReadAt !== null,
      myReadAt,
      readCount,
      targetEmployeeCount,
      readRatePercent: computeReadRatePercent(readCount, targetEmployeeCount),
      createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
      updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    };
  });

  const stats: AnnouncementStats = {
    total: enriched.length,
    unreadCount: enriched.filter((a) => a.status === 'PUBLISHED' && !a.isReadByMe).length,
    pinnedCount: enriched.filter((a) => a.isPinned).length,
    urgentCount: enriched.filter((a) => a.category === 'URGENT' && a.status === 'PUBLISHED').length,
  };

  let filtered = enriched;
  if (query.readFilter === 'unread') {
    filtered = enriched.filter((a) => !a.isReadByMe);
  } else if (query.readFilter === 'read') {
    filtered = enriched.filter((a) => a.isReadByMe);
  }

  const paged = filtered.slice(pagination.offset, pagination.offset + pagination.limit);

  return {
    items: paged,
    stats,
    meta: buildPaginationMeta(filtered.length, pagination.page, pagination.limit),
  };
}

export async function getAnnouncementDetail(id: number, auth: AuthContext): Promise<AnnouncementItem> {
  const db = getDb();
  const canManage = hasRequiredPermission(auth, 'hrm.announcements.manage');

  const row = await db
    .selectFrom('announcements')
    .leftJoin('branches', 'branches.id', 'announcements.branch_id')
    .innerJoin('users as author', 'author.id', 'announcements.author_id')
    .select([
      'announcements.id',
      'announcements.branch_id',
      'branches.code as branch_code',
      'branches.name as branch_name',
      'announcements.title',
      'announcements.content',
      'announcements.category',
      'announcements.is_pinned',
      'announcements.published_at',
      'announcements.status',
      'announcements.author_id',
      'author.full_name as author_name',
      'announcements.created_at',
      'announcements.updated_at',
    ])
    .where('announcements.id', '=', id)
    .where('announcements.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    throw new AppError('ANNOUNCEMENT_NOT_FOUND', 'Không tìm thấy thông báo nội bộ.', 404);
  }

  const branchId = row.branch_id !== null ? Number(row.branch_id) : null;
  if (!auth.isSuperAdmin && !auth.hasAllBranches && branchId !== null && !auth.branchIds.includes(branchId)) {
    throw new AppError('FORBIDDEN_BRANCH', 'Bạn không có quyền xem thông báo thuộc chi nhánh này.', 403);
  }

  if (!canManage && row.status !== 'PUBLISHED') {
    throw new AppError('ANNOUNCEMENT_NOT_FOUND', 'Thông báo chưa được xuất bản hoặc không tồn tại.', 404);
  }

  const [selfEmployeeId, targetCounts, readRowCount] = await Promise.all([
    resolveSelfEmployeeId(auth.userId),
    loadTargetEmployeeCountsByBranch(),
    db
      .selectFrom('announcement_reads')
      .innerJoin('employees', 'employees.id', 'announcement_reads.employee_id')
      .select((eb) => eb.fn.count<number>('announcement_reads.employee_id').as('total'))
      .where('announcement_reads.announcement_id', '=', id)
      .where('employees.deleted_at', 'is', null)
      .where('employees.employment_status', 'in', ACTIVE_EMPLOYMENT_STATUSES)
      .executeTakeFirst(),
  ]);

  let myReadAt: string | null = null;
  if (selfEmployeeId !== null) {
    const myRow = await db
      .selectFrom('announcement_reads')
      .select(['read_at'])
      .where('announcement_id', '=', id)
      .where('employee_id', '=', selfEmployeeId)
      .executeTakeFirst();
    myReadAt = toIsoString(myRow?.read_at);
  }

  const targetEmployeeCount =
    branchId === null ? targetCounts.companyTotal : targetCounts.byBranch.get(branchId) ?? 0;
  const readCount = Number(readRowCount?.total ?? 0);

  return {
    id: Number(row.id),
    branchId,
    branchCode: row.branch_code,
    branchName: row.branch_name,
    title: row.title,
    content: row.content,
    category: row.category,
    isPinned: Number(row.is_pinned) === 1,
    publishedAt: toIsoString(row.published_at),
    status: row.status,
    authorId: Number(row.author_id),
    authorName: row.author_name,
    isReadByMe: myReadAt !== null,
    myReadAt,
    readCount,
    targetEmployeeCount,
    readRatePercent: computeReadRatePercent(readCount, targetEmployeeCount),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AnnouncementItem> {
  const branchId = input.branchId ?? null;
  assertAnnouncementManageBranch(auth, branchId);
  const db = getDb();

  if (branchId !== null) {
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', branchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh nhận thông báo không tồn tại.', 404);
    }
  }

  const nextStatus: AnnouncementStatus = input.publishNow ? 'PUBLISHED' : 'DRAFT';
  const now = new Date();

  const inserted = await db
    .insertInto('announcements')
    .values({
      branch_id: branchId,
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category,
      is_pinned: input.isPinned ? 1 : 0,
      published_at: input.publishNow ? now : null,
      status: nextStatus,
      author_id: auth.userId,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .executeTakeFirstOrThrow();

  const announcementId = Number(inserted.insertId);

  if (input.publishNow && input.category === 'URGENT') {
    await notifyUrgentAnnouncementPublished(announcementId, input.title.trim(), branchId, auth.userId);
  }

  const detail = await getAnnouncementDetail(announcementId, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ANNOUNCEMENT_CREATE',
    entityType: 'announcements',
    entityId: String(announcementId),
    newValues: { ...detail },
    ipAddress,
  });

  return detail;
}

export async function updateAnnouncement(
  id: number,
  input: UpdateAnnouncementInput,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AnnouncementItem> {
  const existing = await getAnnouncementDetail(id, auth);
  assertAnnouncementManageBranch(auth, existing.branchId);

  const nextBranchId = input.branchId !== undefined ? input.branchId : existing.branchId;
  assertAnnouncementManageBranch(auth, nextBranchId);

  const db = getDb();
  if (nextBranchId !== null && nextBranchId !== existing.branchId) {
    const branch = await db
      .selectFrom('branches')
      .select(['id'])
      .where('id', '=', nextBranchId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
    if (!branch) {
      throw new AppError('BRANCH_NOT_FOUND', 'Chi nhánh nhận thông báo không tồn tại.', 404);
    }
  }

  const nextStatus = input.status ?? existing.status;
  const nextCategory = input.category ?? existing.category;
  const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
  const isTransitioningToPublished = existing.status !== 'PUBLISHED' && nextStatus === 'PUBLISHED';

  await db
    .updateTable('announcements')
    .set({
      branch_id: nextBranchId,
      title: nextTitle,
      content: input.content !== undefined ? input.content.trim() : existing.content,
      category: nextCategory,
      is_pinned: input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : existing.isPinned ? 1 : 0,
      status: nextStatus,
      published_at: isTransitioningToPublished
        ? new Date()
        : existing.publishedAt
          ? new Date(existing.publishedAt)
          : null,
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  if (isTransitioningToPublished && nextCategory === 'URGENT') {
    await notifyUrgentAnnouncementPublished(id, nextTitle, nextBranchId, auth.userId);
  }

  const updated = await getAnnouncementDetail(id, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ANNOUNCEMENT_UPDATE',
    entityType: 'announcements',
    entityId: String(id),
    oldValues: { ...existing },
    newValues: { ...updated },
    ipAddress,
  });

  return updated;
}

export async function publishAnnouncement(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<AnnouncementItem> {
  const existing = await getAnnouncementDetail(id, auth);
  assertAnnouncementManageBranch(auth, existing.branchId);

  if (existing.status === 'PUBLISHED') {
    throw new AppError(
      'ANNOUNCEMENT_ALREADY_PUBLISHED',
      'Thông báo này đã được xuất bản trước đó.',
      409,
    );
  }

  const db = getDb();
  await db
    .updateTable('announcements')
    .set({
      status: 'PUBLISHED',
      published_at: new Date(),
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  if (existing.category === 'URGENT') {
    await notifyUrgentAnnouncementPublished(id, existing.title, existing.branchId, auth.userId);
  }

  const updated = await getAnnouncementDetail(id, auth);

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ANNOUNCEMENT_PUBLISH',
    entityType: 'announcements',
    entityId: String(id),
    oldValues: { status: existing.status },
    newValues: { status: 'PUBLISHED', publishedAt: updated.publishedAt },
    ipAddress,
  });

  return updated;
}

export async function deleteAnnouncement(
  id: number,
  auth: AuthContext,
  ipAddress: string | null,
): Promise<void> {
  const existing = await getAnnouncementDetail(id, auth);
  assertAnnouncementManageBranch(auth, existing.branchId);

  const db = getDb();
  await db
    .updateTable('announcements')
    .set({
      deleted_at: new Date(),
      status: 'ARCHIVED',
      updated_by: auth.userId,
    })
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .execute();

  await recordAuditLog({
    userId: auth.userId,
    moduleCode: 'hrm',
    action: 'ANNOUNCEMENT_DELETE',
    entityType: 'announcements',
    entityId: String(id),
    oldValues: { ...existing },
    ipAddress,
  });
}

export async function markAnnouncementRead(
  id: number,
  auth: AuthContext,
): Promise<{
  announcementId: number;
  isRead: boolean;
  readAt: string;
  readCount: number;
  targetEmployeeCount: number;
  readRatePercent: number;
}> {
  const announcement = await getAnnouncementDetail(id, auth);
  if (announcement.status !== 'PUBLISHED') {
    throw new AppError(
      'ANNOUNCEMENT_NOT_PUBLISHED',
      'Chỉ có thể đánh dấu đã đọc đối với thông báo đã xuất bản.',
      400,
    );
  }

  const selfEmployeeId = await resolveSelfEmployeeId(auth.userId);
  if (!selfEmployeeId) {
    throw new AppError(
      'EMPLOYEE_PROFILE_REQUIRED',
      'Tài khoản của bạn chưa gắn hồ sơ nhân viên để ghi nhận trạng thái đã đọc.',
      400,
    );
  }

  const db = getDb();
  await db
    .insertInto('announcement_reads')
    .ignore()
    .values({
      announcement_id: id,
      employee_id: selfEmployeeId,
    })
    .execute();

  const refreshed = await getAnnouncementDetail(id, auth);

  return {
    announcementId: id,
    isRead: true,
    readAt: refreshed.myReadAt ?? new Date().toISOString(),
    readCount: refreshed.readCount,
    targetEmployeeCount: refreshed.targetEmployeeCount,
    readRatePercent: refreshed.readRatePercent,
  };
}

export async function listAnnouncementReaders(
  id: number,
  auth: AuthContext,
  query: { filter?: string | null; search?: string | null },
): Promise<AnnouncementReadersResult> {
  const announcement = await getAnnouncementDetail(id, auth);
  assertAnnouncementManageBranch(auth, announcement.branchId);

  const db = getDb();
  let empQuery = db
    .selectFrom('employees')
    .innerJoin('branches', 'branches.id', 'employees.branch_id')
    .innerJoin('departments', 'departments.id', 'employees.department_id')
    .innerJoin('positions', 'positions.id', 'employees.position_id')
    .leftJoin('announcement_reads', (join) =>
      join
        .onRef('announcement_reads.employee_id', '=', 'employees.id')
        .on('announcement_reads.announcement_id', '=', id),
    )
    .select([
      'employees.id as employee_id',
      'employees.employee_code',
      'employees.full_name',
      'branches.name as branch_name',
      'departments.name as department_name',
      'positions.name as position_name',
      'announcement_reads.read_at',
    ])
    .where('employees.deleted_at', 'is', null)
    .where('employees.employment_status', 'in', ACTIVE_EMPLOYMENT_STATUSES);

  if (announcement.branchId !== null) {
    empQuery = empQuery.where('employees.branch_id', '=', announcement.branchId);
  }

  const rows = await empQuery
    .orderBy('announcement_reads.read_at', 'desc')
    .orderBy('employees.employee_code', 'asc')
    .execute();

  const allItems: AnnouncementReaderItem[] = rows.map((row) => ({
    employeeId: Number(row.employee_id),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    branchName: row.branch_name,
    departmentName: row.department_name,
    positionName: row.position_name,
    isRead: row.read_at !== null && row.read_at !== undefined,
    readAt: toIsoString(row.read_at),
  }));

  const targetEmployeeCount = allItems.length;
  const readCount = allItems.filter((item) => item.isRead).length;
  const unreadCount = targetEmployeeCount - readCount;

  let filtered = allItems;
  if (query.filter === 'read') {
    filtered = filtered.filter((item) => item.isRead);
  } else if (query.filter === 'unread') {
    filtered = filtered.filter((item) => !item.isRead);
  }

  const keyword = query.search?.trim().toLowerCase();
  if (keyword) {
    filtered = filtered.filter(
      (item) =>
        item.fullName.toLowerCase().includes(keyword) ||
        item.employeeCode.toLowerCase().includes(keyword) ||
        item.departmentName.toLowerCase().includes(keyword),
    );
  }

  return {
    summary: {
      targetEmployeeCount,
      readCount,
      unreadCount,
      readRatePercent: computeReadRatePercent(readCount, targetEmployeeCount),
    },
    items: filtered,
  };
}
