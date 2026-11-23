import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operon Hub — Cổng Quản lý Vận hành Doanh nghiệp',
  description: 'Hệ thống Portal quản lý vận hành cho doanh nghiệp SME (HRM, CRM và các phân hệ mở rộng).',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#EEF2F6] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
