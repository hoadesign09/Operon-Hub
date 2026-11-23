'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconUserPlus, IconX } from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

export interface BranchOption {
  id: number;
  code: string;
  name: string;
}

export interface DepartmentOption {
  id: number;
  branchId: number;
  code: string;
  name: string;
}

export interface PositionOption {
  id: number;
  code: string;
  name: string;
}

export interface ManagerOption {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface ProvisionedAccountBanner {
  userId: number;
  email: string;
  temporaryPassword: string;
  roleCode: string;
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  branches: BranchOption[];
  departments: DepartmentOption[];
  positions: PositionOption[];
  managers: ManagerOption[];
  defaultBranchId: number | null;
  onClose: () => void;
  onCreated: (provisioned: ProvisionedAccountBanner | null) => void;
}

function getTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function EmployeeFormModal({
  isOpen,
  branches,
  departments,
  positions,
  managers,
  defaultBranchId,
  onClose,
  onCreated,
}: EmployeeFormModalProps) {
  const { tr } = useI18n();
  const initialBranch = defaultBranchId ?? branches[0]?.id ?? 0;
  const initialDept = departments.find((d) => d.branchId === initialBranch)?.id ?? 0;
  const initialPos = positions[0]?.id ?? 0;

  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [branchId, setBranchId] = useState<number>(initialBranch);
  const [departmentId, setDepartmentId] = useState<number>(initialDept);
  const [positionId, setPositionId] = useState<number>(initialPos);
  const [managerId, setManagerId] = useState<string>('');
  const [hireDate, setHireDate] = useState<string>(getTodayIso);
  const [employmentStatus, setEmploymentStatus] = useState<
    'PROBATION' | 'ACTIVE' | 'ON_LEAVE'
  >('PROBATION');
  const [dependentsCount, setDependentsCount] = useState('0');
  const [autoCreateAccount, setAutoCreateAccount] = useState(true);
  const [initialPassword, setInitialPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const effectiveBranchId =
    branchId && branches.some((b) => b.id === branchId)
      ? branchId
      : (defaultBranchId ?? branches[0]?.id ?? 0);

  const filteredDepartments = departments.filter((d) => d.branchId === effectiveBranchId);
  const effectiveDepartmentId = filteredDepartments.some((d) => d.id === departmentId)
    ? departmentId
    : (filteredDepartments[0]?.id ?? 0);
  const effectivePositionId = positions.some((p) => p.id === positionId)
    ? positionId
    : (positions[0]?.id ?? 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        employeeCode: employeeCode.trim().toUpperCase(),
        fullName: fullName.trim(),
        workEmail: workEmail.trim().toLowerCase(),
        phone: phone.trim() || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
        branchId: effectiveBranchId,
        departmentId: effectiveDepartmentId,
        positionId: effectivePositionId,
        managerId: managerId ? Number(managerId) : null,
        hireDate,
        employmentStatus,
        dependentsCount: Number(dependentsCount) || 0,
        autoCreateAccount,
      };

      if (autoCreateAccount && initialPassword.trim().length > 0) {
        payload.initialPassword = initialPassword.trim();
      }

      const res = await fetch('/api/v1/hrm/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: { provisionedAccount?: ProvisionedAccountBanner | null };
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setErrorMessage(
          json.error?.message ??
            tr('Không thể tạo hồ sơ nhân viên.', 'Unable to create employee profile.'),
        );
        return;
      }

      setEmployeeCode('');
      setFullName('');
      setWorkEmail('');
      setPhone('');
      setInitialPassword('');
      onCreated(json.data?.provisionedAccount ?? null);
    } catch {
      setErrorMessage(
        tr(
          'Lỗi kết nối khi tạo hồ sơ nhân viên.',
          'Connection error while creating employee profile.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconUserPlus size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {tr('Thêm Hồ sơ Nhân viên mới', 'Add New Employee Profile')}
              </h2>
              <p className="text-xs text-slate-500">
                {tr(
                  'Gán chi nhánh, phòng ban, chức danh và tự động cấp tài khoản Portal',
                  'Assign branch, department, position, and automatically provision a Portal account',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={tr('Đóng', 'Close')}
          >
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-6">
          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Mã nhân viên', 'Employee Code')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder={tr('VD: NV0004', 'e.g. NV0004')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Họ và tên', 'Full Name')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={tr('Nguyễn Văn A', 'John Doe')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Email công việc', 'Work Email')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder={tr('ten.nv@operonhub.local', 'john.doe@operonhub.local')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Số điện thoại', 'Phone Number')}
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0901234567"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chi nhánh', 'Branch')} <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={effectiveBranchId}
                onChange={(e) => {
                  const nextBid = Number(e.target.value);
                  setBranchId(nextBid);
                  const firstDept = departments.find((d) => d.branchId === nextBid);
                  setDepartmentId(firstDept?.id ?? 0);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Phòng ban', 'Department')} <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={effectiveDepartmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {filteredDepartments.length === 0 ? (
                  <option value={0}>
                    {tr('Chưa có phòng ban ở chi nhánh này', 'No departments in this branch')}
                  </option>
                ) : (
                  filteredDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Chức danh', 'Position')} <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={effectivePositionId}
                onChange={(e) => setPositionId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Quản lý trực tiếp', 'Direct Manager')}
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">{tr('-- Không chỉ định --', '-- Unassigned --')}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.employeeCode} — {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Giới tính', 'Gender')}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER' | '')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="MALE">{tr('Nam', 'Male')}</option>
                <option value="FEMALE">{tr('Nữ', 'Female')}</option>
                <option value="OTHER">{tr('Khác', 'Other')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ngày sinh', 'Date of Birth')}
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Ngày vào làm', 'Hire Date')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Trạng thái làm việc', 'Employment Status')}
              </label>
              <select
                value={employmentStatus}
                onChange={(e) =>
                  setEmploymentStatus(e.target.value as 'PROBATION' | 'ACTIVE' | 'ON_LEAVE')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="PROBATION">{tr('Thử việc', 'Probation')}</option>
                <option value="ACTIVE">{tr('Chính thức', 'Active')}</option>
                <option value="ON_LEAVE">{tr('Tạm nghỉ', 'On Leave')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {tr('Số người phụ thuộc (Thuế TNCN)', 'Dependents (Personal Income Tax)')}
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={dependentsCount}
                onChange={(e) => setDependentsCount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={autoCreateAccount}
                onChange={(e) => setAutoCreateAccount(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {tr(
                    'Tự động cấp tài khoản đăng nhập Portal (Vai trò mặc định: Nhân viên)',
                    'Automatically provision Portal login account (Default role: Employee)',
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  {tr(
                    'Hệ thống sẽ dùng Email công việc làm tài khoản đăng nhập và sinh mật khẩu tạm thời hiển thị 1 lần sau khi lưu.',
                    'The system will use the work email as the login username and generate a one-time temporary password displayed after saving.',
                  )}
                </div>
              </div>
            </label>

            {autoCreateAccount && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  {tr(
                    'Mật khẩu khởi tạo tùy chọn (để trống hệ thống sẽ tự sinh ngẫu nhiên)',
                    'Optional initial password (leave blank to auto-generate)',
                  )}
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder={tr(
                    'Tối thiểu 8 ký tự (không bắt buộc)',
                    'At least 8 characters (optional)',
                  )}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {tr('Hủy', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || effectiveDepartmentId === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>
                {isSubmitting ? tr('Đang lưu...', 'Saving...') : tr('Tạo hồ sơ', 'Create Profile')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
