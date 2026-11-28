'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconCopy,
  IconEye,
  IconFileSpreadsheet,
  IconIdBadge2,
  IconLoader2,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  EmployeeFormModal,
  type DepartmentOption,
  type PositionOption,
  type ProvisionedAccountBanner,
} from '@/components/hrm/EmployeeFormModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface EmployeeRow {
  id: number;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  workEmail: string;
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn?: string | null;
  departmentId: number;
  departmentName: string;
  departmentNameEn?: string | null;
  positionId: number;
  positionName: string;
  positionNameEn?: string | null;
  hireDate: string;
  employmentStatus: 'PROBATION' | 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'TERMINATED';
  userId: number | null;
  userStatus: 'ACTIVE' | 'LOCKED' | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGES: Record<
  EmployeeRow['employmentStatus'],
  { vi: string; en: string; className: string }
> = {
  PROBATION: { vi: 'Thử việc', en: 'Probation', className: 'bg-amber-50 text-amber-700' },
  ACTIVE: { vi: 'Chính thức', en: 'Active', className: 'bg-emerald-50 text-emerald-700' },
  ON_LEAVE: { vi: 'Tạm nghỉ', en: 'On Leave', className: 'bg-sky-50 text-sky-700' },
  RESIGNED: { vi: 'Đã nghỉ việc', en: 'Resigned', className: 'bg-slate-100 text-slate-600' },
  TERMINATED: { vi: 'Chấm dứt HĐ', en: 'Terminated', className: 'bg-rose-50 text-rose-700' },
};

export default function EmployeesPage() {
  const { user, selectedBranchId, hasPermission } = usePortalAuth();
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);
  const canCreate = hasPermission('hrm.employees.create');
  const canDelete = hasPermission('hrm.employees.delete');
  const canExport = hasPermission('hrm.employees.export');

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [provisionedBanner, setProvisionedBanner] =
    useState<ProvisionedAccountBanner | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/v1/hrm/org/departments?limit=200', { signal: controller.signal }).then((r) =>
        r.json(),
      ),
      fetch('/api/v1/hrm/org/positions?limit=100', { signal: controller.signal }).then((r) =>
        r.json(),
      ),
    ])
      .then(([deptJson, posJson]) => {
        if (deptJson?.success && Array.isArray(deptJson.data)) {
          setDepartments(deptJson.data as DepartmentOption[]);
        }
        if (posJson?.success && Array.isArray(posJson.data)) {
          setPositions(posJson.data as PositionOption[]);
        }
      })
      .catch(() => {
        // Ignore abort / metadata load failure
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedBranchId) params.set('branchId', String(selectedBranchId));
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (positionFilter) params.set('positionId', positionFilter);
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/v1/hrm/employees?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: EmployeeRow[];
          meta?: PaginationMeta;
          error?: { message?: string };
        };
        if (!res.ok || !json.success) {
          throw new Error(
            json.error?.message ??
              trRef.current(
                'Không thể tải danh sách nhân viên.',
                'Failed to load employee directory.',
              ),
          );
        }
        setEmployees(json.data ?? []);
        if (json.meta) {
          setMeta(json.meta);
        }
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : trRef.current(
                'Lỗi kết nối khi tải danh sách nhân viên.',
                'Connection error while loading employee directory.',
              ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    page,
    debouncedSearch,
    selectedBranchId,
    departmentFilter,
    positionFilter,
    statusFilter,
    reloadTick,
  ]);

  function triggerReload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  async function handleExportExcel() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedBranchId) params.set('branchId', String(selectedBranchId));
      if (departmentFilter) params.set('departmentId', departmentFilter);
      if (positionFilter) params.set('positionId', positionFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/v1/hrm/employees/export?${params.toString()}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setErrorMessage(
          json?.error?.message ?? tr('Không thể xuất file Excel.', 'Failed to export Excel file.'),
        );
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? 'danh-sach-nhan-vien.xlsx';

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setErrorMessage(
        tr('Lỗi kết nối khi xuất file Excel.', 'Connection error while exporting Excel file.'),
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingEmployee || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/hrm/employees/${deletingEmployee.id}`, {
        method: 'DELETE',
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        setErrorMessage(
          json.error?.message ??
            tr('Không thể xóa hồ sơ nhân viên.', 'Failed to delete employee profile.'),
        );
        return;
      }
      setDeletingEmployee(null);
      triggerReload();
    } finally {
      setIsDeleting(false);
    }
  }

  const visibleDepartments = selectedBranchId
    ? departments.filter((d) => d.branchId === selectedBranchId)
    : departments;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <IconIdBadge2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {tr('Hồ sơ Nhân viên 360°', 'Employee Directory')}
            </h1>
            <p className="text-sm text-slate-500">
              {tr(
                'Quản lý danh sách nhân sự, liên kết tài khoản Portal và xuất báo cáo Excel',
                'Manage employee records, Portal account links, and Excel reports',
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canExport && (
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleExportExcel()}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {isExporting ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconFileSpreadsheet size={16} />
              )}
              <span>
                {isExporting
                  ? tr('Đang xuất...', 'Exporting...')
                  : tr('Xuất Excel (.xlsx)', 'Export Excel (.xlsx)')}
              </span>
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Thêm nhân viên', 'Add Employee')}</span>
            </button>
          )}
        </div>
      </div>

      {provisionedBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">
                {tr(
                  'Đã tự động khởi tạo tài khoản đăng nhập Portal cho nhân viên mới!',
                  'A Portal login account has been automatically provisioned for the new employee!',
                )}
              </div>
              <p className="mt-1 text-xs text-emerald-800">
                {locale === 'en' ? (
                  <>
                    This temporary password is shown <strong>only once</strong>. Please copy and
                    share it with the employee to change after their first login.
                  </>
                ) : (
                  <>
                    Thông tin mật khẩu tạm thời chỉ hiển thị <strong>duy nhất 1 lần</strong>. Vui
                    lòng sao chép và gửi cho nhân viên đổi mật khẩu sau lần đăng nhập đầu tiên.
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs">
                <span>
                  Email: <strong className="font-mono">{provisionedBanner.email}</strong>
                </span>
                <span>
                  {tr('Mật khẩu tạm:', 'Temporary password:')}{' '}
                  <strong className="rounded bg-white px-2 py-0.5 font-mono text-emerald-950">
                    {provisionedBanner.temporaryPassword}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `Email: ${provisionedBanner.email}\n${tr('Mật khẩu tạm', 'Temporary password')}: ${provisionedBanner.temporaryPassword}`,
                    );
                    setCopiedPwd(true);
                    window.setTimeout(() => setCopiedPwd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 font-medium text-white hover:bg-emerald-800"
                >
                  <IconCopy size={13} />
                  <span>
                    {copiedPwd
                      ? tr('Đã sao chép', 'Copied')
                      : tr('Sao chép thông tin', 'Copy credentials')}
                  </span>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setProvisionedBanner(null)}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
              aria-label={tr('Đóng thông báo', 'Dismiss notification')}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setIsLoading(true);
                setSearchInput(e.target.value);
              }}
              placeholder={tr(
                'Tìm theo Mã NV, Họ tên, Email, SĐT...',
                'Search by Employee Code, Name, Email, Phone...',
              )}
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => {
              setIsLoading(true);
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">{tr('Tất cả phòng ban', 'All departments')}</option>
            {visibleDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {ln(d.name, d.nameEn)} ({d.code})
              </option>
            ))}
          </select>

          <select
            value={positionFilter}
            onChange={(e) => {
              setIsLoading(true);
              setPositionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">{tr('Tất cả chức danh', 'All positions')}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {ln(p.name, p.nameEn)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setIsLoading(true);
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="">{tr('Tất cả trạng thái', 'All statuses')}</option>
            <option value="PROBATION">{tr('Thử việc', 'Probation')}</option>
            <option value="ACTIVE">{tr('Chính thức', 'Active')}</option>
            <option value="ON_LEAVE">{tr('Tạm nghỉ', 'On Leave')}</option>
            <option value="RESIGNED">{tr('Đã nghỉ việc', 'Resigned')}</option>
            <option value="TERMINATED">{tr('Chấm dứt HĐ', 'Terminated')}</option>
          </select>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={triggerReload}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      ) : isLoading ? (
        <SkeletonTable rows={6} columns={7} showToolbar={false} showPagination />
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <IconIdBadge2 size={38} className="mx-auto text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            {tr('Không tìm thấy hồ sơ nhân viên nào', 'No employee records found')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Thử thay đổi bộ lọc hoặc thêm nhân viên mới vào hệ thống.',
              'Try adjusting your filters or adding a new employee.',
            )}
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Thêm nhân viên đầu tiên', 'Add First Employee')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Nhân viên', 'Employee')}</th>
                  <th className="px-4 py-3">{tr('Chi nhánh / Phòng ban', 'Branch / Department')}</th>
                  <th className="px-4 py-3">{tr('Chức danh', 'Position')}</th>
                  <th className="px-4 py-3">{tr('Ngày vào làm', 'Hire Date')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3">{tr('Tài khoản Portal', 'Portal Account')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const statusCfg = STATUS_BADGES[emp.employmentStatus];
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                            {emp.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/hrm/employees/${emp.id}`}
                              className="block truncate font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {emp.fullName}
                            </Link>
                            <div className="truncate text-xs text-slate-500">
                              <span className="font-mono font-medium text-slate-700">
                                {emp.employeeCode}
                              </span>{' '}
                              • {emp.workEmail}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {ln(emp.departmentName, emp.departmentNameEn)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {ln(emp.branchName, emp.branchNameEn)} ({emp.branchCode})
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ln(emp.positionName, emp.positionNameEn)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDateVN(emp.hireDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}
                        >
                          {locale === 'en' ? statusCfg.en : statusCfg.vi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {emp.userId === null ? (
                          <span className="text-slate-400">
                            {tr('Chưa liên kết', 'Not linked')}
                          </span>
                        ) : emp.userStatus === 'LOCKED' ? (
                          <span className="rounded-lg bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                            {tr('Đã khóa', 'Locked')}
                          </span>
                        ) : (
                          <span className="rounded-lg bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                            {tr('Hoạt động', 'Active')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/hrm/employees/${emp.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <IconEye size={14} />
                            <span>{tr('Chi tiết', 'Details')}</span>
                          </Link>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeletingEmployee(emp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                              title={tr('Xóa mềm hồ sơ', 'Soft delete profile')}
                            >
                              <IconTrash size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
            <div>
              {locale === 'en' ? (
                <>
                  Showing <strong>{employees.length}</strong> of <strong>{meta.total}</strong>{' '}
                  employees
                </>
              ) : (
                <>
                  Hiển thị <strong>{employees.length}</strong> / <strong>{meta.total}</strong> nhân
                  sự
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {tr('Trang trước', 'Previous')}
              </button>
              <span>
                {tr('Trang', 'Page')} <strong>{meta.page}</strong> / {meta.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= meta.totalPages}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => p + 1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {tr('Trang sau', 'Next')}
              </button>
            </div>
          </div>
        </div>
      )}

      <EmployeeFormModal
        isOpen={isCreateOpen}
        branches={user?.branches ?? []}
        departments={departments}
        positions={positions}
        managers={employees.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
        }))}
        defaultBranchId={selectedBranchId}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(provisioned) => {
          setIsCreateOpen(false);
          if (provisioned) {
            setProvisionedBanner(provisioned);
          }
          triggerReload();
        }}
      />

      <ConfirmModal
        isOpen={deletingEmployee !== null}
        title={tr('Xác nhận xóa mềm hồ sơ nhân viên', 'Confirm Soft Delete Employee')}
        description={
          deletingEmployee
            ? tr(
                `Bạn có chắc muốn xóa hồ sơ "${deletingEmployee.fullName}" (${deletingEmployee.employeeCode})? Tài khoản Portal liên kết (nếu có) cũng sẽ bị khóa.`,
                `Are you sure you want to delete "${deletingEmployee.fullName}" (${deletingEmployee.employeeCode})? Any linked Portal account will also be locked.`,
              )
            : ''
        }
        confirmLabel={tr('Xác nhận xóa', 'Confirm Delete')}
        isProcessing={isDeleting}
        onCancel={() => setDeletingEmployee(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
