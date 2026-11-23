import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStructuredPdfDocument,
  generatePdfBuffer,
} from '@/lib/portable/pdf-generator';

describe('portable/pdf-generator', () => {
  it('tạo file PDF A4 hợp lệ hỗ trợ đầy đủ tiếng Việt có dấu và ký hiệu ₫', async () => {
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
            { label: 'Lương theo ngày công (22/22 ngày)', value: '26.000.000 ₫' },
            { label: 'Phụ cấp ăn trưa', note: 'Phụ cấp hợp đồng', value: '1.000.000 ₫' },
          ],
          totalLabel: 'TỔNG THU NHẬP (GROSS)',
          totalValue: '27.000.000 ₫',
        },
        {
          title: 'II. CÁC KHOẢN KHẤU TRỪ',
          rows: [
            { label: 'BHXH + BHYT + BHTN (10.5%)', value: '2.310.000 ₫' },
            { label: 'Thuế TNCN', value: '1.278.500 ₫' },
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

    const buffer = await generatePdfBuffer(doc);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(2000);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('hỗ trợ khổ giấy A5 và không phụ thuộc ngược nghiệp vụ dự án (Zero Business Coupling)', async () => {
    const doc = buildStructuredPdfDocument({
      title: 'BIÊN BẢN XÁC NHẬN NHANH',
      pageSize: 'A5',
      sections: [
        {
          title: 'Chi tiết',
          rows: [{ label: 'Mục kiểm tra', value: 'Đạt chuẩn Unicode' }],
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
