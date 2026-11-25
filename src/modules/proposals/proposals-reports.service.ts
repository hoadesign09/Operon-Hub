import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateTimeVN, formatDateVN } from '@/lib/portable/date-utils';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
  type PdfSectionRow,
  type PdfTableSection,
} from '@/lib/portable/pdf-generator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  getProposalDetail,
  listProposals,
  type ListProposalsQuery,
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

  const overviewRows: PdfSectionRow[] = [
    { label: 'Tiêu đề đề xuất', value: detail.title, isBold: true },
    { label: 'Tóm tắt ngắn', value: detail.summary ?? 'Không có' },
    { label: 'Nội dung & Lý do chi tiết', value: detail.content },
    ...(detail.expectedOutcome
      ? [{ label: 'Kết quả & Hiệu quả kỳ vọng', value: detail.expectedOutcome }]
      : []),
    ...(detail.executionNotes
      ? [{ label: 'Ghi chú thực thi / Nghiệm thu', value: detail.executionNotes }]
      : []),
  ];

  const sections: PdfTableSection[] = [
    {
      title: '1. Nội dung Tờ trình Đề xuất',
      valueHeader: 'Chi tiết',
      rows: overviewRows,
    },
  ];

  if (detail.items.length > 0) {
    sections.push({
      title: '2. Bảng Dự toán Chi tiết Hạng mục',
      valueHeader: 'Thành tiền (VNĐ)',
      rows: detail.items.map((item) => ({
        label: `${item.lineNo}. ${item.itemName}`,
        note: `${item.quantity} ${item.unit} × ${formatVND(item.unitPrice)}${item.specification ? ` • ${item.specification}` : ''}`,
        value: formatVND(item.lineTotal),
      })),
      totalLabel: 'Tổng ngân sách dự kiến',
      totalValue: formatVND(detail.estimatedBudget),
    });
  }

  if (detail.approval && detail.approval.histories.length > 0) {
    sections.push({
      title: detail.items.length > 0 ? '3. Lịch sử Phê duyệt Đa cấp' : '2. Lịch sử Phê duyệt Đa cấp',
      valueHeader: 'Thời điểm',
      rows: detail.approval.histories.map((h) => ({
        label: `Bước ${h.stepOrder} — ${h.actorName ?? 'Hệ thống'} (${ACTION_LABELS_VI[h.action] ?? h.action})`,
        note: h.comment ?? '',
        value: formatDateTimeVN(h.actedAt),
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
      'Tài liệu được xuất tự động từ hệ thống Operon Hub (Module Đề xuất Nội bộ) và đồng bộ lịch sử với Core Approval Engine.',
    signatures: [
      { title: 'NGƯỜI ĐỀ XUẤT', name: detail.requesterName },
      { title: 'TRƯỞNG BỘ PHẬN', subtitle: '(Ký, ghi rõ họ tên)' },
      { title: 'PHÊ DUYỆT CUỐI', subtitle: '(Ký, đóng dấu)' },
    ],
  });

  const buffer = await generatePdfBuffer(doc);
  return {
    filename: `${detail.proposalCode}.pdf`,
    buffer,
  };
}
