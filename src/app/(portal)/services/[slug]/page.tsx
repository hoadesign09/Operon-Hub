'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  IconArrowLeft,
  IconCalendarTime,
  IconCar,
  IconCheck,
  IconHeadset,
  IconSparkles,
} from '@tabler/icons-react';
import { useI18n } from '@/shared/i18n/I18nContext';

interface BilingualText {
  vi: string;
  en: string;
}

interface PlannedServiceMeta {
  title: BilingualText;
  subtitle: BilingualText;
  icon: typeof IconHeadset;
  highlights: BilingualText[];
}

const PLANNED_SERVICES: Record<string, PlannedServiceMeta> = {
  'car-booking': {
    title: {
      vi: 'Đặt xe Công tác (Car Booking)',
      en: 'Company Car Booking',
    },
    subtitle: {
      vi: 'Đặt xe công ty đưa đón đối tác/công tác, chống trùng lịch xe và điều phối tài xế tự động theo chi nhánh.',
      en: 'Reserve company vehicles for client visits or business trips with anti-overlap checks and driver dispatch.',
    },
    icon: IconCar,
    highlights: [
      {
        vi: 'Lịch xe theo Tháng / Tuần / Ngày tương tự Đặt phòng họp — chỉ hiển thị xe còn trống theo giờ chọn',
        en: 'Month / Week / Day fleet calendar showing only available vehicles for the selected time slot',
      },
      {
        vi: 'Quản lý trạng thái chuyến đi (Pending / In-progress / Done / Cancelled), không xóa cứng dữ liệu DB',
        en: 'Immutable lifecycle statuses (Pending / In-progress / Done / Cancelled) with no hard deletes',
      },
      {
        vi: 'Ghi nhận lộ trình, số km công tác và phê duyệt nhanh cho chuyến đi ngoại tỉnh',
        en: 'Route logging, mileage tracking, and approval flow for inter-city trips',
      },
    ],
  },
};

export default function PlannedServiceDetailPage() {
  const params = useParams<{ slug: string }>();
  const { locale, tr } = useI18n();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const service = PLANNED_SERVICES[slug];

  if (!service) {
    return (
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">
          {tr('Không tìm thấy dịch vụ', 'Service Not Found')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {tr(
            'Dịch vụ bạn truy cập chưa tồn tại trong danh mục Dịch vụ Nội bộ.',
            'The requested service does not exist in the Workplace Services catalog.',
          )}
        </p>
        <Link
          href="/services"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <IconArrowLeft size={16} />
          <span>{tr('Quay lại Trung tâm Dịch vụ', 'Back to Service Hub')}</span>
        </Link>
      </div>
    );
  }

  const Icon = service.icon;
  const title = locale === 'en' ? service.title.en : service.title.vi;
  const subtitle = locale === 'en' ? service.subtitle.en : service.subtitle.vi;

  return (
    <div className="w-full space-y-6">
      <Link
        href="/services"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600"
      >
        <IconArrowLeft size={15} />
        <span>{tr('Quay lại Trung tâm Dịch vụ', 'Back to Service Hub')}</span>
      </Link>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#080E1A] via-[#0F172A] to-[#0C4A6E] p-7 text-white shadow-sm">
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-cyan-300 ring-1 ring-white/15">
              <Icon size={28} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-400/15 px-3 py-0.5 text-[11px] font-semibold text-amber-200">
                <IconSparkles size={13} />
                <span>{tr('Đang quy hoạch — Sắp ra mắt', 'Planned Module — Coming Soon')}</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">
          {tr(
            'Phạm vi tính năng dự kiến tích hợp vào Operon Core',
            'Planned Capabilities Integrated with Operon Core',
          )}
        </h2>
        <ul className="mt-4 space-y-3">
          {service.highlights.map((item) => {
            const text = locale === 'en' ? item.en : item.vi;
            return (
              <li key={item.en} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <IconCheck size={13} />
                </span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
          <Link
            href="/hrm/office/meeting-rooms"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <IconCalendarTime size={16} />
            <span>{tr('Mở Đặt phòng họp (Đang hoạt động)', 'Open Meeting Room Booking (Active)')}</span>
          </Link>
          <Link
            href="/services"
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tr('Xem tất cả Dịch vụ', 'View All Services')}
          </Link>
        </div>
      </div>
    </div>
  );
}
