'use client';

import { useState, type FormEvent } from 'react';
import { IconLoader2, IconUserPlus, IconX } from '@tabler/icons-react';

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
        setErrorMessage(json.error?.message ?? 'Không thể tạo hồ sơ nhân viên.');
        return;
      }

      setEmployeeCode('');
      setFullName('');
      setWorkEmail('');
      setPhone('');
      setInitialPassword('');
      onCreated(json.data?.provisionedAccount ?? null);
    } catch {
      setErrorMessage('Lỗi kết nối khi tạo hồ sơ nhân viên.');
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
              <h2 className="text-base font-bold text-slate-900">Thêm Hồ sơ Nhân viên mới</h2>
              <p className="text-xs text-slate-500">
                Gán chi nhánh, phòng ban, chức danh và tự động cấp tài khoản Portal
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
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
                Mã nhân viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="VD: NV0004"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Họ và tên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email công việc <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="ten.nv@operonhub.local"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Số điện thoại
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
                Chi nhánh <span className="text-rose-500">*</span>
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
                Phòng ban <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={effectiveDepartmentId}
                onChange={(e) => setDepartmentId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {filteredDepartments.length === 0 ? (
                  <option value={0}>Chưa có phòng ban ở chi nhánh này</option>
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
                Chức danh <span className="text-rose-500">*</span>
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
                Quản lý trực tiếp
              </label>
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">-- Không chỉ định --</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.employeeCode} — {m.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER' | '')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Ngày sinh
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
                Ngày vào làm <span className="text-rose-500">*</span>
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
                Trạng thái làm việc
              </label>
              <select
                value={employmentStatus}
                onChange={(e) =>
                  setEmploymentStatus(e.target.value as 'PROBATION' | 'ACTIVE' | 'ON_LEAVE')
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="PROBATION">Thử việc</option>
                <option value="ACTIVE">Chính thức</option>
                <option value="ON_LEAVE">Tạm nghỉ</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Số người phụ thuộc (Thuế TNCN)
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
                  Tự động cấp tài khoản đăng nhập Portal (Vai trò mặc định: Nhân viên)
                </div>
                <div className="text-xs text-slate-600">
                  Hệ thống sẽ dùng Email công việc làm tài khoản đăng nhập và sinh mật khẩu tạm thời hiển thị 1 lần sau khi lưu.
                </div>
              </div>
            </label>

            {autoCreateAccount && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Mật khẩu khởi tạo tùy chọn (để trống hệ thống sẽ tự sinh ngẫu nhiên)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự (không bắt buộc)"
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
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || effectiveDepartmentId === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting && <IconLoader2 size={16} className="animate-spin" />}
              <span>{isSubmitting ? 'Đang lưu...' : 'Tạo hồ sơ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
