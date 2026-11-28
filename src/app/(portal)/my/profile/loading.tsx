import { SkeletonDetailPage } from '@/components/ui/Skeleton';

export default function MyProfileLoading() {
  return <SkeletonDetailPage showKpis={false} showBottomWorkflow={false} />;
}
