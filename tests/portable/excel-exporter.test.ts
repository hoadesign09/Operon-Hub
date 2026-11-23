import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';

describe('portable/excel-exporter', () => {
  it('tạo file .xlsx hợp lệ với tiếng Việt Unicode, tiêu đề và định dạng cột', async () => {
    const buffer = await buildExcelBuffer(
      [
        { code: 'NV0001', fullName: 'Nguyễn Thị Minh Anh', salary: 18500000 },
        { code: 'NV0002', fullName: 'Trần Hoàng Nam', salary: 22000000 },
      ],
      [
        { header: 'Mã NV', key: 'code', width: 14 },
        { header: 'Họ và tên', key: 'fullName' },
        { header: 'Lương cơ bản', key: 'salary', numFmt: '#,##0', align: 'right' },
      ],
      {
        sheetName: 'NhanSu',
        title: 'DANH SÁCH NHÂN VIÊN',
        subtitle: 'Xuất thử nghiệm',
      },
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.getWorksheet('NhanSu');
    expect(sheet).toBeDefined();
    expect(sheet?.getCell('A1').value).toBe('DANH SÁCH NHÂN VIÊN');
    expect(sheet?.getCell('A2').value).toBe('Xuất thử nghiệm');
    expect(sheet?.getCell('A4').value).toBe('Mã NV');
    expect(sheet?.getCell('B5').value).toBe('Nguyễn Thị Minh Anh');
    expect(sheet?.getCell('C6').value).toBe(22000000);
  });

  it('xử lý an toàn mảng rỗng không ném lỗi', async () => {
    const buffer = await buildExcelBuffer(
      [],
      [{ header: 'Mã NV', key: 'code' }],
      { sheetName: 'EmptySheet' },
    );
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('ném lỗi khi thiếu cột hoặc tên sheet rỗng', async () => {
    await expect(
      buildExcelBuffer([], [], { sheetName: 'Valid' }),
    ).rejects.toThrow('rỗng');

    await expect(
      buildExcelBuffer([], [{ header: 'A', key: 'a' }], { sheetName: '///???' }),
    ).rejects.toThrow('trống');
  });
});
