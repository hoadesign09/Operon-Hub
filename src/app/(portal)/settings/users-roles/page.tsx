'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  IconCheck,
  IconInbox,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface UserAssignment {
  roleId: number;
  roleCode: string;
  roleName: string;
  roleNameEn?: string | null;
  branchId: number | null;
  branchName: string | null;
  branchNameEn?: string | null;
}

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'LOCKED';
  lastLoginAt: string | null;
  assignments: UserAssignment[];
}

interface RoleRow {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
  dataScope: string;
  description: string | null;
  isSystem: boolean;
  permissionIds: number[];
  userCount: number;
}

interface PermissionRow {
  id: number;
  moduleCode: string;
  code: string;
  name: string;
  nameEn?: string | null;
}

interface BranchOption {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
}

const ERR_LOAD_USERS = '__ERR_LOAD_USERS__';
const ERR_NETWORK_USERS = '__ERR_NETWORK_USERS__';

export default function UsersRolesSettingsPage() {
  const { tr, ln } = useI18n();
  const { user: currentUser, hasPermission } = usePortalAuth();
  const canCreateUser = hasPermission('core.users.create');
  const canUpdateUser = hasPermission('core.users.update');
  const canUpdateRoles = hasPermission('core.roles.update');

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [viewState, setViewState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, PermissionRow[]>>({});
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [draftPermIds, setDraftPermIds] = useState<number[]>([]);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [permToast, setPermToast] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleId, setNewRoleId] = useState<string>('');
  const [newBranchId, setNewBranchId] = useState<string>('');
  const [userFormError, setUserFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [toggleStatusTarget, setToggleStatusTarget] = useState<UserRow | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const userParams = new URLSearchParams({ page: '1', limit: '50' });
    if (debouncedSearch) {
      userParams.set('search', debouncedSearch);
    }

    Promise.all([
      fetch(`/api/v1/core/users?${userParams.toString()}`, { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/core/roles', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/core/permissions', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/v1/core/branches?limit=100&isActive=true', { cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([uRes, rRes, pRes, bRes]) => {
        if (controller.signal.aborted) {
          return;
        }
        const [uJson, rJson, pJson, bJson] = await Promise.all([
          uRes.json().catch(() => null),
          rRes.json().catch(() => null),
          pRes.json().catch(() => null),
          bRes.json().catch(() => null),
        ]);

        if (!uRes.ok || !uJson?.success) {
          setErrorMessage(uJson?.error?.message ?? ERR_LOAD_USERS);
          setViewState('error');
          return;
        }

        const roleList = (rJson?.data ?? []) as RoleRow[];
        setUsers((uJson.data ?? []) as UserRow[]);
        setRoles(roleList);
        setPermissionsGrouped((pJson?.data?.grouped ?? {}) as Record<string, PermissionRow[]>);
        setBranches((bJson?.data ?? []) as BranchOption[]);

        if (roleList.length > 0) {
          setSelectedRoleId((prev) => {
            const nextId = prev ?? roleList[0].id;
            const found = roleList.find((r) => r.id === nextId) ?? roleList[0];
            setDraftPermIds(found.permissionIds);
            return found.id;
          });
        }

        setErrorMessage('');
        setViewState('success');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(ERR_NETWORK_USERS);
        setViewState('error');
      });

    return () => controller.abort();
  }, [debouncedSearch, reloadTick]);

  function triggerReload() {
    setViewState('loading');
    setReloadTick((t) => t + 1);
  }

  function handleSelectRole(role: RoleRow) {
    setSelectedRoleId(role.id);
    setDraftPermIds(role.permissionIds);
    setPermToast('');
  }

  function togglePermissionId(permId: number) {
    setDraftPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  }

  async function handleSavePermissions() {
    if (!selectedRoleId) {
      return;
    }
    setIsSavingPerms(true);
    setPermToast('');
    try {
      const res = await fetch(`/api/v1/core/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: draftPermIds }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setPermToast(
          json?.error?.message ?? tr('Không thể lưu phân quyền.', 'Unable to save permissions.'),
        );
        return;
      }
      setPermToast(
        tr('Đã lưu ma trận phân quyền thành công.', 'Permission matrix saved successfully.'),
      );
      triggerReload();
    } catch {
      setPermToast(
        tr('Lỗi kết nối khi lưu phân quyền.', 'Connection error while saving permissions.'),
      );
    } finally {
      setIsSavingPerms(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserFormError('');

    const parsedRoleId = Number(newRoleId || roles[0]?.id || 0);
    if (!parsedRoleId) {
      setUserFormError(tr('Vui lòng chọn vai trò.', 'Please select a role.'));
      return;
    }

    setIsSavingUser(true);
    try {
      const res = await fetch('/api/v1/core/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          fullName: newFullName.trim(),
          password: newPassword,
          assignments: [
            {
              roleId: parsedRoleId,
              branchId: newBranchId ? Number(newBranchId) : null,
            },
          ],
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setUserFormError(
          json?.error?.message ?? tr('Không thể tạo tài khoản.', 'Unable to create account.'),
        );
        return;
      }

      setIsUserModalOpen(false);
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setNewBranchId('');
      triggerReload();
    } catch {
      setUserFormError(
        tr('Lỗi kết nối khi tạo tài khoản.', 'Connection error while creating account.'),
      );
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleConfirmToggleStatus() {
    if (!toggleStatusTarget) {
      return;
    }
    setIsTogglingStatus(true);
    const nextStatus = toggleStatusTarget.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';

    try {
      const res = await fetch(`/api/v1/core/users/${toggleStatusTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.success) {
        setErrorMessage(
          json?.error?.message ??
            tr('Không thể cập nhật trạng thái tài khoản.', 'Unable to update account status.'),
        );
        setViewState('error');
      } else {
        triggerReload();
      }
    } finally {
      setIsTogglingStatus(false);
      setToggleStatusTarget(null);
    }
  }

  const resolvedErrorMessage =
    errorMessage === ERR_LOAD_USERS
      ? tr('Không thể tải dữ liệu người dùng.', 'Unable to load user data.')
      : errorMessage === ERR_NETWORK_USERS
        ? tr(
            'Lỗi kết nối khi tải dữ liệu người dùng & phân quyền.',
            'Connection error while loading users & roles.',
          )
        : errorMessage;

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const isSuperAdminRole = selectedRole?.code === 'SUPER_ADMIN';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Người dùng & Phân quyền RBAC', 'Users & Roles (RBAC)')}
          </h1>
          <p className="text-sm text-slate-500">
            {tr(
              'Quản lý tài khoản đăng nhập, gán vai trò theo chi nhánh và thiết lập ma trận quyền.',
              'Manage user accounts, branch role assignments, and the permission matrix.',
            )}
          </p>
        </div>
        {activeTab === 'users' && canCreateUser && (
          <button
            type="button"
            onClick={() => {
              setNewRoleId(String(roles.find((r) => r.code === 'EMPLOYEE')?.id ?? roles[0]?.id ?? ''));
              setUserFormError('');
              setIsUserModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlus size={18} />
            <span>{tr('Tạo tài khoản', 'Create Account')}</span>
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconUsers size={17} />
          <span>
            {tr('Tài khoản', 'Users')} ({users.length})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === 'roles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <IconShieldCheck size={17} />
          <span>
            {tr('Vai trò & Ma trận Quyền', 'Roles & Permission Matrix')} ({roles.length})
          </span>
        </button>
      </div>

      {viewState === 'loading' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {viewState === 'error' && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <span className="text-sm font-medium text-rose-700">{resolvedErrorMessage}</span>
          <button
            type="button"
            onClick={triggerReload}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            <IconRefresh size={15} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      )}

      {viewState === 'success' && activeTab === 'users' && (
        <div className="space-y-4">
          <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={tr('Tìm theo họ tên hoặc email...', 'Search by full name or email...')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <IconInbox size={32} className="text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                {tr('Chưa có tài khoản phù hợp', 'No matching accounts found')}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{tr('Người dùng', 'User')}</th>
                      <th className="px-4 py-3">{tr('Vai trò & Chi nhánh', 'Roles & Branches')}</th>
                      <th className="px-4 py-3">{tr('Đăng nhập gần nhất', 'Last Login')}</th>
                      <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                      <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isSelf = currentUser?.userId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{u.fullName}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {u.assignments.map((a, idx) => (
                                <span
                                  key={`${a.roleId}-${a.branchId ?? 'all'}-${idx}`}
                                  className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                                >
                                  {ln(a.roleName, a.roleNameEn)}
                                  {a.branchName
                                    ? ` (${ln(a.branchName, a.branchNameEn)})`
                                    : tr(' (Toàn công ty)', ' (Company-wide)')}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                            {formatDateTimeVN(u.lastLoginAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {u.status === 'ACTIVE'
                                ? tr('Hoạt động', 'Active')
                                : tr('Đã khóa', 'Locked')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {canUpdateUser && !isSelf && (
                              <button
                                type="button"
                                onClick={() => setToggleStatusTarget(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                {u.status === 'ACTIVE' ? (
                                  <>
                                    <IconLock size={14} className="text-rose-600" />
                                    <span>{tr('Khóa', 'Lock')}</span>
                                  </>
                                ) : (
                                  <>
                                    <IconLockOpen size={14} className="text-emerald-600" />
                                    <span>{tr('Mở khóa', 'Unlock')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {viewState === 'success' && activeTab === 'roles' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="px-2 text-xs font-semibold uppercase text-slate-500">
              {tr('Danh sách Vai trò', 'Roles List')}
            </h2>
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelectRole(role)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                  selectedRoleId === role.id
                    ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">{ln(role.name, role.nameEn)}</div>
                  <div className="text-xs text-slate-500">
                    {role.code} • {tr('Phạm vi', 'Scope')}: {role.dataScope}
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {role.userCount} {tr('NV', 'users')}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            {selectedRole ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {ln(selectedRole.name, selectedRole.nameEn)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedRole.description ??
                        tr(
                          'Cấu hình quyền truy cập chi tiết cho vai trò này.',
                          'Configure detailed access permissions for this role.',
                        )}
                    </p>
                  </div>
                  {canUpdateRoles && !isSuperAdminRole && (
                    <button
                      type="button"
                      disabled={isSavingPerms}
                      onClick={() => void handleSavePermissions()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      <IconCheck size={15} />
                      <span>
                        {isSavingPerms
                          ? tr('Đang lưu...', 'Saving...')
                          : tr('Lưu phân quyền', 'Save Permissions')}
                      </span>
                    </button>
                  )}
                </div>

                {isSuperAdminRole && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
                    {tr(
                      'Vai trò hệ thống SUPER_ADMIN luôn giữ toàn quyền và không thể chỉnh sửa.',
                      'The SUPER_ADMIN system role always retains full access and cannot be modified.',
                    )}
                  </div>
                )}

                {permToast && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
                    {permToast}
                  </div>
                )}

                <div className="space-y-4">
                  {Object.entries(permissionsGrouped).map(([modCode, perms]) => (
                    <div key={modCode} className="rounded-xl border border-slate-200 p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                        {tr('Phân hệ', 'Module')}: {modCode}
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-start gap-2.5 rounded-lg p-1.5 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              disabled={!canUpdateRoles || isSuperAdminRole}
                              checked={isSuperAdminRole || draftPermIds.includes(perm.id)}
                              onChange={() => togglePermissionId(perm.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <div>
                              <div className="text-xs font-medium text-slate-800">
                                {ln(perm.name, perm.nameEn)}
                              </div>
                              <div className="font-mono text-[11px] text-slate-400">{perm.code}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                {tr(
                  'Chọn một vai trò để xem ma trận phân quyền.',
                  'Select a role to view its permission matrix.',
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {tr('Tạo tài khoản mới', 'Create New Account')}
              </h2>
              <button
                type="button"
                disabled={isSavingUser}
                onClick={() => setIsUserModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateUser(e)} className="mt-4 space-y-3.5">
              {userFormError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {userFormError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Họ và tên *', 'Full Name *')}
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr(
                    'Mật khẩu tạm (tối thiểu 8 ký tự) *',
                    'Temporary Password (min. 8 characters) *',
                  )}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Vai trò *', 'Role *')}
                </label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {ln(r.name, r.nameEn)} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr('Chi nhánh áp dụng', 'Assigned Branch')}
                </label>
                <select
                  value={newBranchId}
                  onChange={(e) => setNewBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">{tr('Toàn công ty', 'Company-wide')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {ln(b.name, b.nameEn)} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isSavingUser}
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingUser
                    ? tr('Đang tạo...', 'Creating...')
                    : tr('Tạo tài khoản', 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(toggleStatusTarget)}
        title={
          toggleStatusTarget?.status === 'ACTIVE'
            ? tr('Xác nhận khóa tài khoản', 'Confirm Lock Account')
            : tr('Xác nhận mở khóa tài khoản', 'Confirm Unlock Account')
        }
        description={
          toggleStatusTarget?.status === 'ACTIVE'
            ? tr(
                `Bạn có chắc muốn khóa tài khoản "${toggleStatusTarget?.fullName ?? ''}" (${toggleStatusTarget?.email ?? ''})?`,
                `Are you sure you want to lock the account "${toggleStatusTarget?.fullName ?? ''}" (${toggleStatusTarget?.email ?? ''})?`,
              )
            : tr(
                `Bạn có chắc muốn mở khóa tài khoản "${toggleStatusTarget?.fullName ?? ''}" (${toggleStatusTarget?.email ?? ''})?`,
                `Are you sure you want to unlock the account "${toggleStatusTarget?.fullName ?? ''}" (${toggleStatusTarget?.email ?? ''})?`,
              )
        }
        confirmLabel={
          toggleStatusTarget?.status === 'ACTIVE'
            ? tr('Khóa tài khoản', 'Lock Account')
            : tr('Mở khóa', 'Unlock')
        }
        variant={toggleStatusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
        isProcessing={isTogglingStatus}
        onCancel={() => setToggleStatusTarget(null)}
        onConfirm={() => void handleConfirmToggleStatus()}
      />
    </div>
  );
}
