import type { Transaction } from 'kysely';
import type { ApprovalRequestStatus, DatabaseSchema } from '@/config/database';

export interface ApprovalCompletionPayload {
  approvalRequestId: number;
  moduleCode: string;
  entityType: string;
  entityId: number;
  nextStatus: Exclude<ApprovalRequestStatus, 'PENDING'>;
  actorUserId: number;
  comment: string | null;
}

export type ApprovalCompletionHandler = (
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
) => Promise<void>;

const completionHooks = new Map<string, ApprovalCompletionHandler>();

export function registerApprovalCompletionHook(
  entityType: string,
  handler: ApprovalCompletionHandler,
): void {
  completionHooks.set(entityType, handler);
}

export async function dispatchApprovalCompletionHook(
  trx: Transaction<DatabaseSchema>,
  payload: ApprovalCompletionPayload,
): Promise<void> {
  const handler = completionHooks.get(payload.entityType);
  if (!handler) {
    return;
  }
  await handler(trx, payload);
}
