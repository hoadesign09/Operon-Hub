/**
 * Đọc và chuẩn hóa dữ liệu từ file Excel (.xlsx) sang mảng đối tượng an toàn, hỗ trợ tự dò dòng tiêu đề.
 *
 * Dependencies: `exceljs` (MIT)
 *
 * Input:
 *   - input: Buffer | ArrayBuffer | Uint8Array — Nội dung nhị phân của file `.xlsx`
 *   - options?: ExcelImportOptions — Cấu hình tên/chỉ số sheet, dòng tiêu đề, danh sách cột kỳ vọng và giới hạn dòng
 * Output: Promise<ExcelImportResult> — `{ sheetName, headerRowNumber, headers, rows }`
 *
 * Ví dụ:
 * ```ts
 * const result = await parseExcelBuffer(fileBuffer, {
 *   expectedHeaders: ['Mã NV', 'Ngày công'],
 *   maxRows: 2000,
 * });
 * console.log(result.rows[0]?.values);
 * ```
 */
import ExcelJS from 'exceljs';

export type ExcelPrimitiveValue = string | number | boolean | Date | null;

export interface ExcelImportRow {
  rowNumber: number;
  values: Record<string, ExcelPrimitiveValue>;
}

export interface ExcelImportResult {
  sheetName: string;
  headerRowNumber: number;
  headers: string[];
  rows: ExcelImportRow[];
}

export interface ExcelImportOptions {
  sheetName?: string;
  sheetIndex?: number;
  headerRowNumber?: number;
  expectedHeaders?: readonly string[];
  maxRows?: number;
  maxHeaderScanRows?: number;
}

const DEFAULT_MAX_ROWS = 5000;
const DEFAULT_MAX_HEADER_SCAN_ROWS = 10;

function normalizeHeaderText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function unwrapCellValue(raw: ExcelJS.CellValue): ExcelPrimitiveValue {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (raw instanceof Date) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return raw;
  }
  if (typeof raw === 'object') {
    if ('richText' in raw && Array.isArray(raw.richText)) {
      const joined = raw.richText.map((part) => part.text ?? '').join('').trim();
      return joined.length > 0 ? joined : null;
    }
    if ('result' in raw) {
      return unwrapCellValue(raw.result as ExcelJS.CellValue);
    }
    if ('text' in raw && typeof raw.text === 'string') {
      const trimmed = raw.text.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if ('error' in raw) {
      return null;
    }
  }
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

function extractRowStrings(row: ExcelJS.Row, colCount: number): string[] {
  const result: string[] = [];
  for (let col = 1; col <= colCount; col += 1) {
    const val = unwrapCellValue(row.getCell(col).value);
    result.push(val === null ? '' : String(val).trim());
  }
  return result;
}

function detectHeaderRow(
  worksheet: ExcelJS.Worksheet,
  options: ExcelImportOptions,
): number {
  if (options.headerRowNumber && options.headerRowNumber >= 1) {
    return Math.floor(options.headerRowNumber);
  }

  const scanLimit = Math.min(
    worksheet.rowCount,
    Math.max(1, options.maxHeaderScanRows ?? DEFAULT_MAX_HEADER_SCAN_ROWS),
  );
  const expectedSet = new Set(
    (options.expectedHeaders ?? []).map((item) => normalizeHeaderText(item)),
  );

  if (expectedSet.size > 0) {
    let bestRow = 1;
    let bestMatches = 0;
    for (let r = 1; r <= scanLimit; r += 1) {
      const row = worksheet.getRow(r);
      const colCount = Math.max(worksheet.columnCount, row.cellCount);
      const cells = extractRowStrings(row, colCount).map(normalizeHeaderText);
      const matchCount = cells.filter((cell) => cell.length > 0 && expectedSet.has(cell)).length;
      if (matchCount > bestMatches) {
        bestMatches = matchCount;
        bestRow = r;
      }
    }
    if (bestMatches > 0) {
      return bestRow;
    }
  }

  for (let r = 1; r <= scanLimit; r += 1) {
    const row = worksheet.getRow(r);
    const colCount = Math.max(worksheet.columnCount, row.cellCount);
    const nonEmptyCount = extractRowStrings(row, colCount).filter((c) => c.length > 0).length;
    if (nonEmptyCount > 0) {
      return r;
    }
  }

  return 1;
}

function toNodeBuffer(input: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

export async function parseExcelBuffer(
  input: Buffer | ArrayBuffer | Uint8Array,
  options: ExcelImportOptions = {},
): Promise<ExcelImportResult> {
  const buffer = toNodeBuffer(input);
  if (buffer.byteLength === 0) {
    throw new Error('Nội dung file Excel rỗng.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  let worksheet: ExcelJS.Worksheet | undefined;
  if (options.sheetName) {
    worksheet = workbook.getWorksheet(options.sheetName);
  } else {
    const index = options.sheetIndex ?? 0;
    worksheet = workbook.worksheets[index];
  }

  if (!worksheet) {
    throw new Error('Không tìm thấy sheet dữ liệu hợp lệ trong file Excel.');
  }

  if (worksheet.rowCount === 0) {
    return {
      sheetName: worksheet.name,
      headerRowNumber: 1,
      headers: [],
      rows: [],
    };
  }

  const headerRowNumber = detectHeaderRow(worksheet, options);
  const headerRow = worksheet.getRow(headerRowNumber);
  const colCount = Math.max(worksheet.columnCount, headerRow.cellCount);
  const rawHeaders = extractRowStrings(headerRow, colCount);

  const columnMap: Array<{ colIndex: number; header: string }> = [];
  const usedHeaders = new Map<string, number>();
  for (let colIdx = 1; colIdx <= colCount; colIdx += 1) {
    const baseHeader = rawHeaders[colIdx - 1] ?? '';
    if (baseHeader.length === 0) {
      continue;
    }
    const seen = usedHeaders.get(baseHeader) ?? 0;
    usedHeaders.set(baseHeader, seen + 1);
    const uniqueHeader = seen === 0 ? baseHeader : `${baseHeader}_${seen + 1}`;
    columnMap.push({ colIndex: colIdx, header: uniqueHeader });
  }

  if (columnMap.length === 0) {
    throw new Error('Không tìm thấy dòng tiêu đề hợp lệ trong file Excel.');
  }

  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_MAX_ROWS);
  const rows: ExcelImportRow[] = [];

  for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const values: Record<string, ExcelPrimitiveValue> = {};
    let hasAnyValue = false;

    for (const col of columnMap) {
      const value = unwrapCellValue(row.getCell(col.colIndex).value);
      values[col.header] = value;
      if (value !== null) {
        hasAnyValue = true;
      }
    }

    if (!hasAnyValue) {
      continue;
    }

    if (rows.length >= maxRows) {
      throw new Error(`File Excel vượt quá giới hạn cho phép (${maxRows} dòng dữ liệu).`);
    }

    rows.push({ rowNumber: r, values });
  }

  return {
    sheetName: worksheet.name,
    headerRowNumber,
    headers: columnMap.map((c) => c.header),
    rows,
  };
}
