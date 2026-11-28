import type { Metadata } from 'next';
import { ClassicStudioClient } from '@/components/design-studio/classic/ClassicStudioClient';

export const metadata: Metadata = {
  title: 'Classic Modern Studio — 5 Template Giao diện Cổ điển Hiện đại | Operon Hub',
  description:
    'Trải nghiệm trực tiếp 5 template giao diện Classic Hiện đại tối giản với đầy đủ toàn bộ element hệ thống để lựa chọn làm giao diện chính cho Operon Hub.',
};

export default function ClassicDesignStudioPage() {
  return <ClassicStudioClient allowLegacySwitch />;
}
