import fs from 'node:fs';
import path from 'node:path';
import type { ContentTable, TableCell } from 'pdfmake/interfaces';
import { describe, expect, it } from 'vitest';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
} from '@/lib/portable/pdf-generator';

function extractSectionTables(content: unknown): ContentTable[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.filter((node): node is ContentTable => {
    if (!node || typeof node !== 'object' || !('table' in node)) {
      return false;
    }
    const tbl = (node as ContentTable).table;
    return Boolean(tbl && tbl.headerRows === 1 && Array.isArray(tbl.body));
  });
}

function readCellText(cell: TableCell): string {
  if (typeof cell === 'string') {
    return cell;
  }
  if (cell && typeof cell === 'object' && 'text' in cell && typeof cell.text === 'string') {
    return cell.text;
  }
  return '';
}

describe('portable/pdf-generator', () => {
  it('luôn đặt cột Ghi chú ở vị trí cuối cùng (cột 3/3) trên mọi bảng tài liệu PDF', async () => {
    const doc = buildStructuredPdfDocument({
      companyName: 'Công ty Cổ phần Operon Hub',
      companyMeta: 'Chi nhánh Trụ sở chính • MST: 0109999999',
      title: 'PHIẾU LƯƠNG THÁNG 11/2026',
      subtitle: 'Bảng lương chính thức tháng 11/2026',
      pageSize: 'A4',
      metadata: [
        { label: 'Mã nhân viên', value: 'NV0002' },
        { label: 'Họ và tên', value: 'Nguyễn Thị Minh Anh' },
        { label: 'Phòng ban', value: 'Phòng Hành chính Nhân sự' },
        { label: 'Chức danh', value: 'Trưởng phòng / Trưởng bộ phận' },
      ],
      sections: [
        {
          title: 'I. CÁC KHOẢN THU NHẬP',
          rows: [
            { label: 'Lương theo ngày công (22/22 ngày)', value: '26.000.000 ₫', note: 'Theo bảng công' },
            { label: 'Phụ cấp ăn trưa', note: 'Phụ cấp hợp đồng', value: '1.000.000 ₫' },
          ],
          totalLabel: 'TỔNG THU NHẬP (GROSS)',
          totalValue: '27.000.000 ₫',
          totalNote: 'Đã bao gồm phụ cấp',
        },
        {
          title: 'II. CÁC KHOẢN KHẤU TRỪ',
          valueHeader: 'Số tiền khấu trừ',
          noteHeader: 'Ghi chú chi tiết',
          rows: [
            { label: 'BHXH + BHYT + BHTN (10.5%)', value: '2.310.000 ₫', note: 'Theo mức đóng BH' },
            { label: 'Thuế TNCN', value: '1.278.500 ₫', note: 'Biểu lũy tiến' },
          ],
          totalLabel: 'TỔNG KHẤU TRỪ',
          totalValue: '3.588.500 ₫',
        },
      ],
      highlight: {
        label: 'LƯƠNG THỰC LĨNH (NET)',
        value: '23.411.500 ₫',
        subtext: 'Chuyển khoản ngân hàng Vietcombank',
      },
      footnote: 'Thông tin thu nhập được bảo mật tuyệt đối.',
      signatures: [
        { title: 'NGƯỜI LẬP BIỂU' },
        { title: 'NGƯỜI LAO ĐỘNG', name: 'Nguyễn Thị Minh Anh' },
      ],
    });

    const tables = extractSectionTables(doc.content);
    expect(tables).toHaveLength(2);

    // Bảng 1: Header cột cuối cùng phải là "Ghi chú", dữ liệu & dòng tổng phải khớp vị trí cột cuối
    const firstTableBody = tables[0].table.body;
    expect(readCellText(firstTableBody[0][0])).toBe('Khoản mục');
    expect(readCellText(firstTableBody[0][1])).toBe('Số tiền (VNĐ)');
    expect(readCellText(firstTableBody[0][2])).toBe('Ghi chú');
    expect(readCellText(firstTableBody[1][1])).toBe('26.000.000 ₫');
    expect(readCellText(firstTableBody[1][2])).toBe('Theo bảng công');
    expect(readCellText(firstTableBody[2][1])).toBe('1.000.000 ₫');
    expect(readCellText(firstTableBody[2][2])).toBe('Phụ cấp hợp đồng');
    expect(readCellText(firstTableBody[3][0])).toBe('TỔNG THU NHẬP (GROSS)');
    expect(readCellText(firstTableBody[3][1])).toBe('27.000.000 ₫');
    expect(readCellText(firstTableBody[3][2])).toBe('Đã bao gồm phụ cấp');

    // Bảng 2: Custom noteHeader vẫn luôn nằm ở cột cuối cùng (index 2)
    const secondTableBody = tables[1].table.body;
    expect(readCellText(secondTableBody[0][2])).toBe('Ghi chú chi tiết');
    expect(readCellText(secondTableBody[1][2])).toBe('Theo mức đóng BH');

    const buffer = await generatePdfBuffer(doc);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('dựng khối chân chữ ký chi tiết dạng thẻ chống cắt trang (unbreakable) cho quy trình đa cấp', async () => {
    const doc = buildStructuredPdfDocument({
      companyName: 'OPERON HUB',
      title: 'TỜ TRÌNH ĐỀ XUẤT NỘI BỘ',
      subtitle: 'Mã hồ sơ: PROP-202611-0001',
      sections: [
        {
          title: '1. Nội dung',
          valueHeader: 'Chi tiết',
          valueAlignment: 'left',
          rows: [{ label: 'Tiêu đề', value: 'Mua sắm thiết bị họp trực tuyến', note: 'Ưu tiên: Cao' }],
        },
      ],
      signatureSectionTitle: 'XÁC NHẬN & PHÊ DUYỆT TỜ TRÌNH',
      signatureHeader: 'Trụ sở chính, ngày 26 tháng 11 năm 2026',
      signatures: [
        {
          stepLabel: 'BƯỚC 0 • LẬP TỜ TRÌNH',
          title: 'NGƯỜI ĐỀ XUẤT',
          roleTitle: 'Chuyên viên IT • Phòng Kỹ thuật',
          name: 'Nguyễn Minh Quân',
          code: 'Mã NV: NV0008',
          statusText: 'ĐÃ LẬP & TRÌNH DUYỆT',
          statusTone: 'approved',
          signedAt: '25/11/2026 09:15',
        },
        {
          stepLabel: 'DUYỆT CẤP 1/3',
          title: 'QUẢN LÝ TRỰC TIẾP',
          roleTitle: 'Trưởng phòng Kỹ thuật',
          name: 'Trần Quốc Bảo',
          code: 'Mã NV: NV0003',
          statusText: 'ĐÃ PHÊ DUYỆT',
          statusTone: 'approved',
          signedAt: '25/11/2026 10:30',
          note: 'Đồng ý đề xuất, cần triển khai trong tuần này.',
        },
        {
          stepLabel: 'DUYỆT CẤP 2/3',
          title: 'HÀNH CHÍNH VĂN PHÒNG',
          roleTitle: 'Theo phân quyền hệ thống',
          statusText: 'ĐANG CHỜ PHÊ DUYỆT',
          statusTone: 'pending',
        },
        {
          stepLabel: 'DUYỆT CẤP 3/3',
          title: 'BAN GIÁM ĐỐC',
          roleTitle: 'Phê duyệt cuối',
          subtitle: '(Ký duyệt, ghi rõ họ tên & đóng dấu)',
          statusText: 'CHỜ ĐẾN LƯỢT',
          statusTone: 'draft',
        },
      ],
    });

    const contentList = Array.isArray(doc.content) ? doc.content : [];
    const signatureNode = contentList[contentList.length - 1] as unknown as Record<string, unknown>;
    expect(signatureNode.unbreakable).toBe(true);

    const buffer = await generatePdfBuffer(doc);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2500);
  });

  it('hỗ trợ khổ giấy A5 và không phụ thuộc ngược nghiệp vụ dự án (Zero Business Coupling)', async () => {
    const doc = buildStructuredPdfDocument({
      title: 'BIÊN BẢN XÁC NHẬN NHANH',
      pageSize: 'A5',
      sections: [
        {
          title: 'Chi tiết',
          rows: [{ label: 'Mục kiểm tra', value: 'Đạt chuẩn Unicode', note: 'Kiểm tra A5' }],
        },
      ],
    });

    const buffer = await generatePdfBuffer(doc);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/lib/portable/pdf-generator.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/@\/(config|modules|shared|layouts|components)/);
  });
});
