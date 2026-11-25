'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  IconAlertCircle,
  IconBriefcase,
  IconCalendarEvent,
  IconCalendarOff,
  IconClockPlus,
  IconEdit,
  IconExternalLink,
  IconPlus,
  IconRefresh,
  IconSend,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import {
  BusinessTripFormModal,
  type EditableBusinessTripRequest,
} from '@/components/hrm/BusinessTripFormModal';
import {
  LeaveRequestFormModal,
  type EditableLeaveRequest,
  type LeaveBalanceOption,
  type LeaveSessionOption,
  type LeaveTypeOption,
} from '@/components/hrm/LeaveRequestFormModal';
import {
  OvertimeRequestFormModal,
  type EditableOvertimeRequest,
} from '@/components/hrm/OvertimeRequestFormModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import { useI18n } from '@/shared/i18n/I18nContext';

type RequestTab = 'LEAVE' | 'OT' | 'TRIP';
type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type OtRateType = 'WEEKDAY_150' | 'WEEKEND_200' | 'HOLIDAY_300';

interface MyLeaveBalance extends LeaveBalanceOption {
  id: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeNameEn?: string | null;
  isPaid: boolean;
}

interface MyLeaveRequest {
  id: number;
  requestCode: string;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  leaveTypeNameEn?: string | null;
  isPaid: boolean;
  startDate: string;
  endDate: string;
  startSession: LeaveSessionOption;
  endSession: LeaveSessionOption;
  totalDays: number;
  reason: string;
  attachmentUrl: string | null;
  status: RequestStatus;
  approvalRequestId: number | null;
}

interface MyOvertimeRequest {
  id: number;
  requestCode: string;
  workDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  otRateType: OtRateType;
  isHoliday: boolean;
  reason: string;
  status: RequestStatus;
  approvalRequestId: number | null;
}

interface MyBusinessTripRequest {
  id: number;
  requestCode: string;
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  estimatedCost: number;
  purpose: string;
  status: RequestStatus;
  approvalRequestId: number | null;
}

const SESSION_SHORT: Record<LeaveSessionOption, { vi: string; en: string }> = {
  FULL: { vi: 'Cả ngày', en: 'Full day' },
  AM: { vi: 'Sáng', en: 'Morning' },
  PM: { vi: 'Chiều', en: 'Afternoon' },
};

const OT_RATE_BADGE: Record<OtRateType, { vi: string; en: string; className: string }> = {
  WEEKDAY_150: {
    vi: '150% (Thường)',
    en: '150% (Weekday)',
    className: 'bg-blue-50 text-blue-700',
  },
  WEEKEND_200: {
    vi: '200% (Cuối tuần)',
    en: '200% (Weekend)',
    className: 'bg-amber-50 text-amber-800',
  },
  HOLIDAY_300: {
    vi: '300% (Ngày lễ)',
    en: '300% (Holiday)',
    className: 'bg-rose-50 text-rose-700',
  },
};

const STATUS_BADGE: Record<RequestStatus, { vi: string; en: string; className: string }> = {
  DRAFT: { vi: 'Nháp', en: 'Draft', className: 'bg-slate-100 text-slate-700' },
  PENDING: { vi: 'Chờ duyệt', en: 'Pending', className: 'bg-amber-100 text-amber-800' },
  APPROVED: { vi: 'Đã duyệt', en: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { vi: 'Từ chối', en: 'Rejected', className: 'bg-rose-100 text-rose-700' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', className: 'bg-slate-200 text-slate-600' },
};

export default function MyRequestsPage() {
  const { locale, tr, ln } = useI18n();
  const trRef = useRef(tr);
  useEffect(() => {
    trRef.current = tr;
  }, [tr]);

  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<RequestTab>('LEAVE');
  const [year, setYear] = useState<number>(currentYear);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reloadTick, setReloadTick] = useState<number>(0);

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [balances, setBalances] = useState<MyLeaveBalance[]>([]);
  const [leaves, setLeaves] = useState<MyLeaveRequest[]>([]);
  const [overtimes, setOvertimes] = useState<MyOvertimeRequest[]>([]);
  const [trips, setTrips] = useState<MyBusinessTripRequest[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  // Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);
  const [editingLeave, setEditingLeave] = useState<EditableLeaveRequest | null>(null);
  const [isOtModalOpen, setIsOtModalOpen] = useState<boolean>(false);
  const [editingOt, setEditingOt] = useState<EditableOvertimeRequest | null>(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState<boolean>(false);
  const [editingTrip, setEditingTrip] = useState<EditableBusinessTripRequest | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    tab: RequestTab;
    mode: 'SUBMIT' | 'CANCEL' | 'DELETE';
    id: number;
    requestCode: string;
    detailText: string;
  } | null>(null);
  const [isActionProcessing, setIsActionProcessing] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      mine: 'true',
      year: String(year),
      limit: '50',
    });
    if (statusFilter) {
      params.set('status', statusFilter);
    }

    const commonPromises = [
      fetch('/api/v1/hrm/requests/leave-types?activeOnly=true', { signal: controller.signal }),
      fetch(`/api/v1/hrm/requests/leave-balances?mine=true&year=${year}`, {
        signal: controller.signal,
      }),
    ] as const;

    const tabUrl =
      activeTab === 'LEAVE'
        ? `/api/v1/hrm/requests/leaves?${params.toString()}`
        : activeTab === 'OT'
          ? `/api/v1/hrm/requests/overtimes?${params.toString()}`
          : `/api/v1/hrm/requests/business-trips?${params.toString()}`;

    Promise.all([
      ...commonPromises,
      fetch(tabUrl, { signal: controller.signal }),
    ])
      .then(async ([typesRes, balRes, tabRes]) => {
        const [typesJson, balJson, tabJson] = (await Promise.all([
          typesRes.json(),
          balRes.json(),
          tabRes.json(),
        ])) as [
          { success: boolean; data?: { items: LeaveTypeOption[] }; error?: { message?: string } },
          { success: boolean; data?: { items: MyLeaveBalance[] }; error?: { message?: string } },
          { success: boolean; data?: { items: unknown[] }; error?: { message?: string } },
        ];

        if (!typesRes.ok || !typesJson.success) {
          throw new Error(
            typesJson.error?.message ??
              trRef.current('Không tải được danh mục loại phép.', 'Failed to load leave types.'),
          );
        }
        if (!balRes.ok || !balJson.success) {
          throw new Error(
            balJson.error?.message ??
              trRef.current(
                'Không tải được quỹ phép cá nhân.',
                'Failed to load personal leave balances.',
              ),
          );
        }
        if (!tabRes.ok || !tabJson.success) {
          throw new Error(
            tabJson.error?.message ??
              trRef.current('Không tải được danh sách đơn từ.', 'Failed to load requests.'),
          );
        }

        setLeaveTypes(typesJson.data?.items ?? []);
        setBalances(balJson.data?.items ?? []);
        if (activeTab === 'LEAVE') {
          setLeaves((tabJson.data?.items ?? []) as MyLeaveRequest[]);
        } else if (activeTab === 'OT') {
          setOvertimes((tabJson.data?.items ?? []) as MyOvertimeRequest[]);
        } else {
          setTrips((tabJson.data?.items ?? []) as MyBusinessTripRequest[]);
        }
        setErrorMsg(null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMsg(
          err instanceof Error
            ? err.message
            : trRef.current(
                'Lỗi kết nối máy chủ khi tải dữ liệu đơn từ.',
                'Server connection error while loading requests.',
              ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeTab, year, statusFilter, reloadTick]);

  function triggerReload() {
    setIsLoading(true);
    setReloadTick((t) => t + 1);
  }

  function openCreateModal() {
    if (activeTab === 'LEAVE') {
      setEditingLeave(null);
      setIsLeaveModalOpen(true);
    } else if (activeTab === 'OT') {
      setEditingOt(null);
      setIsOtModalOpen(true);
    } else {
      setEditingTrip(null);
      setIsTripModalOpen(true);
    }
  }

  async function executeConfirmAction() {
    if (!confirmAction) {
      return;
    }
    setIsActionProcessing(true);
    setBannerMsg(null);

    try {
      const { tab, mode, id, requestCode } = confirmAction;
      const basePath =
        tab === 'LEAVE'
          ? '/api/v1/hrm/requests/leaves'
          : tab === 'OT'
            ? '/api/v1/hrm/requests/overtimes'
            : '/api/v1/hrm/requests/business-trips';

      let res: Response;
      if (mode === 'SUBMIT') {
        res = await fetch(`${basePath}/${id}/submit`, { method: 'POST' });
      } else if (mode === 'CANCEL') {
        res = await fetch(`${basePath}/${id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: tr(
              'Nhân viên tự hủy đơn từ cổng ESS',
              'Employee self-cancelled via ESS portal',
            ),
          }),
        });
      } else {
        res = await fetch(`${basePath}/${id}`, { method: 'DELETE' });
      }

      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        setBannerMsg({
          type: 'error',
          text: json.error?.message ?? tr('Thao tác không thành công.', 'Action failed.'),
        });
      } else {
        const successText =
          mode === 'SUBMIT'
            ? tr(
                `Đã gửi duyệt đơn ${requestCode} thành công.`,
                `Submitted request ${requestCode} for approval.`,
              )
            : mode === 'CANCEL'
              ? tr(
                  `Đã hủy đơn ${requestCode} thành công.`,
                  `Cancelled request ${requestCode}.`,
                )
              : tr(`Đã xóa đơn ${requestCode}.`, `Deleted request ${requestCode}.`);
        setBannerMsg({ type: 'success', text: successText });
        triggerReload();
      }
    } catch {
      setBannerMsg({
        type: 'error',
        text: tr('Lỗi kết nối máy chủ. Vui lòng thử lại.', 'Server connection error. Please try again.'),
      });
    } finally {
      setIsActionProcessing(false);
      setConfirmAction(null);
    }
  }

  const createBtnLabel =
    activeTab === 'LEAVE'
      ? tr('Tạo đơn nghỉ phép', 'New Leave Request')
      : activeTab === 'OT'
        ? tr('Tạo đơn Tăng ca (OT)', 'New Overtime (OT) Request')
        : tr('Tạo đơn Công tác', 'New Business Trip Request');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {tr('Đơn từ & Quỹ phép của tôi', 'My Requests & Leave Balances')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tr(
              'Theo dõi quỹ phép năm cá nhân, tạo và theo dõi đơn Nghỉ phép, Tăng ca (OT) và Công tác',
              'Track your annual leave balances, and create or manage Leave, Overtime (OT), and Business Trip requests',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={year}
            onChange={(e) => {
              setIsLoading(true);
              setYear(Number(e.target.value));
            }}
            aria-label={tr('Chọn năm', 'Select year')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {tr(`Năm ${y}`, `Year ${y}`)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <IconPlus size={17} />
            <span>{createBtnLabel}</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            bannerMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="rounded p-1 hover:bg-black/5"
            aria-label={tr('Đóng thông báo', 'Dismiss notification')}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* Quỹ phép cá nhân */}
      {activeTab === 'LEAVE' && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {tr(`Quỹ phép cá nhân năm ${year}`, `Personal Leave Balances — ${year}`)}
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
                />
              ))}
            </div>
          ) : balances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              {tr(
                `Chưa có dữ liệu quỹ phép năm ${year} cho hồ sơ của bạn. Vui lòng liên hệ Phòng Nhân sự để khởi tạo quỹ phép.`,
                `No leave balance data for ${year} found for your profile. Please contact HR to initialize your leave quota.`,
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((bal) => {
                const totalQuota = bal.entitledDays + bal.carriedOverDays;
                const usedRatio =
                  totalQuota > 0
                    ? Math.min(100, Math.round(((bal.usedDays + bal.pendingDays) / totalQuota) * 100))
                    : 0;
                return (
                  <div
                    key={bal.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          {bal.leaveTypeCode}
                        </span>
                        <h3 className="mt-1.5 text-sm font-bold text-slate-900">
                          {ln(bal.leaveTypeName, bal.leaveTypeNameEn)}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{bal.remainingDays}</div>
                        <div className="text-[11px] text-slate-500">
                          {tr('ngày còn lại', 'days remaining')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${usedRatio}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                      <div>
                        <span className="block text-[11px] text-slate-400">
                          {tr('Tổng quỹ', 'Total Quota')}
                        </span>
                        <strong className="text-slate-800">{totalQuota}</strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400">
                          {tr('Đã dùng', 'Used')}
                        </span>
                        <strong className="text-emerald-700">{bal.usedDays}</strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400">
                          {tr('Chờ duyệt', 'Pending')}
                        </span>
                        <strong className="text-amber-700">{bal.pendingDays}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Danh sách đơn từ cá nhân (3 Tabs) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setActiveTab('LEAVE');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'LEAVE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <IconCalendarEvent size={15} />
              <span>{tr('Đơn nghỉ phép', 'Leave Requests')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setActiveTab('OT');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'OT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <IconClockPlus size={15} />
              <span>{tr('Đơn Tăng ca (OT)', 'Overtime (OT)')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setActiveTab('TRIP');
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'TRIP'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <IconBriefcase size={15} />
              <span>{tr('Đơn Công tác', 'Business Trips')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value);
              }}
              aria-label={tr('Lọc trạng thái', 'Filter by status')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">{tr('Tất cả trạng thái', 'All Statuses')}</option>
              <option value="DRAFT">{tr('Nháp', 'Draft')}</option>
              <option value="PENDING">{tr('Chờ duyệt', 'Pending')}</option>
              <option value="APPROVED">{tr('Đã duyệt', 'Approved')}</option>
              <option value="REJECTED">{tr('Từ chối', 'Rejected')}</option>
              <option value="CANCELLED">{tr('Đã hủy', 'Cancelled')}</option>
            </select>

            <button
              type="button"
              onClick={triggerReload}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <IconRefresh size={15} />
              <span>{tr('Làm mới', 'Refresh')}</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center">
            <IconAlertCircle size={32} className="mx-auto text-rose-500" />
            <p className="mt-2 text-sm font-medium text-rose-700">{errorMsg}</p>
            <button
              type="button"
              onClick={triggerReload}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <IconRefresh size={16} />
              <span>{tr('Thử lại', 'Retry')}</span>
            </button>
          </div>
        ) : activeTab === 'LEAVE' ? (
          leaves.length === 0 ? (
            <div className="p-10 text-center">
              <IconCalendarOff size={36} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {tr(
                  `Bạn chưa có đơn nghỉ phép nào trong năm ${year}`,
                  `You have no leave requests in ${year}`,
                )}
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>{tr('Tạo đơn nghỉ phép', 'New Leave Request')}</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã đơn', 'Request Code')}</th>
                    <th className="px-4 py-3">{tr('Loại phép', 'Leave Type')}</th>
                    <th className="px-4 py-3">{tr('Thời gian nghỉ', 'Leave Period')}</th>
                    <th className="px-4 py-3 text-right">{tr('Số ngày', 'Days')}</th>
                    <th className="px-4 py-3">{tr('Lý do', 'Reason')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    const daysText = `${item.totalDays} ${tr('ngày', item.totalDays === 1 ? 'day' : 'days')}`;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {item.requestCode}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {ln(item.leaveTypeName, item.leaveTypeNameEn)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.isPaid ? tr('Hưởng lương', 'Paid') : tr('Không lương', 'Unpaid')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div>
                            {formatDateVN(item.startDate)} (
                            {locale === 'en'
                              ? SESSION_SHORT[item.startSession].en
                              : SESSION_SHORT[item.startSession].vi}
                            )
                          </div>
                          <div className="text-slate-500">
                            → {formatDateVN(item.endDate)} (
                            {locale === 'en'
                              ? SESSION_SHORT[item.endSession].en
                              : SESSION_SHORT[item.endSession].vi}
                            )
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {daysText}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-xs text-slate-600" title={item.reason}>
                            {item.reason}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {locale === 'en' ? badge.en : badge.vi}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'DRAFT' && (
                              <>
                                <button
                                  type="button"
                                  title={tr('Gửi duyệt', 'Submit for approval')}
                                  onClick={() =>
                                    setConfirmAction({
                                      tab: 'LEAVE',
                                      mode: 'SUBMIT',
                                      id: item.id,
                                      requestCode: item.requestCode,
                                      detailText: daysText,
                                    })
                                  }
                                  className="rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"
                                >
                                  <IconSend size={15} />
                                </button>
                                <button
                                  type="button"
                                  title={tr('Chỉnh sửa', 'Edit')}
                                  onClick={() => {
                                    setEditingLeave({
                                      id: item.id,
                                      leaveTypeId: item.leaveTypeId,
                                      startDate: item.startDate,
                                      endDate: item.endDate,
                                      startSession: item.startSession,
                                      endSession: item.endSession,
                                      reason: item.reason,
                                      attachmentUrl: item.attachmentUrl,
                                    });
                                    setIsLeaveModalOpen(true);
                                  }}
                                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                                >
                                  <IconEdit size={15} />
                                </button>
                              </>
                            )}
                            {(item.status === 'DRAFT' || item.status === 'PENDING') && (
                              <button
                                type="button"
                                title={tr('Hủy đơn', 'Cancel request')}
                                onClick={() =>
                                  setConfirmAction({
                                    tab: 'LEAVE',
                                    mode: 'CANCEL',
                                    id: item.id,
                                    requestCode: item.requestCode,
                                    detailText: daysText,
                                  })
                                }
                                className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                              >
                                <IconX size={15} />
                              </button>
                            )}
                            {(item.status === 'DRAFT' || item.status === 'CANCELLED') && (
                              <button
                                type="button"
                                title={tr('Xóa đơn', 'Delete request')}
                                onClick={() =>
                                  setConfirmAction({
                                    tab: 'LEAVE',
                                    mode: 'DELETE',
                                    id: item.id,
                                    requestCode: item.requestCode,
                                    detailText: daysText,
                                  })
                                }
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <IconTrash size={15} />
                              </button>
                            )}
                            {item.approvalRequestId && (
                              <Link
                                href="/approvals"
                                title={tr('Xem luồng phê duyệt', 'View approval workflow')}
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <IconExternalLink size={15} />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'OT' ? (
          overtimes.length === 0 ? (
            <div className="p-10 text-center">
              <IconClockPlus size={36} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {tr(
                  `Bạn chưa có đơn tăng ca (OT) nào trong năm ${year}`,
                  `You have no overtime (OT) requests in ${year}`,
                )}
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <IconPlus size={16} />
                <span>{tr('Tạo đơn Tăng ca (OT)', 'New Overtime (OT) Request')}</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{tr('Mã đơn', 'Request Code')}</th>
                    <th className="px-4 py-3">{tr('Ngày & Khung giờ', 'Date & Time')}</th>
                    <th className="px-4 py-3 text-right">{tr('Tổng giờ', 'Total Hours')}</th>
                    <th className="px-4 py-3">{tr('Hệ số OT', 'OT Rate')}</th>
                    <th className="px-4 py-3">{tr('Lý do', 'Reason')}</th>
                    <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                    <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overtimes.map((item) => {
                    const badge = STATUS_BADGE[item.status];
                    const rateBadge = OT_RATE_BADGE[item.otRateType];
                    const hoursText = `${item.totalHours} ${tr('giờ', item.totalHours === 1 ? 'hr' : 'hrs')}`;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {item.requestCode}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          <div className="font-semibold text-slate-900">
                            {formatDateVN(item.workDate)}
                          </div>
                          <div className="text-slate-500">
                            {item.startTime} – {item.endTime}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {hoursText}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${rateBadge.className}`}
                          >
                            {locale === 'en' ? rateBadge.en : rateBadge.vi}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-xs text-slate-600" title={item.reason}>
                            {item.reason}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                          >
                            {locale === 'en' ? badge.en : badge.vi}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'DRAFT' && (
                              <>
                                <button
                                  type="button"
                                  title={tr('Gửi duyệt', 'Submit for approval')}
                                  onClick={() =>
                                    setConfirmAction({
                                      tab: 'OT',
                                      mode: 'SUBMIT',
                                      id: item.id,
                                      requestCode: item.requestCode,
                                      detailText: hoursText,
                                    })
                                  }
                                  className="rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"
                                >
                                  <IconSend size={15} />
                                </button>
                                <button
                                  type="button"
                                  title={tr('Chỉnh sửa', 'Edit')}
                                  onClick={() => {
                                    setEditingOt({
                                      id: item.id,
                                      workDate: item.workDate,
                                      startTime: item.startTime,
                                      endTime: item.endTime,
                                      isHoliday: item.isHoliday,
                                      reason: item.reason,
                                    });
                                    setIsOtModalOpen(true);
                                  }}
                                  className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                                >
                                  <IconEdit size={15} />
                                </button>
                              </>
                            )}
                            {(item.status === 'DRAFT' || item.status === 'PENDING') && (
                              <button
                                type="button"
                                title={tr('Hủy đơn', 'Cancel request')}
                                onClick={() =>
                                  setConfirmAction({
                                    tab: 'OT',
                                    mode: 'CANCEL',
                                    id: item.id,
                                    requestCode: item.requestCode,
                                    detailText: hoursText,
                                  })
                                }
                                className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                              >
                                <IconX size={15} />
                              </button>
                            )}
                            {(item.status === 'DRAFT' || item.status === 'CANCELLED') && (
                              <button
                                type="button"
                                title={tr('Xóa đơn', 'Delete request')}
                                onClick={() =>
                                  setConfirmAction({
                                    tab: 'OT',
                                    mode: 'DELETE',
                                    id: item.id,
                                    requestCode: item.requestCode,
                                    detailText: hoursText,
                                  })
                                }
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <IconTrash size={15} />
                              </button>
                            )}
                            {item.approvalRequestId && (
                              <Link
                                href="/approvals"
                                title={tr('Xem luồng phê duyệt', 'View approval workflow')}
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <IconExternalLink size={15} />
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : trips.length === 0 ? (
          <div className="p-10 text-center">
            <IconBriefcase size={36} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {tr(
                `Bạn chưa có đơn công tác nào trong năm ${year}`,
                `You have no business trip requests in ${year}`,
              )}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <IconPlus size={16} />
              <span>{tr('Tạo đơn Công tác', 'New Business Trip Request')}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">{tr('Mã đơn', 'Request Code')}</th>
                  <th className="px-4 py-3">{tr('Địa điểm', 'Destination')}</th>
                  <th className="px-4 py-3">{tr('Thời gian', 'Duration')}</th>
                  <th className="px-4 py-3 text-right">{tr('Dự kiến phí', 'Estimated Cost')}</th>
                  <th className="px-4 py-3">{tr('Mục đích', 'Purpose')}</th>
                  <th className="px-4 py-3">{tr('Trạng thái', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{tr('Thao tác', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map((item) => {
                  const badge = STATUS_BADGE[item.status];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                        {item.requestCode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.destination}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>
                          {formatDateVN(item.startDate)} → {formatDateVN(item.endDate)}
                        </div>
                        <div className="text-slate-500">
                          {item.totalDays} {tr('ngày', item.totalDays === 1 ? 'day' : 'days')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatVND(item.estimatedCost)}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="truncate text-xs text-slate-600" title={item.purpose}>
                          {item.purpose}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                        >
                          {locale === 'en' ? badge.en : badge.vi}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                title={tr('Gửi duyệt', 'Submit for approval')}
                                onClick={() =>
                                  setConfirmAction({
                                    tab: 'TRIP',
                                    mode: 'SUBMIT',
                                    id: item.id,
                                    requestCode: item.requestCode,
                                    detailText: item.destination,
                                  })
                                }
                                className="rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"
                              >
                                <IconSend size={15} />
                              </button>
                              <button
                                type="button"
                                title={tr('Chỉnh sửa', 'Edit')}
                                onClick={() => {
                                  setEditingTrip({
                                    id: item.id,
                                    destination: item.destination,
                                    startDate: item.startDate,
                                    endDate: item.endDate,
                                    estimatedCost: item.estimatedCost,
                                    purpose: item.purpose,
                                  });
                                  setIsTripModalOpen(true);
                                }}
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                              >
                                <IconEdit size={15} />
                              </button>
                            </>
                          )}
                          {(item.status === 'DRAFT' || item.status === 'PENDING') && (
                            <button
                              type="button"
                              title={tr('Hủy đơn', 'Cancel request')}
                              onClick={() =>
                                setConfirmAction({
                                  tab: 'TRIP',
                                  mode: 'CANCEL',
                                  id: item.id,
                                  requestCode: item.requestCode,
                                  detailText: item.destination,
                                })
                              }
                              className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                            >
                              <IconX size={15} />
                            </button>
                          )}
                          {(item.status === 'DRAFT' || item.status === 'CANCELLED') && (
                            <button
                              type="button"
                              title={tr('Xóa đơn', 'Delete request')}
                              onClick={() =>
                                setConfirmAction({
                                  tab: 'TRIP',
                                  mode: 'DELETE',
                                  id: item.id,
                                  requestCode: item.requestCode,
                                  detailText: item.destination,
                                })
                              }
                              className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <IconTrash size={15} />
                            </button>
                          )}
                          {item.approvalRequestId && (
                            <Link
                              href="/approvals"
                              title={tr('Xem luồng phê duyệt', 'View approval workflow')}
                              className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <IconExternalLink size={15} />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modals */}
      {isLeaveModalOpen && (
        <LeaveRequestFormModal
          key={editingLeave?.id ?? 'new-leave'}
          leaveTypes={leaveTypes}
          balances={balances}
          editingRequest={editingLeave}
          onClose={() => {
            setIsLeaveModalOpen(false);
            setEditingLeave(null);
          }}
          onSaved={() => {
            setIsLeaveModalOpen(false);
            setEditingLeave(null);
            setBannerMsg({
              type: 'success',
              text: tr('Đã lưu đơn nghỉ phép thành công.', 'Leave request saved successfully.'),
            });
            triggerReload();
          }}
        />
      )}

      {isOtModalOpen && (
        <OvertimeRequestFormModal
          key={editingOt?.id ?? 'new-ot'}
          editingRequest={editingOt}
          onClose={() => {
            setIsOtModalOpen(false);
            setEditingOt(null);
          }}
          onSaved={() => {
            setIsOtModalOpen(false);
            setEditingOt(null);
            setBannerMsg({
              type: 'success',
              text: tr(
                'Đã lưu đơn tăng ca (OT) thành công.',
                'Overtime (OT) request saved successfully.',
              ),
            });
            triggerReload();
          }}
        />
      )}

      {isTripModalOpen && (
        <BusinessTripFormModal
          key={editingTrip?.id ?? 'new-trip'}
          editingRequest={editingTrip}
          onClose={() => {
            setIsTripModalOpen(false);
            setEditingTrip(null);
          }}
          onSaved={() => {
            setIsTripModalOpen(false);
            setEditingTrip(null);
            setBannerMsg({
              type: 'success',
              text: tr(
                'Đã lưu đơn công tác thành công.',
                'Business trip request saved successfully.',
              ),
            });
            triggerReload();
          }}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={
          confirmAction?.mode === 'SUBMIT'
            ? tr('Xác nhận gửi duyệt đơn', 'Confirm Request Submission')
            : confirmAction?.mode === 'CANCEL'
              ? tr('Xác nhận hủy đơn', 'Confirm Request Cancellation')
              : tr('Xác nhận xóa đơn', 'Confirm Request Deletion')
        }
        description={
          confirmAction?.mode === 'SUBMIT'
            ? tr(
                `Gửi đơn ${confirmAction.requestCode} (${confirmAction.detailText}) vào quy trình phê duyệt?`,
                `Submit request ${confirmAction.requestCode} (${confirmAction.detailText}) for approval?`,
              )
            : confirmAction?.mode === 'CANCEL'
              ? tr(
                  `Hủy đơn ${confirmAction?.requestCode} (${confirmAction?.detailText})? Nếu đơn đang chờ duyệt, yêu cầu phê duyệt tương ứng cũng sẽ bị hủy.`,
                  `Cancel request ${confirmAction?.requestCode} (${confirmAction?.detailText})? If it is pending approval, the linked approval request will also be cancelled.`,
                )
              : tr(
                  `Xóa đơn ${confirmAction?.requestCode} khỏi danh sách?`,
                  `Delete request ${confirmAction?.requestCode} from the list?`,
                )
        }
        confirmLabel={
          confirmAction?.mode === 'SUBMIT'
            ? tr('Gửi duyệt', 'Submit')
            : confirmAction?.mode === 'CANCEL'
              ? tr('Hủy đơn', 'Cancel Request')
              : tr('Xóa đơn', 'Delete Request')
        }
        variant={confirmAction?.mode === 'SUBMIT' ? 'primary' : 'danger'}
        isProcessing={isActionProcessing}
        onConfirm={() => void executeConfirmAction()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
