'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  IconBuilding,
  IconCalendarEvent,
  IconClockCheck,
  IconDeviceFloppy,
  IconDevices,
  IconKey,
  IconLoader2,
  IconLogout,
  IconMail,
  IconReceipt2,
  IconRefresh,
  IconShieldCheck,
  IconUserCircle,
} from '@tabler/icons-react';
import { EmployeeContractsPanel } from '@/components/hrm/EmployeeContractsPanel';
import {
  EmployeeDocumentsPanel,
  type EmployeeDocumentView,
} from '@/components/hrm/EmployeeDocumentsPanel';
import { EmployeeWorkHistoryTimeline } from '@/components/hrm/EmployeeWorkHistoryTimeline';
import { ChangePasswordModal } from '@/components/portal/ChangePasswordModal';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { getUserInitials } from '@/layouts/portal-navigation';
import { formatDateVN } from '@/lib/portable/date-utils';

interface MyProfileData {
  id: number;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  personalEmail: string | null;
  address: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  branchName: string;
  departmentName: string;
  positionName: string;
  managerName: string | null;
  hireDate: string;
  employmentStatus: string;
  dependentsCount: number;
  documents: EmployeeDocumentView[];
}

export default function MyProfilePage() {
  const { user, logout } = usePortalAuth();

  const [profile, setProfile] = useState<MyProfileData | null>(null);
  const [isNotLinked, setIsNotLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [phone, setPhone] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/v1/hrm/employees/me', { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as {
          success: boolean;
          data?: MyProfileData;
          error?: { code?: string; message?: string };
        };
        if (res.status === 404 && json.error?.code === 'EMPLOYEE_PROFILE_NOT_LINKED') {
          setIsNotLinked(true);
          setProfile(null);
          setErrorMessage(null);
          return;
        }
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error?.message ?? 'Không thể tải hồ sơ cá nhân.');
        }
        const data = json.data;
        setIsNotLinked(false);
        setProfile(data);
        setPhone(data.phone ?? '');
        setPersonalEmail(data.personalEmail ?? '');
        setAddress(data.address ?? '');
        setBankName(data.bankName ?? '');
        setBankAccountNo(data.bankAccountNo ?? '');
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadTick]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/v1/hrm/employees/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim() || null,
          personalEmail: personalEmail.trim() || null,
          address: address.trim() || null,
          bankName: bankName.trim() || null,
          bankAccountNo: bankAccountNo.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: MyProfileData;
        error?: { message?: string };
      };

      if (!res.ok || !json.success || !json.data) {
        setFeedback({
          type: 'error',
          message: json.error?.message ?? 'Không thể cập nhật thông tin cá nhân.',
        });
        return;
      }

      setProfile(json.data);
      setFeedback({ type: 'success', message: 'Đã cập nhật thông tin cá nhân thành công.' });
    } catch {
      setFeedback({ type: 'error', message: 'Lỗi kết nối khi lưu thông tin.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  const displayName = user?.fullName ?? profile?.fullName ?? 'Người dùng';
  const initials = getUserInitials(displayName);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Account & Security Hero Hub (Always available for EVERY user account) */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#0C4A6E] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white shadow-lg shadow-blue-500/25 ring-2 ring-white/20">
              <span>{initials}</span>
              <span className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-[#0F172A]" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-white">
                  {displayName}
                </h1>
                {user && (
                  <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[11px] font-bold text-cyan-200 ring-1 ring-cyan-300/30">
                    Scope: {user.dataScope}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                {user?.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconMail size={14} className="text-cyan-300" />
                    {user.email}
                  </span>
                )}
                {user && user.roles.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconShieldCheck size={14} className="text-cyan-300" />
                    {user.roles.map((r) => r.name).join(' • ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Account Security Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500"
            >
              <IconKey size={16} />
              <span>Đổi mật khẩu</span>
            </button>

            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
            >
              <IconLogout size={16} />
              <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
            </button>
          </div>
        </div>

        {/* Account Scope & Quick Personal ESS Links */}
        <div className="relative z-10 mt-5 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-cyan-300 uppercase">
              <IconBuilding size={14} />
              <span>Chi nhánh được phân quyền</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user?.hasAllBranches && (
                <span className="rounded-lg bg-white/12 px-2.5 py-1 text-xs font-semibold text-white">
                  Toàn bộ chi nhánh
                </span>
              )}
              {user?.branches.map((branch) => (
                <span
                  key={branch.id}
                  className="rounded-lg border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-slate-200"
                >
                  {branch.name} ({branch.code})
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:col-span-7">
            {[
              { href: '/my/requests', label: 'Đơn từ của tôi', icon: IconCalendarEvent },
              { href: '/my/attendance', label: 'Chấm công', icon: IconClockCheck },
              { href: '/my/payslips', label: 'Phiếu lương', icon: IconReceipt2 },
              { href: '/my/assets', label: 'Tài sản giữ', icon: IconDevices },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-xs font-medium text-slate-100 transition hover:border-cyan-400/50 hover:bg-white/14"
                >
                  <Icon size={16} className="shrink-0 text-cyan-300" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* HR Employee Profile Section (with Loading / Error / Not Linked / Full 360° Profile states) */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-2xl bg-white/80" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/80" />
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-2xs">
          <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadTick((t) => t + 1);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <IconRefresh size={16} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : isNotLinked || !profile ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
          <IconUserCircle size={40} className="mx-auto text-slate-300" />
          <h2 className="mt-3 text-sm font-bold text-slate-900">
            Tài khoản chưa liên kết Hồ sơ Nhân viên HRM
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Bạn vẫn có thể sử dụng đầy đủ tính năng bảo mật tài khoản (đổi mật khẩu, xem quyền chi
            nhánh, đăng xuất) ở phía trên. Nếu cần xem hợp đồng hoặc bảng lương cá nhân, vui lòng
            liên hệ Phòng Hành chính Nhân sự để gắn mã nhân viên.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900">Thông tin công việc (Chỉ xem)</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Mã nhân viên</dt>
                <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                  {profile.employeeCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Họ và tên</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{profile.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email công việc</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.workEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Chi nhánh</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.branchName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phòng ban</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.departmentName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Chức danh</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.positionName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Quản lý trực tiếp</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.managerName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Ngày vào làm</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatDateVN(profile.hireDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Số người phụ thuộc</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{profile.dependentsCount}</dd>
              </div>
            </dl>
          </div>

          <form
            onSubmit={(e) => void handleSave(e)}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs"
          >
            <h2 className="text-sm font-bold text-slate-900">
              Thông tin liên hệ & Ngân hàng nhận lương
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Bạn có thể tự cập nhật các thông tin liên hệ dưới đây. Mọi thay đổi được ghi nhật ký
              hệ thống.
            </p>

            {feedback && (
              <div
                className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {feedback.message}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Email cá nhân
                </label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Ngân hàng nhận lương
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="VD: Vietcombank - CN TP.HCM"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Số tài khoản ngân hàng
                </label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Địa chỉ hiện tại
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
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
                <span>{isSaving ? 'Đang lưu...' : 'Cập nhật thông tin'}</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Hợp đồng lao động của tôi</h2>
            <EmployeeContractsPanel employeeId={profile.id} canManage={false} />
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Quá trình công tác</h2>
            <EmployeeWorkHistoryTimeline employeeId={profile.id} canManage={false} />
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="mb-4 text-sm font-bold text-slate-900">Tài liệu hồ sơ của tôi</h2>
            <EmployeeDocumentsPanel
              employeeId={profile.id}
              documents={profile.documents}
              canManage={false}
              onChanged={() => {
                setIsLoading(true);
                setReloadTick((t) => t + 1);
              }}
            />
          </div>
        </>
      )}

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
