import { formatVND } from '@/lib/portable/currency-utils';
import { formatDateVN } from '@/lib/portable/date-utils';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
} from '@/lib/portable/pdf-generator';
import type { AuthContext } from '@/modules/auth/auth.service';
import {
  ASSET_CATEGORY_LABELS,
  getAssetAssignmentForPdf,
} from '@/modules/hrm/office/assets.service';

export async function generateAssetHandoverPdf(
  assignmentId: number,
  auth: AuthContext,
): Promise<{ buffer: Buffer; fileName: string }> {
  const record = await getAssetAssignmentForPdf(assignmentId, auth);
  const isReturned = record.status === 'RETURNED';

  const docDef = buildStructuredPdfDocument({
    companyName: 'OPERON HUB — BỘ PHẬN HÀNH CHÍNH VĂN PHÒNG',
    companyMeta: `Chi nhánh: ${record.branchName} | Số biên bản: BBTS-${String(record.id).padStart(5, '0')}`,
    title: isReturned
      ? 'BIÊN BẢN BÀN GIAO & THU HỒI TÀI SẢN'
      : 'BIÊN BẢN BÀN GIAO CẤP PHÁT TÀI SẢN',
    subtitle: `Mã tài sản: ${record.assetCode} — Trạng thái: ${isReturned ? 'Đã hoàn tất thu hồi' : 'Đang sử dụng'}`,
    pageSize: 'A4',
    pageOrientation: 'portrait',
    metadata: [
      { label: 'Mã nhân viên', value: record.employeeCode },
      { label: 'Họ và tên người nhận', value: record.employeeName },
      { label: 'Phòng ban', value: record.departmentName },
      { label: 'Chức danh', value: record.positionName },
      { label: 'Người bàn giao (HC)', value: record.assignedByName ?? 'Bộ phận Hành chính' },
      { label: 'Thời điểm bàn giao', value: record.assignedAt },
      ...(record.expectedReturnAt
        ? [{ label: 'Ngày dự kiến trả', value: formatDateVN(record.expectedReturnAt) }]
        : []),
      ...(isReturned && record.returnedAt
        ? [{ label: 'Thời điểm thu hồi', value: record.returnedAt }]
        : []),
    ],
    sections: [
      {
        title: 'I. THÔNG TIN THIẾT BỊ / TÀI SẢN BÀN GIAO',
        valueHeader: 'Thông số / Giá trị',
        rows: [
          { label: 'Mã tài sản', value: record.assetCode, isBold: true },
          { label: 'Tên thiết bị', value: record.assetName, isBold: true },
          { label: 'Phân loại', value: ASSET_CATEGORY_LABELS[record.assetCategory] },
          {
            label: 'Hãng / Model',
            value: [record.brand, record.model].filter(Boolean).join(' — ') || 'Chưa cập nhật',
          },
          { label: 'Số Serial / IMEI', value: record.serialNumber ?? 'Không có' },
          { label: 'Nguyên giá tham chiếu', value: formatVND(record.purchaseValue) },
        ],
      },
      {
        title: 'II. TÌNH TRẠNG THIẾT BỊ & XÁC NHẬN',
        valueHeader: 'Nội dung ghi nhận',
        rows: [
          {
            label: 'Tình trạng lúc bàn giao',
            value: record.conditionOnAssign,
            note: `Ngày giao: ${record.assignedAt}`,
          },
          ...(isReturned
            ? [
                {
                  label: 'Tình trạng lúc thu hồi',
                  value: record.conditionOnReturn ?? 'Đã kiểm tra nguyên vẹn',
                  note: record.returnedByName
                    ? `Người nhận lại: ${record.returnedByName}`
                    : undefined,
                },
              ]
            : []),
          ...(record.note
            ? [{ label: 'Ghi chú bổ sung', value: record.note }]
            : []),
        ],
      },
    ],
    footnote:
      'Người nhận tài sản cam kết bảo quản, sử dụng thiết bị đúng mục đích công việc và bàn giao lại đầy đủ khi có yêu cầu hoặc khi kết thúc hợp đồng lao động.',
    signatures: [
      {
        title: 'ĐẠI DIỆN HÀNH CHÍNH (BÊN GIAO)',
        name: record.assignedByName ?? undefined,
      },
      {
        title: 'NHÂN VIÊN TIẾP NHẬN (BÊN NHẬN)',
        name: record.employeeName,
      },
    ],
  });

  const buffer = await generatePdfBuffer(docDef);
  const safeCode = record.assetCode.replace(/[^A-Za-z0-9_-]/g, '_');
  return {
    buffer,
    fileName: `bien-ban-tai-san-${safeCode}-${record.id}.pdf`,
  };
}
