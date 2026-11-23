import { describe, expect, it } from 'vitest';
import { buildExcelBuffer } from '@/lib/portable/excel-exporter';
import { parseExcelBuffer } from '@/lib/portable/excel-importer';

describe('portable/excel-importer', () => {
  it('tự động nhận diện dòng header (bỏ qua title/subtitle) và đọc dữ liệu tiếng Việt chuẩn xác', async () => {
    const buffer = await buildExcelBuffer(
      [
        { code: 'NV0001', date: '2026-11-23', checkIn: '08:05', note: 'Đi làm đúng giờ' },
        { code: 'NV0002', date: '2026-11-23', checkIn: '08:25', note: 'Kẹt xe Nguyễn Trãi' },
      ],
      [
        { header: 'Mã NV', key: 'code' },
        { header: 'Ngày công', key: 'date' },
        { header: 'Giờ vào', key: 'checkIn' },
        { header: 'Ghi chú', key: 'note' },
      ],
      {
        sheetName: 'ChamCong',
        title: 'MẪU IMPORT CHẤM CÔNG',
        subtitle: 'File kiểm thử tiếng Việt',
      },
    );

    const parsed = await parseExcelBuffer(buffer, {
      expectedHeaders: ['Mã NV', 'Ngày công'],
    });

    expect(parsed.sheetName).toBe('ChamCong');
    expect(parsed.headerRowNumber).toBe(4);
    expect(parsed.headers).toEqual(['Mã NV', 'Ngày công', 'Giờ vào', 'Ghi chú']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.values['Mã NV']).toBe('NV0001');
    expect(parsed.rows[1]?.values['Ghi chú']).toBe('Kẹt xe Nguyễn Trãi');
  });

  it('chặn file rỗng và chặn file vượt quá giới hạn maxRows', async () => {
    await expect(parseExcelBuffer(Buffer.alloc(0))).rejects.toThrow('rỗng');

    const buffer = await buildExcelBuffer(
      [
        { code: 'NV01' },
        { code: 'NV02' },
        { code: 'NV03' },
      ],
      [{ header: 'Mã NV', key: 'code' }],
      { sheetName: 'Data' },
    );

    await expect(
      parseExcelBuffer(buffer, { maxRows: 2 }),
    ).rejects.toThrow('vượt quá giới hạn');
  });
});
