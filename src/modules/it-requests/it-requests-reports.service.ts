import { getDb, type ApproverType } from '@/config/database';
import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN } from '@/lib/portable/date-utils';
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
  IT_REQUEST_ACCESS_SOFTWARE_TYPE,
  IT_REQUEST_HARDWARE_TYPE,
  IT_REQUEST_MODULE_CODE,
} from '@/modules/it-requests/it-requests.constants';
import {
  getItRequestDetail,
  listItRequests,
  type ItRequestDetailView,
  type ListItRequestsQuery,
} from '@/modules/it-requests/it-requests.service';

const STATUS_LABELS_VI: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  OPEN: 'Chờ IT tiếp nhận',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_USER: 'Chờ người gửi bổ sung',
  RESOLVED: 'Đã xử lý',
  CLOSED: 'Đã đóng',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const PRIORITY_LABELS_VI: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const KIND_LABELS_VI: Record<string, string> = {
  INCIDENT: 'Sự cố kỹ thuật',
  SERVICE_REQUEST: 'Yêu cầu dịch vụ',
  ACCESS_REQUEST: 'Cấp tài khoản & quyền',
  HARDWARE_PROVISION: 'Cấp phát thiết bị',
};

const SLA_LABELS_VI: Record<string, string> = {
  ON_TRACK: 'Đúng hạn',
  AT_RISK: 'Sắp đến hạn',
  BREACHED: 'Quá hạn SLA',
  MET: 'Đạt SLA',
  PAUSED: 'Đang tạm dừng',
  NONE: 'Chưa kích hoạt',
};

const APPROVAL_ACTION_LABELS_VI: Record<string, string> = {
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

async function resolveItApprovalSteps(
  detail: ItRequestDetailView,
): Promise<ResolvedWorkflowStep[]> {
  if (!detail.requiresApproval && !detail.approval) {
    return [];
  }
  const db = getDb();
  let workflowId: number | null = detail.approval?.request.workflowId ?? null;

  if (!workflowId) {
    const requestType =
      detail.requestKind === 'HARDWARE_PROVISION'
        ? IT_REQUEST_HARDWARE_TYPE
        : IT_REQUEST_ACCESS_SOFTWARE_TYPE;
    const wf = await db
      .selectFrom('approval_workflows')
      .select(['id'])
      .where('module_code', '=', IT_REQUEST_MODULE_CODE)
      .where('request_type', '=', requestType)
      .where('is_active', '=', 1)
      .where('deleted_at', 'is', null)
      .orderBy('branch_id', 'desc')
      .orderBy('id', 'asc')
      .executeTakeFirst();
    workflowId = wf ? Number(wf.id) : null;
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

async function buildItRequestSignatures(
  detail: ItRequestDetailView,
): Promise<PdfSignatureSlot[]> {
  const steps = await resolveItApprovalSteps(detail);
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

  const userIds: number[] = [detail.requesterUserId];
  if (detail.assignedToUserId) {
    userIds.push(detail.assignedToUserId);
  }
  for (const d of decisionByStep.values()) {
    userIds.push(d.actorId);
  }
  for (const st of steps) {
    if (st.specificUserId) {
      userIds.push(st.specificUserId);
    }
  }

  const identityMap = await loadEmployeeIdentitiesByUserIds(userIds);
  const requesterInfo = identityMap.get(detail.requesterUserId);
  const techInfo = detail.assignedToUserId ? identityMap.get(detail.assignedToUserId) : undefined;

  const slots: PdfSignatureSlot[] = [
    {
      stepLabel: 'BƯỚC 1 • NGƯỜI YÊU CẦU',
      title: 'NGƯỜI GỬI YÊU CẦU',
      roleTitle: formatRoleDepartment(
        requesterInfo?.positionName,
        detail.departmentName ?? requesterInfo?.departmentName,
        detail.branchName ?? 'Nhân sự nội bộ',
      ),
      subtitle: '(Ký, ghi rõ họ tên)',
      name: detail.requesterName,
      code: requesterInfo?.employeeCode ? `Mã NV: ${requesterInfo.employeeCode}` : undefined,
      statusText: detail.submittedAt ? 'ĐÃ GỬI YÊU CẦU' : 'BẢN NHÁP',
      statusTone: detail.submittedAt ? 'approved' : 'draft',
      signedAt: formatDateTimeVN(detail.submittedAt ?? detail.createdAt),
    },
  ];

  // Approval steps (if category requires approval or approval record exists)
  for (const step of steps) {
    const decision = decisionByStep.get(step.stepOrder);
    const actorInfo = decision ? identityMap.get(decision.actorId) : undefined;
    const roleLabel =
      step.approverType === 'DIRECT_MANAGER'
        ? 'Quản lý trực tiếp'
        : step.approverType === 'SPECIFIC_USER'
          ? (step.specificUserName ?? 'Người duyệt chỉ định')
          : (step.roleName ?? 'Cấp phê duyệt');

    if (decision) {
      slots.push({
        stepLabel: `DUYỆT CẤP ${step.stepOrder}/${steps.length}`,
        title: roleLabel.toUpperCase(),
        roleTitle: formatRoleDepartment(actorInfo?.positionName, actorInfo?.departmentName, roleLabel),
        subtitle: '(Đã xác nhận phê duyệt số)',
        name: decision.actorName ?? actorInfo?.fullName ?? undefined,
        code: actorInfo?.employeeCode ? `Mã NV: ${actorInfo.employeeCode}` : undefined,
        statusText: decision.action === 'APPROVE' ? 'ĐÃ PHÊ DUYỆT' : 'TỪ CHỐI DUYỆT',
        statusTone: decision.action === 'APPROVE' ? 'approved' : 'rejected',
        signedAt: formatDateTimeVN(decision.actedAt),
        note: decision.comment ? truncateText(decision.comment, 52) : undefined,
      });
    } else {
      slots.push({
        stepLabel: `DUYỆT CẤP ${step.stepOrder}/${steps.length}`,
        title: roleLabel.toUpperCase(),
        roleTitle: roleLabel,
        subtitle: '(Ký, ghi rõ họ tên)',
        statusText: detail.status === 'PENDING_APPROVAL' ? 'CHỜ PHÊ DUYỆT' : 'CHƯA KÝ DUYỆT',
        statusTone: detail.status === 'PENDING_APPROVAL' ? 'pending' : 'draft',
      });
    }
  }

  // IT Technician slot
  const isResolvedOrClosed = detail.status === 'RESOLVED' || detail.status === 'CLOSED';
  slots.push({
    stepLabel: 'BỘ PHẬN CNTT / HELPDESK',
    title: 'KỸ THUẬT VIÊN XỬ LÝ',
    roleTitle: formatRoleDepartment(
      techInfo?.positionName,
      techInfo?.departmentName,
      'Phòng Công nghệ Thông tin',
    ),
    subtitle: '(Ký, xác nhận kết quả)',
    name: detail.assignedToName ?? undefined,
    code: techInfo?.employeeCode ? `Mã NV: ${techInfo.employeeCode}` : undefined,
    statusText: isResolvedOrClosed
      ? 'ĐÃ XỬ LÝ XONG'
      : detail.assignedToName
        ? 'ĐANG PHỤ TRÁCH'
        : 'CHỜ TIẾP NHẬN',
    statusTone: isResolvedOrClosed ? 'approved' : detail.assignedToName ? 'pending' : 'draft',
    signedAt: detail.resolvedAt ? formatDateTimeVN(detail.resolvedAt) : undefined,
  });

  // Acceptance / CSAT signoff slot
  slots.push({
    stepLabel: 'NGHIỆM THU BÀN GIAO',
    title: 'XÁC NHẬN NGHIỆM THU',
    roleTitle: detail.requesterName,
    subtitle: '(Ký xác nhận hoàn tất)',
    name: detail.status === 'CLOSED' ? detail.requesterName : undefined,
    statusText:
      detail.status === 'CLOSED'
        ? detail.satisfactionRating
          ? `ĐÃ NGHIỆM THU (${detail.satisfactionRating}/5 SAO)`
          : 'ĐÃ NGHIỆM THU'
        : 'CHỜ NGHIỆM THU',
    statusTone: detail.status === 'CLOSED' ? 'approved' : 'pending',
    signedAt: detail.closedAt ? formatDateTimeVN(detail.closedAt) : undefined,
    note: detail.satisfactionFeedback ? truncateText(detail.satisfactionFeedback, 52) : undefined,
  });

  return slots;
}

export async function exportItRequestsExcelBuffer(
  auth: AuthContext,
  query: ListItRequestsQuery,
): Promise<Buffer> {
  const { items } = await listItRequests(auth, {
    ...query,
    page: 1,
    limit: 5000,
  });

  const rows = items.map((item) => ({
    code: item.code,
    title: item.title,
    requestKind: KIND_LABELS_VI[item.requestKind] ?? item.requestKind,
    categoryName: item.categoryName,
    priority: PRIORITY_LABELS_VI[item.priority] ?? item.priority,
    status: STATUS_LABELS_VI[item.status] ?? item.status,
    requesterName: item.requesterName,
    branchName: item.branchName ?? '',
    departmentName: item.departmentName ?? '',
    assetInfo: item.assetCode ? `${item.assetCode} - ${item.assetName ?? ''}` : '',
    assignedToName: item.assignedToName ?? 'Chưa phân công',
    slaStatus: SLA_LABELS_VI[item.sla.resolutionStatus] ?? item.sla.resolutionStatus,
    slaResolutionDueAt: item.sla.resolutionDueAt ? formatDateTimeVN(item.sla.resolutionDueAt) : '',
    estimatedCost: item.estimatedCost,
    satisfactionRating: item.satisfactionRating ? `${item.satisfactionRating}/5` : '',
    createdAt: formatDateTimeVN(item.createdAt),
    resolvedAt: item.resolvedAt ? formatDateTimeVN(item.resolvedAt) : '',
  }));

  return buildExcelBuffer(
    rows,
    [
      { header: 'Mã Ticket', key: 'code', width: 18 },
      { header: 'Tiêu đề yêu cầu', key: 'title', width: 42 },
      { header: 'Loại', key: 'requestKind', width: 22 },
      { header: 'Danh mục IT', key: 'categoryName', width: 28 },
      { header: 'Ưu tiên', key: 'priority', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 20 },
      { header: 'Người gửi', key: 'requesterName', width: 24 },
      { header: 'Chi nhánh', key: 'branchName', width: 20 },
      { header: 'Phòng ban', key: 'departmentName', width: 22 },
      { header: 'Tài sản liên quan', key: 'assetInfo', width: 26 },
      { header: 'Kỹ thuật viên', key: 'assignedToName', width: 24 },
      { header: 'Trạng thái SLA', key: 'slaStatus', width: 18 },
      { header: 'Hạn SLA xử lý', key: 'slaResolutionDueAt', width: 20 },
      {
        header: 'Chi phí dự kiến (VNĐ)',
        key: 'estimatedCost',
        width: 22,
        numFmt: '#,##0',
        align: 'right',
      },
      { header: 'Đánh giá CSAT', key: 'satisfactionRating', width: 15, align: 'center' },
      { header: 'Ngày tạo', key: 'createdAt', width: 20 },
      { header: 'Ngày xử lý xong', key: 'resolvedAt', width: 20 },
    ],
    {
      sheetName: 'YeuCauIT',
      title: 'DANH SÁCH YÊU CẦU HỖ TRỢ IT (IT HELPDESK)',
      subtitle: `Xuất dữ liệu lúc ${formatDateTimeVN(new Date())} • Tổng cộng ${rows.length} ticket`,
      freezeHeader: true,
      autoFilter: true,
    },
  );
}

export async function exportItRequestPdfBuffer(
  auth: AuthContext,
  ticketId: number,
): Promise<{ buffer: Buffer; fileName: string }> {
  const detail = await getItRequestDetail(auth, ticketId);

  // Bảng 1: Thông tin yêu cầu & Thiết bị (Cột 3 LUÔN là Ghi chú)
  const infoRows: PdfSectionRow[] = [
    { label: 'Tiêu đề yêu cầu', value: detail.title, note: detail.code },
    {
      label: 'Danh mục & Loại',
      value: `${detail.categoryName} (${KIND_LABELS_VI[detail.requestKind] ?? detail.requestKind})`,
      note: detail.requiresApproval ? 'Có quy trình phê duyệt' : 'Gửi thẳng IT Helpdesk',
    },
    {
      label: 'Mô tả chi tiết',
      value: detail.description,
      note: detail.locationDetail ? `Vị trí: ${detail.locationDetail}` : '',
    },
  ];

  if (detail.assetCode) {
    infoRows.push({
      label: 'Thiết bị / Tài sản liên quan',
      value: `${detail.assetCode} — ${detail.assetName ?? ''}`,
      note: detail.assetSerialNumber ? `Serial: ${detail.assetSerialNumber}` : (detail.assetCategory ?? ''),
    });
  }

  if (detail.estimatedCost > 0) {
    infoRows.push({
      label: 'Chi phí dự kiến',
      value: formatVND(detail.estimatedCost),
      note: 'Bản quyền / Thiết bị',
    });
  }

  if (detail.resolutionSummary) {
    infoRows.push({
      label: 'Tóm tắt kết quả xử lý',
      value: detail.resolutionSummary,
      note: detail.resolvedAt ? `Xong lúc ${formatDateTimeVN(detail.resolvedAt)}` : '',
    });
  }

  // Bảng 2: Cam kết SLA & Checklist kỹ thuật (Cột 3 LUÔN là Ghi chú)
  const slaChecklistRows: PdfSectionRow[] = [
    {
      label: 'SLA Phản hồi đầu tiên',
      value: detail.sla.responseDueAt ? formatDateTimeVN(detail.sla.responseDueAt) : 'Chưa kích hoạt',
      note: detail.sla.firstRespondedAt
        ? `Phản hồi lúc ${formatDateTimeVN(detail.sla.firstRespondedAt)} (${SLA_LABELS_VI[detail.sla.responseStatus] ?? detail.sla.responseStatus})`
        : (SLA_LABELS_VI[detail.sla.responseStatus] ?? detail.sla.responseStatus),
    },
    {
      label: 'SLA Xử lý hoàn tất',
      value: detail.sla.resolutionDueAt ? formatDateTimeVN(detail.sla.resolutionDueAt) : 'Chưa kích hoạt',
      note:
        detail.sla.pausedMinutes > 0
          ? `${SLA_LABELS_VI[detail.sla.resolutionStatus] ?? detail.sla.resolutionStatus} • Tạm dừng ${detail.sla.pausedMinutes} phút`
          : (SLA_LABELS_VI[detail.sla.resolutionStatus] ?? detail.sla.resolutionStatus),
    },
  ];

  for (let i = 0; i < detail.checklist.length; i += 1) {
    const ck = detail.checklist[i];
    slaChecklistRows.push({
      label: `Bước ${i + 1}: ${ck.title}`,
      value: ck.isDone ? 'Đã hoàn thành' : 'Chưa hoàn thành',
      note: ck.isDone && ck.doneByName
        ? `${ck.doneByName}${ck.doneAt ? ` • ${formatDateTimeVN(ck.doneAt)}` : ''}`
        : (ck.note ?? ''),
    });
  }

  const sections: PdfTableSection[] = [
    {
      title: '1. Thông tin Yêu cầu Hỗ trợ IT & Thiết bị liên quan',
      labelHeader: 'Hạng mục',
      valueHeader: 'Nội dung chi tiết',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['25%', '50%', '25%'],
      rows: infoRows,
    },
    {
      title: '2. Cam kết SLA & Hạng mục Xử lý Kỹ thuật',
      labelHeader: 'Chỉ tiêu / Bước xử lý',
      valueHeader: 'Thời hạn / Trạng thái',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['36%', '30%', '34%'],
      rows: slaChecklistRows,
    },
  ];

  // Bảng 3: Lịch sử phê duyệt (nếu có) — Cột 3 LUÔN là Ghi chú
  if (detail.approval && detail.approval.histories.length > 0) {
    sections.push({
      title: '3. Lịch sử Phê duyệt (Core Approval Engine)',
      labelHeader: 'Bước & Hành động',
      valueHeader: 'Người thực hiện & Thời gian',
      noteHeader: 'Ghi chú',
      valueAlignment: 'left',
      columnWidths: ['28%', '37%', '35%'],
      rows: detail.approval.histories.map((h) => ({
        label: `Bước ${h.stepOrder} — ${APPROVAL_ACTION_LABELS_VI[h.action] ?? h.action}`,
        value: `${h.actorName ?? 'Hệ thống'} (${formatDateTimeVN(h.actedAt)})`,
        note: h.comment ?? '',
      })),
    });
  }

  const signatures = await buildItRequestSignatures(detail);

  const docDefinition = buildStructuredPdfDocument({
    title: 'PHIẾU YÊU CẦU & XỬ LÝ HỖ TRỢ IT',
    subtitle: `Mã ticket: ${detail.code} • Trạng thái: ${STATUS_LABELS_VI[detail.status] ?? detail.status}`,
    metadata: [
      { label: 'Người yêu cầu', value: detail.requesterName },
      {
        label: 'Đơn vị / Chi nhánh',
        value: [detail.departmentName, detail.branchName].filter(Boolean).join(' — ') || '-',
      },
      { label: 'Mức ưu tiên', value: PRIORITY_LABELS_VI[detail.priority] ?? detail.priority },
      { label: 'Kỹ thuật viên phụ trách', value: detail.assignedToName ?? 'Chưa phân công' },
      { label: 'Liên hệ / Vị trí', value: [detail.contactPhone, detail.locationDetail].filter(Boolean).join(' • ') || '-' },
      { label: 'Ngày tạo phiếu', value: formatDateTimeVN(detail.createdAt) },
    ],
    sections,
    signatureSectionTitle: 'XÁC NHẬN PHÊ DUYỆT, XỬ LÝ KỸ THUẬT & NGHIỆM THU',
    signatureHeader: `${detail.branchName ?? 'Operon Hub'}, ${formatVietnameseDateStamp(
      detail.closedAt ?? detail.resolvedAt ?? detail.submittedAt ?? detail.createdAt,
    )}`,
    signatures,
    footnote: `Tài liệu được khởi tạo từ phân hệ IT Helpdesk (Operon Hub) lúc ${formatDateTimeVN(new Date())}.`,
  });

  const buffer = await generatePdfBuffer(docDefinition);
  return {
    buffer,
    fileName: `${detail.code}.pdf`,
  };
}
