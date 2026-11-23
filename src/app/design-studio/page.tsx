import type { Metadata } from 'next';
import { DesignStudioClient } from '@/components/design-studio/DesignStudioClient';

export const metadata: Metadata = {
  title: 'Design Studio — 5 Phương án Giao diện UX/UI | Operon Hub',
  description:
    'So sánh và trải nghiệm trực tiếp 5 phong cách thiết kế Portal UX/UI chuẩn doanh nghiệp để chọn giao diện chính cho Operon Hub.',
};

export default function DesignStudioPage() {
  return <DesignStudioClient />;
}
