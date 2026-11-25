import { registerApprovalCompletionHook } from '@/modules/approvals/approval-hooks';
import {
  handleLeaveApprovalCompletion,
  LEAVE_REQUEST_ENTITY_TYPE,
} from '@/modules/hrm/requests/leave-approval-hook';
import {
  BUSINESS_TRIP_REQUEST_ENTITY_TYPE,
  handleBusinessTripApprovalCompletion,
  handleOvertimeApprovalCompletion,
  OVERTIME_REQUEST_ENTITY_TYPE,
} from '@/modules/hrm/requests/ot-trip-approval-hooks';
import {
  handleProjectCharterApprovalCompletion,
  PROJECT_CHARTER_ENTITY_TYPE,
} from '@/modules/projects/project-charter-approval-hook';
import {
  handleBudgetChangeApprovalCompletion,
  handleMilestoneSignoffApprovalCompletion,
  PROJECT_BUDGET_ENTITY_TYPE,
  PROJECT_MILESTONE_ENTITY_TYPE,
} from '@/modules/projects/pm-approval-hooks';
import {
  handleProposalApprovalCompletion,
  PROPOSAL_ENTITY_TYPE,
} from '@/modules/proposals/proposal-approval-hook';

let hooksRegistered = false;

/**
 * Đăng ký các hook hoàn tất phê duyệt của từng phân hệ đang kích hoạt (HRM, Projects, Proposals, tương lai CRM...).
 * Gọi ở entry point của API phê duyệt để đảm bảo luôn được nạp trong môi trường App Router.
 */
export function ensureApprovalHooksRegistered(): void {
  if (hooksRegistered) {
    return;
  }
  registerApprovalCompletionHook(LEAVE_REQUEST_ENTITY_TYPE, handleLeaveApprovalCompletion);
  registerApprovalCompletionHook(OVERTIME_REQUEST_ENTITY_TYPE, handleOvertimeApprovalCompletion);
  registerApprovalCompletionHook(
    BUSINESS_TRIP_REQUEST_ENTITY_TYPE,
    handleBusinessTripApprovalCompletion,
  );
  registerApprovalCompletionHook(
    PROJECT_CHARTER_ENTITY_TYPE,
    handleProjectCharterApprovalCompletion,
  );
  registerApprovalCompletionHook(
    PROJECT_MILESTONE_ENTITY_TYPE,
    handleMilestoneSignoffApprovalCompletion,
  );
  registerApprovalCompletionHook(
    PROJECT_BUDGET_ENTITY_TYPE,
    handleBudgetChangeApprovalCompletion,
  );
  registerApprovalCompletionHook(
    PROPOSAL_ENTITY_TYPE,
    handleProposalApprovalCompletion,
  );
  hooksRegistered = true;
}

ensureApprovalHooksRegistered();
