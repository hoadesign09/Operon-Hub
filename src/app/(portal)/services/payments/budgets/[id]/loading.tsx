import { SkeletonDetailPage } from '@/components/ui/Skeleton';

export default function BudgetDetailLoading() {
  return <SkeletonDetailPage showKpis showBottomWorkflow={false} />;
}
