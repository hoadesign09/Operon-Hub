'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconApps,
  IconArrowRight,
  IconCalendarEvent,
  IconCalendarTime,
  IconCar,
  IconChecklist,
  IconCreditCard,
  IconFileDescription,
  IconHeadset,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react';
import { usePortalAuth } from '@/components/portal/PortalAuthContext';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BilingualText {
  vi: string;
  en: string;
}

interface ServiceCatalogCard {
  id: string;
  href: string;
  title: BilingualText;
  desc: BilingualText;
  category: BilingualText;
  status: 'ACTIVE' | 'COMING_SOON';
  requiredPermission?: string;
  icon: typeof IconCalendarTime;
  accentBg: string;
  accentText: string;
}

const SERVICE_CATALOG: readonly ServiceCatalogCard[] = [
  {
    id: 'meeting-rooms',
    href: '/hrm/office/meeting-rooms',
    title: { vi: 'Đặt phòng họp', en: 'Meeting Room Booking' },
    desc: {
      vi: 'Xem lịch trống theo tháng/tuần/ngày, tự động lọc phòng họp khả dụng chống trùng lịch và quản lý trạng thái cuộc họp.',
      en: 'Browse monthly/weekly/daily schedules, filter real-time available rooms with conflict prevention, and track booking status.',
    },
    category: { vi: 'Hành chính Văn phòng', en: 'Workplace Ops' },
    status: 'ACTIVE',
    requiredPermission: 'hrm.rooms.read',
    icon: IconCalendarTime,
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-600',
  },
  {
    id: 'leave-ot-trips',
    href: '/my/requests',
    title: { vi: 'Đơn nghỉ phép, OT & Công tác', en: 'Leave, OT & Business Trips' },
    desc: {
      vi: 'Tạo và theo dõi trạng thái đơn nghỉ phép, đăng ký làm thêm giờ (OT) và đề nghị đi công tác gửi duyệt tự động.',
      en: 'Submit and track annual leave, overtime (OT), and business trip requests routed through multi-level approvals.',
    },
    category: { vi: 'Tự phục vụ Nhân sự', en: 'HR Self-Service' },
    status: 'ACTIVE',
    icon: IconCalendarEvent,
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-600',
  },
  {
    id: 'approvals',
    href: '/approvals',
    title: { vi: 'Hộp thư Phê duyệt tập trung', en: 'Central Approval Inbox' },
    desc: {
      vi: 'Duyệt nhanh toàn bộ yêu cầu và đề xuất đa cấp từ các phân hệ trong một hộp thư thống nhất có lịch sử đầy đủ.',
      en: 'Review and act on multi-level requests and proposals across all modules from a single auditable inbox.',
    },
    category: { vi: 'Phê duyệt', en: 'Approvals' },
    status: 'ACTIVE',
    requiredPermission: 'core.approvals.read',
    icon: IconChecklist,
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-700',
  },
  {
    id: 'it-requests',
    href: '/services/it-requests',
    title: { vi: 'Yêu cầu Hỗ trợ IT (IT Request)', en: 'IT Helpdesk Request' },
    desc: {
      vi: 'Gửi ticket cấp phát tài khoản, VPN, cài phần mềm, xử lý sự cố máy tính/mạng kèm theo dõi SLA xử lý.',
      en: 'Submit IT tickets for accounts, VPN access, software installation, and hardware/network troubleshooting with SLA tracking.',
    },
    category: { vi: 'CNTT & Helpdesk', en: 'IT & Helpdesk' },
    status: 'COMING_SOON',
    icon: IconHeadset,
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-600',
  },
  {
    id: 'proposals',
    href: '/services/proposals',
    title: { vi: 'Đề xuất Nội bộ', en: 'Internal Proposals' },
    desc: {
      vi: 'Tạo tờ trình mua sắm văn phòng phẩm, tổ chức sự kiện, đề xuất cải tiến quy trình qua Core Approval Engine.',
      en: 'Create procurement proposals, event requests, and operational initiatives routed via the Core Approval Engine.',
    },
    category: { vi: 'Hành chính & Vận hành', en: 'Operations' },
    status: 'ACTIVE',
    requiredPermission: 'proposals.read',
    icon: IconFileDescription,
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-600',
  },
  {
    id: 'payments',
    href: '/services/payments',
    title: { vi: 'Đề nghị Thanh toán (Payment)', en: 'Payment & Reimbursement' },
    desc: {
      vi: 'Lập đề nghị tạm ứng, hoàn ứng công tác phí, thanh toán hóa đơn nhà cung cấp kèm chứng từ đính kèm.',
      en: 'Submit cash advances, expense reimbursements, and vendor payment requests with supporting receipts.',
    },
    category: { vi: 'Tài chính & Kế toán', en: 'Finance' },
    status: 'COMING_SOON',
    icon: IconCreditCard,
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-600',
  },
  {
    id: 'car-booking',
    href: '/services/car-booking',
    title: { vi: 'Đặt xe Công tác (Car Booking)', en: 'Company Car Booking' },
    desc: {
      vi: 'Đăng ký xe công ty đưa đón khách/đi công tác, điều phối tài xế, chống trùng lịch xe và theo dõi lộ trình.',
      en: 'Reserve company vehicles for client visits or business trips with driver dispatch, anti-overlap checks, and trip logs.',
    },
    category: { vi: 'Đội xe & Hành chính', en: 'Fleet & Admin' },
    status: 'COMING_SOON',
    icon: IconCar,
    accentBg: 'bg-sky-50',
    accentText: 'text-sky-600',
  },
];

export default function ServicesHubPage() {
  const { locale, tr } = useI18n();
  const { hasPermission } = usePortalAuth();
  const [search, setSearch] = useState('');

  const keyword = search.trim().toLowerCase();

  const visibleServices = SERVICE_CATALOG.filter((item) => {
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const haystack = [
      item.title.vi,
      item.title.en,
      item.desc.vi,
      item.desc.en,
      item.category.vi,
      item.category.en,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });

  const activeServices = visibleServices.filter((s) => s.status === 'ACTIVE');
  const plannedServices = visibleServices.filter((s) => s.status === 'COMING_SOON');

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Midnight Command Service Hub Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#0C4A6E] p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-16 h-60 w-60 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-300">
              <IconApps size={14} />
              <span>{tr('Cổng Dịch vụ & Đề xuất Nội bộ', 'Internal Workplace Service Desk')}</span>
            </div>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-white">
              {tr('Trung tâm Dịch vụ Nhân viên', 'Employee Service Hub')}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {tr(
                'Tập trung toàn bộ tiện ích làm việc hằng ngày: đặt phòng họp, gửi đơn từ, yêu cầu IT, đề xuất, thanh toán và đặt xe tại một điểm truy cập duy nhất.',
                'All everyday workplace services in one place: meeting room booking, HR requests, IT helpdesk, internal proposals, payments, and car booking.',
              )}
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <IconSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(
                'Tìm nhanh phòng họp, IT, thanh toán, đặt xe...',
                'Search rooms, IT, payment, car booking...',
              )}
              className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pr-3.5 pl-10 text-sm text-white placeholder-slate-300 backdrop-blur-xs outline-none transition focus:border-cyan-400 focus:bg-white/15"
            />
          </div>
        </div>
      </section>

      {visibleServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          {tr(
            'Không tìm thấy dịch vụ nào khớp với từ khóa tìm kiếm.',
            'No services match your search query.',
          )}
        </div>
      ) : (
        <>
          {/* Active Services */}
          {activeServices.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  {tr('Sẵn sàng sử dụng ngay', 'Ready to Use')}
                </h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {tr(`${activeServices.length} dịch vụ`, `${activeServices.length} active`)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeServices.map((service) => {
                  const Icon = service.icon;
                  const title = locale === 'en' ? service.title.en : service.title.vi;
                  const desc = locale === 'en' ? service.desc.en : service.desc.vi;
                  const category = locale === 'en' ? service.category.en : service.category.vi;

                  return (
                    <Link
                      key={service.id}
                      href={service.href}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl ${service.accentBg} ${service.accentText}`}
                          >
                            <Icon size={22} />
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {tr('Đang hoạt động', 'Active')}
                          </span>
                        </div>
                        <div className="mt-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                          {category}
                        </div>
                        <h3 className="mt-1 text-base font-bold text-slate-900 group-hover:text-blue-700">
                          {title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{desc}</p>
                      </div>

                      <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:underline">
                        <span>{tr('Mở dịch vụ', 'Open Service')}</span>
                        <IconArrowRight size={14} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Planned / Coming Soon Services */}
          {plannedServices.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <IconSparkles size={16} className="text-amber-500" />
                  <span>{tr('Dịch vụ sắp triển khai', 'Upcoming Workplace Services')}</span>
                </h2>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {tr(`${plannedServices.length} phân hệ`, `${plannedServices.length} planned`)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {plannedServices.map((service) => {
                  const Icon = service.icon;
                  const title = locale === 'en' ? service.title.en : service.title.vi;
                  const desc = locale === 'en' ? service.desc.en : service.desc.vi;
                  const category = locale === 'en' ? service.category.en : service.category.vi;

                  return (
                    <Link
                      key={service.id}
                      href={service.href}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition hover:border-amber-300 hover:shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${service.accentBg} ${service.accentText}`}
                          >
                            <Icon size={20} />
                          </div>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            {tr('Sắp ra mắt', 'Coming Soon')}
                          </span>
                        </div>
                        <div className="mt-3 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                          {category}
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-slate-900 group-hover:text-blue-700">
                          {title}
                        </h3>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{desc}</p>
                      </div>

                      <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 group-hover:text-blue-600">
                        <span>{tr('Xem lộ trình', 'View Details')}</span>
                        <IconArrowRight size={13} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
