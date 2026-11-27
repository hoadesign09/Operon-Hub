import { getDb, type ApproverType } from '@/config/database';
import {
  evaluateWorkflowConditions,
  type WorkflowConditionRule,
} from '@/lib/portable/approval-engine';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
  type PdfSectionRow,
  type PdfSignatureSlot,
  type PdfTableSection,
} from '@/lib/portable/pdf-generator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  PROPOSAL_DEFAULT_REQUEST_TYPE,
  PROPOSAL_MODULE_CODE,
} from '@/modules/proposals/proposals.constants';
import {
  getProposalDetail,
  listProposals,
  type ListProposalsQuery,
  type ProposalDetailView,
} from '@/modules/proposals/proposals.service';

const STATUS_LABELS_VI: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  NEEDS_REVISION: 'Cần chỉnh sửa',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Từ chối',
  IN_EXECUTION: 'Đang thực thi',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const PRIORITY_LABELS_VI: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const ACTION_LABELS_VI: Record<string, string> = {
  SUBMIT: 'Gửi phê duyệt',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  CANCEL: 'Hủy / Thu hồi',
};

interface EmployeeIdentityInfo {
  userId: number;
  fullName: string;
  employeeCode: string | null;
  positionName: string | null;
  departmentName: string | null;
}

interface ResolvedWorkflowStep {
  stepOrder: number;
  approverType: ApproverType;
  roleName: string | null;
  specificUserId: number | null;
  specificUserName: string | null;
}

function truncateText(value: string, maxLength: number): string {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatVietnameseDateStamp(dateInput: Date | string | null | undefined): string {
  const parsed = dateInput ? new Date(dateInput) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const day = String(safeDate.getDate()).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const year = safeDate.getFullYear();
  return `ngày ${day} tháng ${month} năm ${year}`;
}

function parseWorkflowConditions(raw: unknown): WorkflowConditionRule | null {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as WorkflowConditionRule;
    } catch {
      return null;
    }
  }
  return typeof raw === 'object' ? (raw as WorkflowConditionRule) : null;
}

async function resolveProposalWorkflowSteps(
  detail: ProposalDetailView,
): Promise<ResolvedWorkflowStep[]> {
  const db = getDb();
  let workflowId: number | null = detail.approval?.request.workflowId ?? null;

  if (!workflowId) {
    const candidates = await db
      .selectFrom('approval_workflows')
      .select(['id', 'branch_id', 'conditions_json'])
      .where('module_code', '=', PROPOSAL_MODULE_CODE)
      .where('request_type', '=', PROPOSAL_DEFAULT_REQUEST_TYPE)
      .where('is_active', '=', 1)
      .where('deleted_at', 'is', null)
      .where((eb) =>
        eb.or([eb('branch_id', '=', detail.branchId), eb('branch_id', 'is', null)]),
      )
      .orderBy('branch_id', 'desc')
      .orderBy('id', 'asc')
      .execute();

    for (const wf of candidates) {
      const rule = parseWorkflowConditions(wf.conditions_json);
      if (evaluateWorkflowConditions(rule, { amount: detail.estimatedBudget })) {
        workflowId = Number(wf.id);
        break;
      }
    }
  }

  if (!workflowId) {
    return [];
  }

  const rows = await db
    .selectFrom('approval_workflow_steps as s')
    .leftJoin('roles as r', 'r.id', 's.approver_role_id')
    .leftJoin('users as u', 'u.id', 's.approver_user_id')
    .select([
      's.step_order',
      's.approver_type',
      'r.name as role_name',
      's.approver_user_id',
      'u.full_name as specific_user_name',
    ])
    .where('s.workflow_id', '=', workflowId)
    .orderBy('s.step_order', 'asc')
    .execute();

  return rows.map((row) => ({
    stepOrder: Number(row.step_order),
    approverType: row.approver_type,
    roleName: row.role_name ?? null,
    specificUserId: row.approver_user_id !== null ? Number(row.approver_user_id) : null,
    specificUserName: row.specific_user_name ?? null,
  }));
}

async function loadEmployeeIdentitiesByUserIds(
  userIds: number[],
): Promise<Map<number, EmployeeIdentityInfo>> {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)));
  const map = new Map<number, EmployeeIdentityInfo>();
  if (uniqueIds.length === 0) {
    return map;
  }

  const db = getDb();
  const rows = await db
    .selectFrom('users as u')
    .leftJoin('employees as e', (join) =>
      join.onRef('e.user_id', '=', 'u.id').on('e.deleted_at', 'is', null),
    )
    .leftJoin('positions as pos', 'pos.id', 'e.position_id')
    .leftJoin('departments as dep', 'dep.id', 'e.department_id')
    .select([
      'u.id as user_id',
      'u.full_name',
      'e.employee_code',
      'pos.name as position_name',
      'dep.name as department_name',
    ])
    .where('u.id', 'in', uniqueIds)
    .execute();

  for (const row of rows) {
    const uid = Number(row.user_id);
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        fullName: row.full_name,
        employeeCode: row.employee_code ?? null,
        positionName: row.position_name ?? null,
        departmentName: row.department_name ?? null,
      });
    }
  }

  return map;
}

async function loadDirectManagerIdentity(
  requesterUserId: number,
): Promise<EmployeeIdentityInfo | null> {
  const db = getDb();
  const row = await db
    .selectFrom('employees as e')
    .innerJoin('employees as mgr', 'mgr.id', 'e.manager_id')
    .leftJoin('positions as pos', 'pos.id', 'mgr.position_id')
    .leftJoin('departments as dep', 'dep.id', 'mgr.department_id')
    .select([
      'mgr.user_id as manager_user_id',
      'mgr.full_name as manager_name',
      'mgr.employee_code as manager_code',
      'pos.name as position_name',
      'dep.name as department_name',
    ])
    .where('e.user_id', '=', requesterUserId)
    .where('e.deleted_at', 'is', null)
    .where('mgr.deleted_at', 'is', null)
    .executeTakeFirst();

  if (!row) {
    return null;
  }

  return {
    userId: row.manager_user_id !== null ? Number(row.manager_user_id) : 0,
    fullName: row.manager_name,
    employeeCode: row.manager_code ?? null,
    positionName: row.position_name ?? null,
    departmentName: row.department_name ?? null,
  };
}

function formatRoleDepartment(
  positionName: string | null | undefined,
  departmentName: string | null | undefined,
  fallback: string,
): string {
  const parts = [positionName, departmentName].filter(
    (part): part is string => Boolean(part && part.trim().length > 0),
  );
  return parts.length > 0 ? parts.join(' • ') : fallback;
}

async function buildProposalSignatures(
  detail: ProposalDetailView,
): Promise<PdfSignatureSlot[]> {
  const [steps, directManager] = await Promise.all([
    resolveProposalWorkflowSteps(detail),
    loadDirectManagerIdentity(detail.requesterUserId),
  ]);

  const histories = detail.approval?.histories ?? [];
  const decisionByStep = new Map<
    number,
    {
      actorId: number;
      actorName: string | null;
      action: 'APPROVE' | 'REJECT';
      comment: string | null;
      actedAt: string;
    }
  >();

  for (const h of histories) {
    if (h.action === 'APPROVE' || h.action === 'REJECT') {
      decisionByStep.set(h.stepOrder, {
        actorId: h.actorId,
        actorName: h.actorName,
        action: h.action,
        comment: h.comment,
        actedAt: h.actedAt,
      });
    }
  }

  const userIdsToLoad: number[] = [detail.requesterUserId];
  for (const decision of decisionByStep.values()) {
    userIdsToLoad.push(decision.actorId);
  }
  for (const step of steps) {
    if (step.specificUserId) {
      userIdsToLoad.push(step.specificUserId);
    }
  }

  const identityMap = await loadEmployeeIdentitiesByUserIds(userIdsToLoad);
  const requesterInfo = identityMap.get(detail.requesterUserId);

  const slots: PdfSignatureSlot[] = [
    {
      title: 'NGƯỜI ĐỀ XUẤT',
      roleTitle: formatRoleDepartment(
        requesterInfo?.positionName,
        detail.departmentName ?? requesterInfo?.departmentName,
        detail.branchName,
      ),
      subtitle: '(Ký, ghi rõ họ tên)',
      name: detail.requesterName,
      code: requesterInfo?.employeeCode ? `Mã NV: ${requesterInfo.employeeCode}` : undefined,
      statusText: detail.submittedAt ? 'ĐÃ LẬP & TRÌNH DUYỆT' : 'BẢN NHÁP',
      statusTone: detail.submittedAt ? 'approved' : 'draft',
      signedAt: formatDateTimeVN(detail.submittedAt ?? detail.createdAt),
    },
  ];

  const effectiveSteps: ResolvedWorkflowStep[] =
    steps.length > 0
      ? steps
      : [
          {
            stepOrder: 1,
            approverType: 'DIRECT_MANAGER',
            roleName: 'Trưởng bộ phận',
            specificUserId: null,
            specificUserName: null,
          },
          {
            stepOrder: 2,
            approverType: 'ROLE',
            roleName: 'Ban Giám đốc',
            specificUserId: null,
            specificUserName: null,
          },
        ];

  const totalSteps = effectiveSteps.length;
  const currentStep = detail.approval?.request.currentStep ?? detail.approvalCurrentStep ?? null;

  for (const step of effectiveSteps) {
    const isFinalStep = step.stepOrder === totalSteps;
    const decision = decisionByStep.get(step.stepOrder);
    const stepTitle =
      step.approverType === 'DIRECT_MANAGER'
        ? 'QUẢN LÝ TRỰC TIẾP'
        : step.roleName
          ? step.roleName.toUpperCase()
          : step.specificUserName
            ? 'NGƯỜI PHÊ DUYỆT'
            : `CẤP PHÊ DUYỆT ${step.stepOrder}`;

    const subtitle = isFinalStep
      ? '(Ký duyệt, ghi rõ họ tên & đóng dấu)'
      : '(Ký duyệt, ghi rõ họ tên)';

    if (decision) {
      const actorInfo = identityMap.get(decision.actorId);
      slots.push({
        title: stepTitle,
        roleTitle: formatRoleDepartment(
          actorInfo?.positionName,
          actorInfo?.departmentName,
          step.roleName ?? 'Cấp phê duyệt hệ thống',
        ),
        subtitle,
        name: actorInfo?.fullName ?? decision.actorName ?? undefined,
        code: actorInfo?.employeeCode ? `Mã NV: ${actorInfo.employeeCode}` : undefined,
        statusText: decision.action === 'APPROVE' ? 'ĐÃ PHÊ DUYỆT' : 'ĐÃ TỪ CHỐI',
        statusTone: decision.action === 'APPROVE' ? 'approved' : 'rejected',
        signedAt: formatDateTimeVN(decision.actedAt),
        note: decision.comment ? truncateText(decision.comment, 68) : undefined,
      });
      continue;
    }

    const expectedIdentity =
      step.approverType === 'DIRECT_MANAGER'
        ? directManager
        : step.specificUserId
          ? identityMap.get(step.specificUserId) ?? null
          : null;

    const isCurrentPending =
      detail.status === 'PENDING_APPROVAL' && currentStep === step.stepOrder;

    let statusText = 'CHỜ ĐẾN LƯỢT';
    let statusTone: PdfSignatureSlot['statusTone'] = 'draft';
    if (isCurrentPending) {
      statusText = 'ĐANG CHỜ PHÊ DUYỆT';
      statusTone = 'pending';
    } else if (detail.status === 'DRAFT') {
      statusText = 'CHƯA TRÌNH DUYỆT';
    } else if (detail.status === 'NEEDS_REVISION') {
      statusText = 'CHỜ CHỈNH SỬA LẠI';
      statusTone = 'pending';
    } else if (detail.status === 'CANCELLED') {
      statusText = 'ĐÃ HỦY TỜ TRÌNH';
    } else if (detail.status === 'REJECTED') {
      statusText = 'DỪNG DO TỪ CHỐI';
    }

    slots.push({
      title: stepTitle,
      roleTitle: formatRoleDepartment(
        expectedIdentity?.positionName,
        expectedIdentity?.departmentName,
        step.approverType === 'DIRECT_MANAGER'
          ? 'Quản lý trực tiếp bộ phận'
          : step.roleName ?? 'Theo phân quyền hệ thống',
      ),
      subtitle,
      name: expectedIdentity?.fullName ?? step.specificUserName ?? undefined,
      code: expectedIdentity?.employeeCode ? `Mã NV: ${expectedIdentity.employeeCode}` : undefined,
      statusText,
      statusTone,
    });
  }

  return slots;
}

export async function exportProposalsExcel(
  auth: AuthContext,
  query: ListProposalsQuery,
): Promise<{ filename: string; buffer: Buffer }> {
  const { items } = await listProposals(auth, {
    ...query,
    page: '1',
    limit: '100',
  });

  const rows = items.map((item, index) => ({
    stt: index + 1,
    proposalCode: item.proposalCode,
    title: item.title,
    categoryName: item.categoryName,
    requesterName: item.requesterName,
    branchName: item.branchName,
    departmentName: item.departmentName ?? '-',
    budgetLabel: item.budgetCode ? `${item.budgetCode} — ${item.budgetName ?? ''}` : '-',
    priority: PRIORITY_LABELS_VI[item.priority] ?? item.priority,
    status: STATUS_LABELS_VI[item.status] ?? item.status,
    estimatedBudget: item.estimatedBudget,
    approvedBudget: item.approvedBudget ?? 0,
    vendorName: item.vendorName ?? '-',
    neededByDate: item.neededByDate ? formatDateVN(item.neededByDate) : '-',
    submittedAt: item.submittedAt ? formatDateTimeVN(item.submittedAt) : '-',
    createdAt: formatDateTimeVN(item.createdAt),
  }));

  const buffer = await buildExcelBuffer(
    rows,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center' },
      { header: 'Mã đề xuất', key: 'proposalCode', width: 18 },
      { header: 'Tiêu đề đề xuất', key: 'title', width: 38 },
      { header: 'Danh mục', key: 'categoryName', width: 24 },
      { header: 'Người đề xuất', key: 'requesterName', width: 22 },
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Phòng ban', key: 'departmentName', width: 22 },
      { header: 'Quỹ ngân sách', key: 'budgetLabel', width: 30 },
      { header: 'Ưu tiên', key: 'priority', width: 14, align: 'center' },
      { header: 'Trạng thái', key: 'status', width: 18, align: 'center' },
      {
        header: 'Ngân sách dự kiến (VNĐ)',
        key: 'estimatedBudget',
        width: 22,
        numFmt: '#,##0',
        align: 'right',
      },
      {
        header: 'Ngân sách duyệt (VNĐ)',
        key: 'approvedBudget',
        width: 22,
        numFmt: '#,##0',
        align: 'right',
      },
      { header: 'Nhà cung cấp', key: 'vendorName', width: 22 },
      { header: 'Hạn cần', key: 'neededByDate', width: 14, align: 'center' },
      { header: 'Ngày gửi duyệt', key: 'submittedAt', width: 20, align: 'center' },
      { header: 'Ngày tạo', key: 'createdAt', width: 20, align: 'center' },
    ],
    {
      sheetName: 'Danh_Sach_De_Xuat',
      title: 'DANH SÁCH ĐỀ XUẤT NỘI BỘ — OPERON HUB',
    },
  );

  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    filename: `operon-proposals-${dateTag}.xlsx`,
    buffer,
  };
}

export async function generateProposalPdf(
  auth: AuthContext,
  proposalId: number,
): Promise<{ filename: string; buffer: Buffer }> {
  const detail = await getProposalDetail(auth, proposalId);
  const signatures = await buildProposalSignatures(detail);

  const effectiveRangeNote =
    detail.effectiveFrom || detail.effectiveTo
      ? `Hiệu lực: ${detail.effectiveFrom ? formatDateVN(detail.effectiveFrom) : '—'} → ${detail.effectiveTo ? formatDateVN(detail.effectiveTo) : '—'}`
      : '';

  const overviewRows: PdfSectionRow[] = [
    {
      label: 'Tiêu đề đề xuất',
      value: detail.title,
      note: `Ưu tiên: ${PRIORITY_LABELS_VI[detail.priority] ?? detail.priority}`,
      isBold: true,
    },
    {
      label: 'Tóm tắt ngắn',
      value: detail.summary ?? 'Không có',
      note: detail.categoryName,
    },
    {
      label: 'Nội dung & Lý do chi tiết',
      value: detail.content,
      note: effectiveRangeNote,
    },
    ...(detail.budgetCode
      ? [
          {
            label: 'Nguồn quỹ ngân sách',
            value: `[${detail.budgetCode}] ${detail.budgetName ?? ''}`,
            note:
              detail.budgetReservedAmount > 0
                ? `Đang giữ chỗ: ${formatVND(detail.budgetReservedAmount)}`
                : detail.isOverBudget
                  ? 'Cảnh báo vượt hạn mức'
                  : 'Liên kết quỹ Operon Hub',
          },
        ]
      : []),
    ...(detail.expectedOutcome
      ? [
          {
            label: 'Kết quả & Hiệu quả kỳ vọng',
            value: detail.expectedOutcome,
            note: detail.neededByDate ? `Mục tiêu: ${formatDateVN(detail.neededByDate)}` : '',
          },
        ]
      : []),
    ...(detail.rejectionReason
      ? [
          {
            label: 'Lý do từ chối / Yêu cầu bổ sung',
            value: detail.rejectionReason,
            note: STATUS_LABELS_VI[detail.status] ?? detail.status,
          },
        ]
      : []),
    ...(detail.executionNotes
      ? [
          {
            label: 'Ghi chú thực thi / Nghiệm thu',
            value: detail.executionNotes,
            note: detail.completedAt ? `Hoàn tất: ${formatDateTimeVN(detail.completedAt)}` : '',
          },
        ]
      : []),
  ];

  const sections: PdfTableSection[] = [
    {
      title: '1. Nội dung Tờ trình Đề xuất',
      labelHeader: 'Hạng mục thông tin',
      valueHeader: 'Nội dung chi tiết',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['24%', '52%', '24%'],
      rows: overviewRows,
    },
  ];

  if (detail.items.length > 0) {
    sections.push({
      title: '2. Bảng Dự toán Chi tiết Hạng mục',
      labelHeader: 'Hạng mục dự toán',
      valueHeader: 'Thành tiền (VNĐ)',
      noteHeader: 'Ghi chú / Quy cách',
      valueAlignment: 'right',
      columnWidths: ['36%', '22%', '42%'],
      rows: detail.items.map((item) => {
        const noteParts = [
          `${item.quantity} ${item.unit} × ${formatVND(item.unitPrice)}`,
          item.specification,
          item.vendorNote ? `NCC: ${item.vendorNote}` : null,
        ].filter(Boolean);

        return {
          label: `${item.lineNo}. ${item.itemName}`,
          value: formatVND(item.lineTotal),
          note: noteParts.join(' • '),
        };
      }),
      totalLabel: 'Tổng ngân sách dự kiến',
      totalValue: formatVND(detail.estimatedBudget),
      totalNote:
        detail.approvedBudget !== null
          ? `Ngân sách duyệt: ${formatVND(detail.approvedBudget)}`
          : `Gồm ${detail.items.length} hạng mục`,
    });
  }

  if (detail.approval && detail.approval.histories.length > 0) {
    sections.push({
      title:
        detail.items.length > 0
          ? '3. Lịch sử Phê duyệt Đa cấp'
          : '2. Lịch sử Phê duyệt Đa cấp',
      labelHeader: 'Bước & Người xử lý',
      valueHeader: 'Hành động / Thời điểm',
      noteHeader: 'Ghi chú phê duyệt',
      valueAlignment: 'left',
      columnWidths: ['34%', '28%', '38%'],
      rows: detail.approval.histories.map((h) => ({
        label: `Bước ${h.stepOrder} — ${h.actorName ?? 'Hệ thống'}`,
        value: `${ACTION_LABELS_VI[h.action] ?? h.action}\n${formatDateTimeVN(h.actedAt)}`,
        note: h.comment ?? 'Không có ghi chú',
      })),
    });
  }

  const doc = buildStructuredPdfDocument({
    companyName: 'OPERON HUB — CỔNG VẬN HÀNH DOANH NGHIỆP',
    companyMeta: `Chi nhánh: ${detail.branchName}${detail.departmentName ? ` • Phòng ban: ${detail.departmentName}` : ''}`,
    title: 'TỜ TRÌNH ĐỀ XUẤT NỘI BỘ',
    subtitle: `Mã hồ sơ: ${detail.proposalCode} • Danh mục: ${detail.categoryName}`,
    metadata: [
      { label: 'Người đề xuất', value: detail.requesterName },
      { label: 'Trạng thái', value: STATUS_LABELS_VI[detail.status] ?? detail.status },
      { label: 'Mức ưu tiên', value: PRIORITY_LABELS_VI[detail.priority] ?? detail.priority },
      { label: 'Ngày tạo', value: formatDateTimeVN(detail.createdAt) },
      {
        label: 'Hạn cần hoàn tất',
        value: detail.neededByDate ? formatDateVN(detail.neededByDate) : 'Chưa ấn định',
      },
      { label: 'Nhà cung cấp', value: detail.vendorName ?? 'Không áp dụng' },
    ],
    sections,
    highlight: {
      label:
        detail.approvedBudget !== null
          ? 'NGÂN SÁCH ĐÃ PHÊ DUYỆT'
          : 'TỔNG NGÂN SÁCH DỰ KIẾN',
      value: formatVND(detail.approvedBudget ?? detail.estimatedBudget),
      subtext: detail.approvedAt
        ? `Phê duyệt ngày ${formatDateTimeVN(detail.approvedAt)}`
        : detail.submittedAt
          ? `Gửi duyệt ngày ${formatDateTimeVN(detail.submittedAt)}`
          : 'Đề xuất đang ở trạng thái nháp',
    },
    footnote:
      'Tài liệu được xuất tự động từ hệ thống Operon Hub (Module Đề xuất Nội bộ) và đồng bộ lịch sử xác thực với Core Approval Engine.',
    signatureSectionTitle: 'XÁC NHẬN & PHÊ DUYỆT TỜ TRÌNH',
    signatureHeader: `${detail.branchName}, ${formatVietnameseDateStamp(detail.approvedAt ?? detail.submittedAt ?? detail.createdAt)}`,
    signatures,
    footerLeftText: `Operon Hub • Hồ sơ ${detail.proposalCode}`,
  });

  const buffer = await generatePdfBuffer(doc);
  return {
    filename: `${detail.proposalCode}.pdf`,
    buffer,
  };
}
