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
  PAYMENT_DEFAULT_REQUEST_TYPE,
  PAYMENT_MODULE_CODE,
} from '@/modules/payments/payments.constants';
import {
  getPaymentDetail,
  listPayments,
  type ListPaymentsQuery,
  type PaymentDetailView,
} from '@/modules/payments/payments.service';

const PAYMENT_TYPE_LABELS_VI: Record<string, string> = {
  CASH_ADVANCE: 'Đề nghị Tạm ứng',
  REIMBURSEMENT: 'Đề nghị Hoàn ứng / Công tác phí',
  VENDOR_PAYMENT: 'Thanh toán Nhà cung cấp / Hóa đơn VAT',
  ADVANCE_SETTLEMENT: 'Quyết toán Tạm ứng',
};

const PAYMENT_STATUS_LABELS_VI: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  NEEDS_REVISION: 'Cần bổ sung chứng từ',
  APPROVED: 'Đã duyệt — Chờ giải ngân',
  REJECTED: 'Từ chối',
  PARTIALLY_PAID: 'Đang chi trả từng phần',
  PAID: 'Đã hoàn tất chi trả',
  CANCELLED: 'Đã hủy',
};

const PRIORITY_LABELS_VI: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const METHOD_LABELS_VI: Record<string, string> = {
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  CASH: 'Tiền mặt',
};

const ACTION_LABELS_VI: Record<string, string> = {
  SUBMIT: 'Gửi phê duyệt',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  CANCEL: 'Thu hồi / Hủy',
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

async function resolvePaymentWorkflowSteps(
  detail: PaymentDetailView,
): Promise<ResolvedWorkflowStep[]> {
  const db = getDb();
  let workflowId: number | null = detail.approval?.request.workflowId ?? null;

  if (!workflowId) {
    const candidates = await db
      .selectFrom('approval_workflows')
      .select(['id', 'branch_id', 'conditions_json'])
      .where('module_code', '=', PAYMENT_MODULE_CODE)
      .where('request_type', '=', PAYMENT_DEFAULT_REQUEST_TYPE)
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
      if (evaluateWorkflowConditions(rule, { amount: detail.totalAmount })) {
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
      'u.full_name as user_name',
    ])
    .where('s.workflow_id', '=', workflowId)
    .orderBy('s.step_order', 'asc')
    .execute();

  return rows.map((r) => ({
    stepOrder: Number(r.step_order),
    approverType: r.approver_type,
    roleName: r.role_name ?? null,
    specificUserId: r.approver_user_id !== null ? Number(r.approver_user_id) : null,
    specificUserName: r.user_name ?? null,
  }));
}

async function loadEmployeeIdentities(
  userIds: readonly number[],
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
    .leftJoin('positions as p', 'p.id', 'e.position_id')
    .leftJoin('departments as d', 'd.id', 'e.department_id')
    .select([
      'u.id as user_id',
      'u.full_name',
      'e.employee_code',
      'p.name as position_name',
      'd.name as department_name',
    ])
    .where('u.id', 'in', uniqueIds)
    .execute();

  for (const r of rows) {
    map.set(Number(r.user_id), {
      userId: Number(r.user_id),
      fullName: r.full_name,
      employeeCode: r.employee_code ?? null,
      positionName: r.position_name ?? null,
      departmentName: r.department_name ?? null,
    });
  }
  return map;
}

async function buildPaymentSignatures(detail: PaymentDetailView): Promise<PdfSignatureSlot[]> {
  const steps = await resolvePaymentWorkflowSteps(detail);
  const histories = detail.approval?.histories ?? [];
  const lastDisbursement = detail.disbursements[0] ?? null;

  const userIdsToLoad: number[] = [detail.requesterUserId];
  for (const h of histories) {
    userIdsToLoad.push(h.actorId);
  }
  for (const s of steps) {
    if (s.specificUserId) {
      userIdsToLoad.push(s.specificUserId);
    }
  }
  if (lastDisbursement) {
    userIdsToLoad.push(lastDisbursement.disbursedByUserId);
  }

  const identities = await loadEmployeeIdentities(userIdsToLoad);
  const requesterInfo = identities.get(detail.requesterUserId);

  const slots: PdfSignatureSlot[] = [
    {
      title: 'NGƯỜI ĐỀ NGHỊ',
      stepLabel: 'Lập chứng từ',
      roleTitle: requesterInfo?.positionName ?? detail.departmentName ?? 'Nhân viên đề nghị',
      subtitle: '(Ký, ghi rõ họ tên)',
      name: requesterInfo?.fullName ?? detail.requesterName,
      code: requesterInfo?.employeeCode ?? undefined,
      statusText: detail.submittedAt ? 'ĐÃ LẬP & GỬI DUYỆT' : 'BẢN NHÁP',
      statusTone: detail.submittedAt ? 'approved' : 'draft',
      signedAt: detail.submittedAt
        ? formatDateTimeVN(detail.submittedAt)
        : formatDateTimeVN(detail.createdAt),
    },
  ];

  const effectiveSteps: ResolvedWorkflowStep[] =
    steps.length > 0
      ? steps
      : [
          {
            stepOrder: 1,
            approverType: 'DIRECT_MANAGER',
            roleName: 'Trưởng Bộ phận',
            specificUserId: null,
            specificUserName: null,
          },
          {
            stepOrder: 2,
            approverType: 'ROLE',
            roleName: 'Kế toán Thanh toán',
            specificUserId: null,
            specificUserName: null,
          },
        ];

  for (const step of effectiveSteps) {
    const stepAction = [...histories]
      .reverse()
      .find(
        (h) =>
          h.stepOrder === step.stepOrder && (h.action === 'APPROVE' || h.action === 'REJECT'),
      );
    const actorInfo = stepAction ? identities.get(stepAction.actorId) : undefined;
    const roleLabel =
      step.approverType === 'DIRECT_MANAGER'
        ? 'QUẢN LÝ TRỰC TIẾP'
        : (step.roleName ?? `CẤP DUYỆT ${step.stepOrder}`).toUpperCase();

    let statusText = 'CHỜ PHÊ DUYỆT';
    let statusTone: PdfSignatureSlot['statusTone'] = 'pending';
    if (stepAction?.action === 'APPROVE') {
      statusText = 'ĐÃ PHÊ DUYỆT';
      statusTone = 'approved';
    } else if (stepAction?.action === 'REJECT') {
      statusText = 'ĐÃ TỪ CHỐI';
      statusTone = 'rejected';
    } else if (
      detail.status === 'APPROVED' ||
      detail.status === 'PARTIALLY_PAID' ||
      detail.status === 'PAID'
    ) {
      statusText = 'ĐÃ PHÊ DUYỆT';
      statusTone = 'approved';
    }

    slots.push({
      title: roleLabel,
      stepLabel: `Cấp duyệt ${step.stepOrder}`,
      roleTitle: actorInfo?.positionName ?? step.roleName ?? undefined,
      subtitle: '(Ký, ghi rõ họ tên)',
      name: actorInfo?.fullName ?? stepAction?.actorName ?? step.specificUserName ?? '',
      code: actorInfo?.employeeCode ?? undefined,
      statusText,
      statusTone,
      signedAt: stepAction ? formatDateTimeVN(stepAction.actedAt) : undefined,
      note: stepAction?.comment ?? undefined,
    });
  }

  if (lastDisbursement || detail.status === 'PAID' || detail.status === 'PARTIALLY_PAID') {
    const disbInfo = lastDisbursement
      ? identities.get(lastDisbursement.disbursedByUserId)
      : undefined;
    slots.push({
      title: 'KẾ TOÁN GIẢI NGÂN',
      stepLabel: 'Xác nhận chi trả',
      roleTitle: lastDisbursement?.bankTransactionRef
        ? `Mã GD: ${lastDisbursement.bankTransactionRef}`
        : METHOD_LABELS_VI[detail.paymentMethod],
      subtitle: '(Ký, đóng dấu xác nhận)',
      name: disbInfo?.fullName ?? lastDisbursement?.disbursedByName ?? '',
      code: disbInfo?.employeeCode ?? undefined,
      statusText: detail.status === 'PAID' ? 'ĐÃ GIẢI NGÂN ĐỦ' : 'ĐANG CHI TRẢ',
      statusTone: detail.status === 'PAID' ? 'approved' : 'pending',
      signedAt: lastDisbursement ? formatDateVN(lastDisbursement.disbursementDate) : undefined,
    });
  }

  return slots;
}

export async function exportPaymentsExcel(
  auth: AuthContext,
  query: ListPaymentsQuery,
): Promise<{ filename: string; buffer: Buffer }> {
  const { items } = await listPayments(auth, {
    ...query,
    page: 1,
    limit: 5000,
  });

  const rows = items.map((item, idx) => ({
    stt: idx + 1,
    code: item.code,
    paymentType: PAYMENT_TYPE_LABELS_VI[item.paymentType] ?? item.paymentType,
    title: item.title,
    categoryName: item.categoryName,
    priority: PRIORITY_LABELS_VI[item.priority] ?? item.priority,
    status: PAYMENT_STATUS_LABELS_VI[item.status] ?? item.status,
    requesterName: item.requesterName,
    branchName: item.branchName ?? '—',
    departmentName: item.departmentName ?? '—',
    budgetLabel: item.budgetCode ? `${item.budgetCode} — ${item.budgetName ?? ''}` : '—',
    beneficiaryName: item.beneficiaryName,
    paymentMethod: METHOD_LABELS_VI[item.paymentMethod] ?? item.paymentMethod,
    subtotalAmount: item.subtotalAmount,
    taxAmount: item.taxAmount,
    totalAmount: item.totalAmount,
    payableAmount: item.payableAmount,
    disbursedAmount: item.disbursedAmount,
    remainingAmount: item.remainingAmount,
    dueDate: item.dueDate ? formatDateVN(item.dueDate) : '—',
    createdAt: formatDateTimeVN(item.createdAt),
    paidAt: item.paidAt ? formatDateTimeVN(item.paidAt) : '—',
  }));

  const buffer = await buildExcelBuffer(
    rows,
    [
      { header: 'STT', key: 'stt', width: 6, align: 'center' },
      { header: 'Mã phiếu', key: 'code', width: 18, align: 'center' },
      { header: 'Loại chứng từ', key: 'paymentType', width: 26 },
      { header: 'Tiêu đề đề nghị', key: 'title', width: 38 },
      { header: 'Danh mục khoản chi', key: 'categoryName', width: 26 },
      { header: 'Ưu tiên', key: 'priority', width: 12, align: 'center' },
      { header: 'Trạng thái', key: 'status', width: 22, align: 'center' },
      { header: 'Người đề nghị', key: 'requesterName', width: 22 },
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Phòng ban', key: 'departmentName', width: 22 },
      { header: 'Quỹ ngân sách', key: 'budgetLabel', width: 30 },
      { header: 'Đơn vị thụ hưởng', key: 'beneficiaryName', width: 28 },
      { header: 'Phương thức', key: 'paymentMethod', width: 20, align: 'center' },
      { header: 'Trước thuế (VNĐ)', key: 'subtotalAmount', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Thuế VAT (VNĐ)', key: 'taxAmount', width: 16, align: 'right', numFmt: '#,##0' },
      { header: 'Tổng cộng (VNĐ)', key: 'totalAmount', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Cần chi trả (VNĐ)', key: 'payableAmount', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Đã giải ngân (VNĐ)', key: 'disbursedAmount', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Còn lại (VNĐ)', key: 'remainingAmount', width: 18, align: 'right', numFmt: '#,##0' },
      { header: 'Hạn thanh toán', key: 'dueDate', width: 16, align: 'center' },
      { header: 'Ngày tạo', key: 'createdAt', width: 20, align: 'center' },
      { header: 'Ngày hoàn tất chi', key: 'paidAt', width: 20, align: 'center' },
    ],
    {
      sheetName: 'Bang_Ke_Thanh_Toan',
      title: 'BẢNG KÊ ĐỀ NGHỊ THANH TOÁN & TẠM ỨNG — OPERON HUB',
    },
  );

  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    filename: `operon-payments-${dateTag}.xlsx`,
    buffer,
  };
}

export async function generatePaymentPdf(
  auth: AuthContext,
  paymentId: number,
): Promise<{ filename: string; buffer: Buffer }> {
  const detail = await getPaymentDetail(auth, paymentId);
  const signatures = await buildPaymentSignatures(detail);

  const bankSummary =
    detail.paymentMethod === 'BANK_TRANSFER'
      ? [
          detail.bankName ? `Ngân hàng: ${detail.bankName}` : null,
          detail.bankAccountNo ? `STK: ${detail.bankAccountNo}` : null,
          detail.bankBranch ? `CN: ${detail.bankBranch}` : null,
        ]
          .filter(Boolean)
          .join(' • ') || 'Chưa cung cấp'
      : 'Chi tiền mặt tại quỹ công ty';

  // Section 1: Overview & Beneficiary — Note ALWAYS in Column 3 (last column)
  const overviewRows: PdfSectionRow[] = [
    {
      label: 'Tiêu đề đề nghị',
      value: detail.title,
      note: `Ưu tiên: ${PRIORITY_LABELS_VI[detail.priority] ?? detail.priority}`,
      isBold: true,
    },
    {
      label: 'Diễn giải chi tiết',
      value: detail.description,
      note: detail.categoryName,
    },
    {
      label: 'Đơn vị / Người thụ hưởng',
      value: detail.beneficiaryName,
      note: detail.beneficiaryTaxCode
        ? `MST: ${detail.beneficiaryTaxCode}`
        : detail.beneficiaryType === 'VENDOR'
          ? 'Nhà cung cấp'
          : 'Nhân viên nội bộ',
    },
    {
      label: 'Thông tin chuyển khoản / Chi trả',
      value: bankSummary,
      note: METHOD_LABELS_VI[detail.paymentMethod] ?? detail.paymentMethod,
    },
  ];

  if (detail.budgetCode) {
    overviewRows.push({
      label: 'Nguồn quỹ ngân sách',
      value: `[${detail.budgetCode}] ${detail.budgetName ?? ''}`,
      note: detail.isOverBudget
        ? 'Cảnh báo vượt hạn mức (Soft Warn)'
        : detail.proposalReserveUsed > 0
          ? `Kế thừa giữ chỗ Đề xuất: ${formatVND(detail.proposalReserveUsed)}`
          : 'Hạch toán theo quỹ Operon Hub',
    });
  }

  if (detail.proposalCode || detail.projectCode || detail.linkedAdvanceCode) {
    const links = [
      detail.proposalCode ? `Đề xuất: ${detail.proposalCode}` : null,
      detail.projectCode ? `Dự án: ${detail.projectCode}` : null,
      detail.linkedAdvanceCode ? `Tạm ứng gốc: ${detail.linkedAdvanceCode}` : null,
    ].filter(Boolean);
    overviewRows.push({
      label: 'Hồ sơ liên kết',
      value: links.join(' • '),
      note: detail.advanceDueDate
        ? `Hạn hoàn ứng: ${formatDateVN(detail.advanceDueDate)}`
        : 'Liên kết hệ thống Operon Hub',
    });
  }

  // Section 2: Line items & VAT — Note ALWAYS in Column 3 (last column)
  const itemRows: PdfSectionRow[] = detail.items.map((item, idx) => {
    const invMeta = [
      item.invoiceNo ? `HĐ: ${item.invoiceNo}` : null,
      item.invoiceDate ? formatDateVN(item.invoiceDate) : null,
    ]
      .filter(Boolean)
      .join(' • ');
    const calcDetail = `${item.quantity} × ${formatVND(item.unitPrice)}${
      item.taxRate > 0 ? ` + VAT ${item.taxRate}%` : ''
    } = ${formatVND(item.lineTotal)}`;

    return {
      label: `${idx + 1}. ${item.description}${invMeta ? `\n(${invMeta})` : ''}`,
      value: calcDetail,
      note: item.note ?? '—',
    };
  });

  if (detail.paymentType === 'ADVANCE_SETTLEMENT') {
    const dirLabel =
      detail.settlementDirection === 'PAY_MORE'
        ? 'Công ty chi bổ sung cho nhân viên'
        : detail.settlementDirection === 'REFUND_COMPANY'
          ? 'Nhân viên hoàn trả tiền thừa vào quỹ'
          : 'Khớp số tạm ứng (0 ₫)';
    itemRows.push({
      label: `Đối chiếu Tạm ứng gốc (${detail.linkedAdvanceCode ?? '—'})`,
      value: `Đã ứng: ${formatVND(detail.advanceAmount)} • Chênh lệch: ${formatVND(Math.abs(detail.netSettlementAmount))}`,
      note: dirLabel,
      isBold: true,
    });
  }

  itemRows.push({
    label: 'Số tiền bằng chữ',
    value: detail.amountInWordsVi,
    note: `Trước thuế: ${formatVND(detail.subtotalAmount)} • VAT: ${formatVND(detail.taxAmount)}`,
    isBold: true,
  });

  const sections: PdfTableSection[] = [
    {
      title: '1. Thông tin Đề nghị & Đơn vị Thụ hưởng',
      labelHeader: 'Hạng mục',
      valueHeader: 'Nội dung chi tiết',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['25%', '51%', '24%'],
      rows: overviewRows,
    },
    {
      title: '2. Bảng kê Chứng từ & Hạng mục Chi tiết',
      labelHeader: 'Hạng mục / Số Hóa đơn',
      valueHeader: 'SL × Đơn giá + VAT = Thành tiền',
      noteHeader: 'Ghi chú',
      valueAlignment: 'right',
      columnWidths: ['36%', '38%', '26%'],
      rows: itemRows,
      totalLabel: 'TỔNG CỘNG THANH TOÁN',
      totalValue: formatVND(detail.totalAmount),
      totalNote:
        detail.paymentType === 'ADVANCE_SETTLEMENT'
          ? `Cần chi/thu: ${formatVND(Math.abs(detail.netSettlementAmount))}`
          : `Đã giải ngân: ${formatVND(detail.disbursedAmount)}`,
    },
  ];

  // Section 3: Approval & Disbursement History — Note ALWAYS in Column 3 (last column)
  const historyRows: PdfSectionRow[] = [];
  if (detail.approval && detail.approval.histories.length > 0) {
    for (const h of detail.approval.histories) {
      historyRows.push({
        label: `Bước duyệt ${h.stepOrder} — ${ACTION_LABELS_VI[h.action] ?? h.action}`,
        value: `${h.actorName ?? 'Hệ thống'}\n${formatDateTimeVN(h.actedAt)}`,
        note: h.comment ?? '—',
      });
    }
  }
  for (const d of detail.disbursements) {
    const dirLabel = d.direction === 'INCOMING_REFUND' ? 'Thu hồi hoàn quỹ' : 'Giải ngân chi trả';
    historyRows.push({
      label: `${dirLabel} — ${formatVND(d.amount)}`,
      value: `${d.disbursedByName} • ${formatDateVN(d.disbursementDate)}${
        d.bankTransactionRef ? `\nMã GD: ${d.bankTransactionRef}` : ''
      }`,
      note: [d.sourceAccount, d.note].filter(Boolean).join(' • ') || '—',
    });
  }

  if (historyRows.length > 0) {
    sections.push({
      title: '3. Lịch sử Phê duyệt & Giải ngân Kế toán',
      labelHeader: 'Bước / Đợt giải ngân',
      valueHeader: 'Người thực hiện, Mã GD & Thời gian',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['32%', '38%', '30%'],
      rows: historyRows,
    });
  }

  const doc = buildStructuredPdfDocument({
    companyName: 'OPERON HUB — HỆ THỐNG QUẢN TRỊ TÀI CHÍNH NỘI BỘ',
    companyMeta: `Chi nhánh: ${detail.branchName ?? 'Trụ sở chính'}${
      detail.departmentName ? ` • Phòng ban: ${detail.departmentName}` : ''
    }`,
    title: (PAYMENT_TYPE_LABELS_VI[detail.paymentType] ?? 'PHIẾU ĐỀ NGHỊ THANH TOÁN').toUpperCase(),
    subtitle: `Mã chứng từ: ${detail.code} • Danh mục: ${detail.categoryName}`,
    metadata: [
      { label: 'Người đề nghị', value: detail.requesterName },
      { label: 'Trạng thái', value: PAYMENT_STATUS_LABELS_VI[detail.status] ?? detail.status },
      { label: 'Ngày lập phiếu', value: formatDateTimeVN(detail.createdAt) },
      {
        label: 'Hạn thanh toán',
        value: detail.dueDate ? formatDateVN(detail.dueDate) : 'Chưa ấn định',
      },
      { label: 'Hình thức chi', value: METHOD_LABELS_VI[detail.paymentMethod] },
      {
        label: 'Tiến độ chi trả',
        value: `${formatVND(detail.disbursedAmount)} / ${formatVND(
          detail.paymentType === 'ADVANCE_SETTLEMENT'
            ? Math.abs(detail.netSettlementAmount)
            : detail.payableAmount,
        )}`,
      },
    ],
    sections,
    highlight: {
      label:
        detail.paymentType === 'ADVANCE_SETTLEMENT' && detail.netSettlementAmount < 0
          ? 'SỐ TIỀN NHÂN VIÊN HOÀN QUỸ'
          : detail.paymentType === 'ADVANCE_SETTLEMENT'
            ? 'SỐ TIỀN CÔNG TY CHI BỔ SUNG'
            : 'TỔNG SỐ TIỀN ĐỀ NGHỊ THANH TOÁN',
      value: formatVND(
        detail.paymentType === 'ADVANCE_SETTLEMENT'
          ? Math.abs(detail.netSettlementAmount)
          : detail.totalAmount,
      ),
      subtext: `Bằng chữ: ${detail.amountInWordsVi}`,
    },
    footnote:
      'Chứng từ được xuất tự động từ Operon Hub (Module Đề nghị Thanh toán & Tạm ứng) — đồng bộ đối soát với Core Approval Engine và nhật ký giải ngân.',
    signatureSectionTitle: 'XÁC NHẬN & PHÊ DUYỆT CHỨNG TỪ THANH TOÁN',
    signatureHeader: `${detail.branchName ?? 'Trụ sở chính'}, ${formatVietnameseDateStamp(
      detail.paidAt ?? detail.approvedAt ?? detail.submittedAt ?? detail.createdAt,
    )}`,
    signatures,
    footerLeftText: `Operon Hub • Chứng từ ${detail.code}`,
  });

  const buffer = await generatePdfBuffer(doc);
  return {
    filename: `${detail.code}.pdf`,
    buffer,
  };
}
