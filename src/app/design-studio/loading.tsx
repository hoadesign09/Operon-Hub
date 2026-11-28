import { SkeletonPage } from '@/components/ui/Skeleton';

export default function DesignStudioLoading() {
  return (
    <div className="min-h-screen bg-[#EFF1F4] p-6">
      <SkeletonPage variant="cards" />
    </div>
  );
}
