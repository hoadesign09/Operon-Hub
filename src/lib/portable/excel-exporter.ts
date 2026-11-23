/**
 * Xuất mảng dữ liệu bất kỳ ra file Excel (.xlsx) chuẩn Unicode tiếng Việt, auto-width và header định dạng sẵn.
 *
 * Dependencies: exceljs (MIT)
 * Input:
 *   - rows: readonly T[] — Mảng dữ liệu cần xuất
 *   - columns: readonly ExcelColumn<T>[] — Định nghĩa cột (header, key, width, numFmt, align, value)
 *   - options: ExcelExportOptions — Cấu hình tên sheet, tiêu đề, màu header, freezeHeader, autoFilter
 * Output: Promise<Buffer> — Nội dung nhị phân .xlsx sẵn sàng gửi qua HTTP Response hoặc ghi ra file
 *
 * Ví dụ:
 * ```ts
 * const buffer = await buildExcelBuffer(
 *   [{ code: 'NV001', fullName: 'Nguyễn Văn A', salary: 15000000 }],
 *   [
 *     { header: 'Mã NV', key: 'code', width: 14 },
 *     { header: 'Họ và tên', key: 'fullName' },
 *     { header: 'Lương cơ bản', key: 'salary', numFmt: '#,##0', align: 'right' },
 *   ],
 *   { sheetName: 'NhanVien', title: 'DANH SÁCH NHÂN VIÊN' },
 * );
 * ```
 */
import ExcelJS from 'exceljs';

export type ExcelCellValue = string | number | boolean | Date | null | undefined;

export interface ExcelColumn<T> {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
  value?: (row: T, index: number) => ExcelCellValue;
}

export interface ExcelExportOptions {
  sheetName: string;
  title?: string;
  subtitle?: string;
  headerBgArgb?: string;
  headerTextArgb?: string;
  freezeHeader?: boolean;
  autoFilter?: boolean;
}

const DEFAULT_HEADER_BG = 'FF1E3A8A';
const DEFAULT_HEADER_TEXT = 'FFFFFFFF';
const ZEBRA_ROW_BG = 'FFF8FAFC';
const BORDER_COLOR = 'FFD1D5DB';
const MIN_COLUMN_WIDTH = 12;
const MAX_COLUMN_WIDTH = 45;
const INVALID_SHEET_CHARS_REGEX = /[\\/*?:[\]]/g;

function sanitizeSheetName(rawName: string): string {
  const cleaned = rawName.replace(INVALID_SHEET_CHARS_REGEX, ' ').trim();
  if (cleaned.length === 0) {
    throw new Error('Tên sheet Excel không được để trống.');
  }
  return cleaned.slice(0, 31);
}

function resolveCellValue<T>(
  row: T,
  col: ExcelColumn<T>,
  index: number,
): ExcelCellValue {
  if (col.value) {
    return col.value(row, index);
  }
  if (row && typeof row === 'object') {
    const record = row as Record<string, unknown>;
    const raw = record[col.key];
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean' ||
      raw instanceof Date ||
      raw === null ||
      raw === undefined
    ) {
      return raw;
    }
    return String(raw);
  }
  return '';
}

function formatCellLength(value: ExcelCellValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (value instanceof Date) {
    return 12;
  }
  return String(value).length;
}

function getColumnLetter(colNumber: number): string {
  let num = colNumber;
  let letter = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}

export async function buildExcelBuffer<T>(
  rows: readonly T[],
  columns: readonly ExcelColumn<T>[],
  options: ExcelExportOptions,
): Promise<Buffer> {
  if (columns.length === 0) {
    throw new Error('Danh sách cột xuất Excel không được rỗng.');
  }

  const safeSheetName = sanitizeSheetName(options.sheetName);
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(safeSheetName);
  const lastColLetter = getColumnLetter(columns.length);
  let currentRowIndex = 1;

  if (options.title && options.title.trim().length > 0) {
    worksheet.mergeCells(`A${currentRowIndex}:${lastColLetter}${currentRowIndex}`);
    const titleCell = worksheet.getCell(`A${currentRowIndex}`);
    titleCell.value = options.title.trim();
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(currentRowIndex).height = 26;
    currentRowIndex += 1;
  }

  if (options.subtitle && options.subtitle.trim().length > 0) {
    worksheet.mergeCells(`A${currentRowIndex}:${lastColLetter}${currentRowIndex}`);
    const subtitleCell = worksheet.getCell(`A${currentRowIndex}`);
    subtitleCell.value = options.subtitle.trim();
    subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(currentRowIndex).height = 20;
    currentRowIndex += 1;
  }

  if (currentRowIndex > 1) {
    currentRowIndex += 1;
  }

  const headerRowNumber = currentRowIndex;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.height = 24;

  const headerBg = options.headerBgArgb ?? DEFAULT_HEADER_BG;
  const headerText = options.headerTextArgb ?? DEFAULT_HEADER_TEXT;
  const maxLengths = columns.map((col) => col.header.length);

  columns.forEach((col, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = col.header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerBg },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align ?? 'left',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });

  rows.forEach((rowItem, rowIdx) => {
    const excelRow = worksheet.getRow(headerRowNumber + 1 + rowIdx);
    excelRow.height = 20;
    const isZebra = rowIdx % 2 === 1;

    columns.forEach((col, colIdx) => {
      const rawValue = resolveCellValue(rowItem, col, rowIdx);
      const cell = excelRow.getCell(colIdx + 1);
      cell.value = rawValue ?? '';
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align ?? 'left',
      };
      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }
      if (isZebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ZEBRA_ROW_BG },
        };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };

      const cellLen = formatCellLength(rawValue);
      if (cellLen > maxLengths[colIdx]) {
        maxLengths[colIdx] = cellLen;
      }
    });
  });

  columns.forEach((col, colIdx) => {
    const computedWidth = Math.min(
      MAX_COLUMN_WIDTH,
      Math.max(MIN_COLUMN_WIDTH, maxLengths[colIdx] + 4),
    );
    worksheet.getColumn(colIdx + 1).width = col.width ?? computedWidth;
  });

  if (options.freezeHeader !== false) {
    worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  }

  if (options.autoFilter !== false && rows.length > 0) {
    worksheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: columns.length },
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
