'use client';

import { use, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconEdit,
  IconFileCertificate,
  IconFileText,
  IconHistory,
  IconLoader2,
  IconRefresh,
  IconShieldCheck,
  IconUser,
} from '@tabler/icons-react';
import { EmployeeContractsPanel } from '@/components/hrm/EmployeeContractsPanel';
import {
  EmployeeDocumentsPanel,
  type EmployeeDocumentView,
} from '@/components/hrm/EmployeeDocumentsPanel';
import {
  type DepartmentOption,
  type PositionOption,
} from '@/components/hrm/EmployeeFormModal';
import { EmployeeWorkHistoryTimeline } from '@/components/hrm/EmployeeWorkHistoryTimeline';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { SkeletonDetailPage } from '@/components/ui/Skeleton';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

interface EmployeeDetailData {
  id: number;
  employeeCode: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  taxCode: string | null;
  socialInsuranceNo: string | null;
  phone: string | null;
  workEmail: string;
  personalEmail: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  branchId: number;
  branchCode: string;
  branchName: string;
  branchNameEn?: string | null;
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  departmentNameEn?: string | null;
  positionId: number;
  positionCode: string;
  positionName: string;
  positionNameEn?: string | null;
  managerId: number | null;
  managerName: string | null;
  hireDate: string;
  probationEndDate: string | null;
  terminationDate: string | null;
  employmentStatus: 'PROBATION' | 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED' | 'TERMINATED';
  dependentsCount: number;
  note: string | null;
  userId: number | null;
  userEmail: string | null;
  userStatus: 'ACTIVE' | 'LOCKED' | null;
  directReportsCount: number;
  documents: EmployeeDocumentView[];
  sensitiveFieldsMasked: boolean;
}

const STATUS_LABELS: Record<
  EmployeeDetailData['employmentStatus'],
  { vi: string; en: string }
> = {
  PROBATION: { vi: 'Thử việc', en: 'Probation' },
  ACTIVE: { vi: 'Chính thức', en: 'Active' },
  ON_LEAVE: { vi: 'Tạm nghỉ', en: 'On Leave' },
  RESIGNED: { vi: 'Đã nghỉ việc', en: 'Resigned' },
  TERMINATED: { vi: 'Chấm dứt HĐ', en: 'Terminated' },
};

const GENDER_LABELS: Record<'MALE' | 'FEMALE' | 'OTHER', { vi: string; en: string }> = {
  MALE: { vi: 'Nam', en: 'Male' },
  FEMALE: { vi: 'Nữ', en: 'Female' },
  OTHER: { vi: 'Khác', en: 'Other' },
};

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, hasPermission } = usePortalAuth();
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);
  const canUpdate = hasPermission('hrm.employees.update');
  const canReadContracts = hasPermission('hrm.contracts.read');
  const canManageContracts = hasPermission('hrm.contracts.manage');

  const [employee, setEmployee] = useState<EmployeeDetailData | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contracts' | 'history' | 'documents' | 'links'
  >('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [formState, setFormState] = useState({
    fullName: '',
    branchId: 0,
    departmentId: 0,
    positionId: 0,
    gender: '' as '' | 'MALE' | 'FEMALE' | 'OTHER',
    dateOfBirth: '',
    nationalId: '',
    taxCode: '',
    socialInsuranceNo: '',
    phone: '',
    personalEmail: '',
    address: '',
    bankName: '',
    bankAccountNo: '',
    hireDate: '',
    probationEndDate: '',
    terminationDate: '',
    employmentStatus: 'ACTIVE' as EmployeeDetailData['employmentStatus'],
    dependentsCount: '0',
    note: '',
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/hrm/employees/${id}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: EmployeeDetailData;
          error?: { message?: string };
        };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(
            json.error?.message ??
              trRef.current('Không thể tải hồ sơ nhân viên.', 'Failed to load employee profile.'),
          );
        }
        setEmployee(json.data);
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : trRef.current('Lỗi kết nối.', 'Connection error.'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [id, reloadTick]);

  useEffect(() => {
    if (!canUpdate && !canManageContracts) return;
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
        if (deptJson?.success) setDepartments(deptJson.data as DepartmentOption[]);
        if (posJson?.success) setPositions(posJson.data as PositionOption[]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [canUpdate, canManageContracts]);

  function startEdit(emp: EmployeeDetailData) {
    setFormState({
      fullName: emp.fullName,
      branchId: emp.branchId,
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      gender: emp.gender ?? '',
      dateOfBirth: emp.dateOfBirth ?? '',
      nationalId: emp.nationalId ?? '',
      taxCode: emp.taxCode ?? '',
      socialInsuranceNo: emp.socialInsuranceNo ?? '',
      phone: emp.phone ?? '',
      personalEmail: emp.personalEmail ?? '',
      address: emp.address ?? '',
      bankName: emp.bankName ?? '',
      bankAccountNo: emp.bankAccountNo ?? '',
      hireDate: emp.hireDate,
      probationEndDate: emp.probationEndDate ?? '',
      terminationDate: emp.terminationDate ?? '',
      employmentStatus: emp.employmentStatus,
      dependentsCount: String(emp.dependentsCount),
      note: emp.note ?? '',
    });
    setSaveFeedback(null);
    setIsEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!employee || isSaving) return;
    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const res = await fetch(`/api/v1/hrm/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formState.fullName.trim(),
          branchId: formState.branchId,
          departmentId: formState.departmentId,
          positionId: formState.positionId,
          gender: formState.gender || null,
          dateOfBirth: formState.dateOfBirth || null,
          nationalId: formState.nationalId.trim() || null,
          taxCode: formState.taxCode.trim() || null,
          socialInsuranceNo: formState.socialInsuranceNo.trim() || null,
          phone: formState.phone.trim() || null,
          personalEmail: formState.personalEmail.trim() || null,
          address: formState.address.trim() || null,
          bankName: formState.bankName.trim() || null,
          bankAccountNo: formState.bankAccountNo.trim() || null,
          hireDate: formState.hireDate,
          probationEndDate: formState.probationEndDate || null,
          terminationDate: formState.terminationDate || null,
          employmentStatus: formState.employmentStatus,
          dependentsCount: Number(formState.dependentsCount) || 0,
          note: formState.note.trim() || null,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        data?: EmployeeDetailData;
        error?: { message?: string };
      };

      if (!res.ok || !json.success || !json.data) {
        setSaveFeedback({
          type: 'error',
          message:
            json.error?.message ??
            tr('Không thể cập nhật hồ sơ nhân viên.', 'Failed to update employee profile.'),
        });
        return;
      }

      setEmployee(json.data);
      setIsEditing(false);
      setSaveFeedback({
        type: 'success',
        message: tr(
          'Đã cập nhật hồ sơ nhân viên thành công.',
          'Employee profile updated successfully.',
        ),
      });
    } catch {
      setSaveFeedback({
        type: 'error',
        message: tr('Lỗi kết nối khi lưu hồ sơ.', 'Connection error while saving profile.'),
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <SkeletonDetailPage showTabs showBottomWorkflow={false} />;
  }

  if (errorMessage || !employee) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-rose-700">
          {errorMessage ?? tr('Không tìm thấy hồ sơ nhân viên.', 'Employee profile not found.')}
        </p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/hrm/employees"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {tr('Quay lại danh sách', 'Back to list')}
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadTick((t) => t + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>{tr('Thử lại', 'Retry')}</span>
          </button>
        </div>
      </div>
    );
  }

  const branchDepts = departments.filter((d) => d.branchId === formState.branchId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/hrm/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <IconArrowLeft size={16} />
          <span>{tr('Quay lại Danh sách Nhân viên', 'Back to Employee Directory')}</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white">
              {employee.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{employee.fullName}</h1>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                  {employee.employeeCode}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {locale === 'en'
                    ? STATUS_LABELS[employee.employmentStatus].en
                    : STATUS_LABELS[employee.employmentStatus].vi}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {ln(employee.positionName, employee.positionNameEn)} •{' '}
                {ln(employee.departmentName, employee.departmentNameEn)} •{' '}
                {ln(employee.branchName, employee.branchNameEn)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {employee.workEmail} {employee.phone ? `• ${employee.phone}` : ''} •{' '}
                {tr('Vào làm:', 'Hired:')} {formatDateVN(employee.hireDate)}
              </p>
            </div>
          </div>

          {canUpdate && !isEditing && activeTab === 'overview' && (
            <button
              type="button"
              onClick={() => startEdit(employee)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconEdit size={16} />
              <span>{tr('Chỉnh sửa hồ sơ', 'Edit Profile')}</span>
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
              activeTab === 'overview'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconUser size={16} />
            <span>{tr('Thông tin chung', 'Overview')}</span>
          </button>
          {canReadContracts && (
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
                activeTab === 'contracts'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <IconFileCertificate size={16} />
              <span>{tr('Hợp đồng lao động', 'Labor Contracts')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
              activeTab === 'history'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconHistory size={16} />
            <span>{tr('Quá trình công tác', 'Work History')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
              activeTab === 'documents'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconFileText size={16} />
            <span>
              {tr('Tài liệu', 'Documents')} ({employee.documents.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
              activeTab === 'links'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <IconShieldCheck size={16} />
            <span>{tr('Tài khoản & Liên kết', 'Account & Links')}</span>
          </button>
        </div>
      </div>

      {saveFeedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            saveFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {saveFeedback.message}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {employee.sensitiveFieldsMasked && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              {tr(
                'Một số thông tin nhạy cảm (CCCD, Mã số thuế, BHXH, Tài khoản ngân hàng) đã được ẩn theo quyền xem cơ bản của vai trò hiện tại.',
                'Some sensitive fields (National ID, Tax ID, Social Insurance, Bank Account) are masked based on your current role permissions.',
              )}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Họ tên', 'Full Name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Chi nhánh', 'Branch')}
                  </label>
                  <select
                    value={formState.branchId}
                    onChange={(e) => {
                      const bid = Number(e.target.value);
                      const firstDept = departments.find((d) => d.branchId === bid);
                      setFormState({
                        ...formState,
                        branchId: bid,
                        departmentId: firstDept?.id ?? 0,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {(user?.branches ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {ln(b.name, b.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Phòng ban', 'Department')}
                  </label>
                  <select
                    value={formState.departmentId}
                    onChange={(e) =>
                      setFormState({ ...formState, departmentId: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {branchDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {ln(d.name, d.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Chức danh', 'Position')}
                  </label>
                  <select
                    value={formState.positionId}
                    onChange={(e) =>
                      setFormState({ ...formState, positionId: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {ln(p.name, p.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Trạng thái', 'Status')}
                  </label>
                  <select
                    value={formState.employmentStatus}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        employmentStatus: e.target
                          .value as EmployeeDetailData['employmentStatus'],
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {locale === 'en' ? label.en : label.vi}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Giới tính', 'Gender')}
                  </label>
                  <select
                    value={formState.gender}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        gender: e.target.value as '' | 'MALE' | 'FEMALE' | 'OTHER',
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">{tr('-- Chọn --', '-- Select --')}</option>
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
                    value={formState.dateOfBirth}
                    onChange={(e) => setFormState({ ...formState, dateOfBirth: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Điện thoại', 'Phone')}
                  </label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Email cá nhân', 'Personal Email')}
                  </label>
                  <input
                    type="email"
                    value={formState.personalEmail}
                    onChange={(e) => setFormState({ ...formState, personalEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Số CCCD / CMND', 'National ID')}
                  </label>
                  <input
                    type="text"
                    value={formState.nationalId}
                    onChange={(e) => setFormState({ ...formState, nationalId: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Mã số thuế TNCN', 'Personal Tax ID')}
                  </label>
                  <input
                    type="text"
                    value={formState.taxCode}
                    onChange={(e) => setFormState({ ...formState, taxCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Số sổ BHXH', 'Social Insurance No.')}
                  </label>
                  <input
                    type="text"
                    value={formState.socialInsuranceNo}
                    onChange={(e) =>
                      setFormState({ ...formState, socialInsuranceNo: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Ngân hàng nhận lương', 'Payroll Bank')}
                  </label>
                  <input
                    type="text"
                    value={formState.bankName}
                    onChange={(e) => setFormState({ ...formState, bankName: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Số tài khoản ngân hàng', 'Bank Account No.')}
                  </label>
                  <input
                    type="text"
                    value={formState.bankAccountNo}
                    onChange={(e) => setFormState({ ...formState, bankAccountNo: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Số người phụ thuộc', 'Dependents')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={formState.dependentsCount}
                    onChange={(e) =>
                      setFormState({ ...formState, dependentsCount: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {tr('Địa chỉ', 'Address')}
                  </label>
                  <input
                    type="text"
                    value={formState.address}
                    onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {(formState.employmentStatus === 'RESIGNED' ||
                formState.employmentStatus === 'TERMINATED') && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                  {tr(
                    'Lưu ý: Khi chuyển sang trạng thái nghỉ việc, tài khoản đăng nhập Portal liên kết của nhân viên sẽ tự động bị khóa và thu hồi phiên đăng nhập.',
                    'Note: Changing the status to Resigned or Terminated will automatically lock the linked Portal account and revoke active sessions.',
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {tr('Hủy', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? (
                    <IconLoader2 size={16} className="animate-spin" />
                  ) : (
                    <IconDeviceFloppy size={16} />
                  )}
                  <span>
                    {isSaving ? tr('Đang lưu...', 'Saving...') : tr('Lưu thay đổi', 'Save Changes')}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">{tr('Giới tính', 'Gender')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.gender
                    ? locale === 'en'
                      ? GENDER_LABELS[employee.gender].en
                      : GENDER_LABELS[employee.gender].vi
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Ngày sinh', 'Date of Birth')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.dateOfBirth ? formatDateVN(employee.dateOfBirth) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Số người phụ thuộc', 'Dependents')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{employee.dependentsCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Email công việc', 'Work Email')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{employee.workEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Email cá nhân', 'Personal Email')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.personalEmail ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Điện thoại', 'Phone')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{employee.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('CCCD / CMND', 'National ID')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.sensitiveFieldsMasked ? '••••••••' : (employee.nationalId ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Mã số thuế', 'Tax ID')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.sensitiveFieldsMasked ? '••••••••' : (employee.taxCode ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {tr('Số sổ BHXH', 'Social Insurance No.')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.sensitiveFieldsMasked
                    ? '••••••••'
                    : (employee.socialInsuranceNo ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {tr('Ngân hàng nhận lương', 'Payroll Bank')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.sensitiveFieldsMasked ? '••••••••' : (employee.bankName ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Số tài khoản', 'Bank Account No.')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {employee.sensitiveFieldsMasked ? '••••••••' : (employee.bankAccountNo ?? '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{tr('Ngày vào làm', 'Hire Date')}</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatDateVN(employee.hireDate)}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs text-slate-500">
                  {tr('Địa chỉ liên hệ', 'Contact Address')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">{employee.address ?? '—'}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {activeTab === 'contracts' && canReadContracts && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmployeeContractsPanel
            employeeId={employee.id}
            canManage={canManageContracts}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmployeeWorkHistoryTimeline
            employeeId={employee.id}
            canManage={canManageContracts}
            branches={user?.branches ?? []}
            departments={departments}
            positions={positions}
            onProfileSynced={() => {
              setIsLoading(true);
              setReloadTick((t) => t + 1);
            }}
          />
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <EmployeeDocumentsPanel
            employeeId={employee.id}
            documents={employee.documents}
            canManage={canUpdate}
            onChanged={() => {
              setIsLoading(true);
              setReloadTick((t) => t + 1);
            }}
          />
        </div>
      )}

      {activeTab === 'links' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('Tài khoản đăng nhập Portal', 'Portal Login Account')}
            </h3>
            {employee.userId ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <div>
                  {tr('Email đăng nhập:', 'Login email:')}{' '}
                  <strong className="font-mono">{employee.userEmail}</strong>
                </div>
                <div>
                  {tr('Trạng thái:', 'Status:')}{' '}
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
                      employee.userStatus === 'LOCKED'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {employee.userStatus === 'LOCKED'
                      ? tr('Đã khóa', 'Locked')
                      : tr('Đang hoạt động', 'Active')}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                {tr(
                  'Hồ sơ này chưa được liên kết với tài khoản đăng nhập Portal nào.',
                  'This profile is not yet linked to any Portal login account.',
                )}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">
              {tr('Quản lý & Quan hệ báo cáo', 'Management & Reporting Lines')}
            </h3>
            <div className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div>
                {tr('Quản lý trực tiếp:', 'Direct manager:')}{' '}
                <strong>{employee.managerName ?? tr('Chưa chỉ định', 'Unassigned')}</strong>
              </div>
              <div>
                {tr('Số nhân sự báo cáo trực tiếp:', 'Direct reports:')}{' '}
                <strong>{employee.directReportsCount}</strong>
              </div>
              <p className="pt-2 text-xs text-slate-500">
                {tr(
                  'Các phân mục Hợp đồng lao động và Quá trình công tác sẽ được tự động gắn vào hồ sơ 360° ở giai đoạn kế tiếp (TASK-06).',
                  'Labor Contracts and Work History sections will be automatically linked to the 360° Employee Profile in the next phase (TASK-06).',
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
