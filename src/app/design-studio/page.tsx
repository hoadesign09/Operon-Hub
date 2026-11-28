import type { Metadata } from 'next';
import { ClassicStudioClient } from '@/components/design-studio/classic/ClassicStudioClient';

export const metadata: Metadata = {
  title: 'Design Studio — 5 Template Giao diện Classic Hiện đại | Operon Hub',
  description:
    'So sánh và trải nghiệm trực tiếp 5 template giao diện Classic Hiện đại (tối giản, không màu mè, phủ toàn bộ element) để chọn làm giao diện chính cho Operon Hub.',
};

export default function DesignStudioPage() {
  return <ClassicStudioClient allowLegacySwitch />;
}
