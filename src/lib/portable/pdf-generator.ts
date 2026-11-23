/**
 * Tiện ích sinh file PDF tiếng Việt chuẩn Unicode (font Roboto nhúng sẵn, khổ A4/A5) dùng pdfmake (MIT).
 * Không phụ thuộc cấu hình hay nghiệp vụ dự án (Zero Business Coupling).
 *
 * Dependencies: pdfmake (MIT)
 *
 * Input / Output:
 * - generatePdfBuffer(docDefinition: TDocumentDefinitions) => Promise<Buffer>
 * - buildStructuredPdfDocument(options: StructuredPdfOptions) => TDocumentDefinitions
 *
 * Ví dụ:
 * ```ts
 * const doc = buildStructuredPdfDocument({
 *   title: 'PHIẾU LƯƠNG THÁNG 11/2026',
 *   subtitle: 'Công ty TNHH Operon Hub',
 *   metadata: [{ label: 'Nhân viên', value: 'Nguyễn Văn A' }],
 *   sections: [{ title: 'Thu nhập', rows: [{ label: 'Lương cơ bản', value: '15.000.000 ₫' }] }],
 * });
 * const pdfBuffer = await generatePdfBuffer(doc);
 * ```
 */

import PdfPrinter from 'pdfmake';
import type {
  Content,
  PageOrientation,
  PageSize,
  TableCell,
  TDocumentDefinitions,
  TFontDictionary,
} from 'pdfmake/interfaces';
import vfsFontsModule from 'pdfmake/build/vfs_fonts';

export interface PdfMetadataField {
  label: string;
  value: string;
}

export interface PdfSectionRow {
  label: string;
  value: string;
  note?: string;
  isBold?: boolean;
}

export interface PdfTableSection {
  title: string;
  valueHeader?: string;
  rows: PdfSectionRow[];
  totalLabel?: string;
  totalValue?: string;
}

export interface PdfHighlightBox {
  label: string;
  value: string;
  subtext?: string;
}

export interface PdfSignatureSlot {
  title: string;
  subtitle?: string;
  name?: string;
}

export interface StructuredPdfOptions {
  companyName?: string;
  companyMeta?: string;
  title: string;
  subtitle?: string;
  pageSize?: PageSize;
  pageOrientation?: PageOrientation;
  metadata?: PdfMetadataField[];
  sections: PdfTableSection[];
  highlight?: PdfHighlightBox;
  footnote?: string;
  signatures?: PdfSignatureSlot[];
}

interface VfsFontMap {
  [filename: string]: string;
}

let cachedPrinter: PdfPrinter | null = null;

function extractVfsMap(): VfsFontMap {
  const raw = vfsFontsModule as unknown as Record<string, unknown>;
  if (raw.pdfMake && typeof raw.pdfMake === 'object') {
    const nested = (raw.pdfMake as Record<string, unknown>).vfs;
    if (nested && typeof nested === 'object') {
      return nested as VfsFontMap;
    }
  }
  if (raw.default && typeof raw.default === 'object') {
    return raw.default as VfsFontMap;
  }
  return raw as VfsFontMap;
}

function getRobotoPrinter(): PdfPrinter {
  if (cachedPrinter) {
    return cachedPrinter;
  }

  const vfs = extractVfsMap();
  const regular = vfs['Roboto-Regular.ttf'];
  const bold = vfs['Roboto-Medium.ttf'] ?? regular;
  const italics = vfs['Roboto-Italic.ttf'] ?? regular;
  const bolditalics = vfs['Roboto-MediumItalic.ttf'] ?? bold;

  if (!regular) {
    throw new Error('Không tìm thấy font Roboto-Regular.ttf trong gói pdfmake.');
  }

  const fonts: TFontDictionary = {
    Roboto: {
      normal: Buffer.from(regular, 'base64'),
      bold: Buffer.from(bold, 'base64'),
      italics: Buffer.from(italics, 'base64'),
      bolditalics: Buffer.from(bolditalics, 'base64'),
    },
  };

  cachedPrinter = new PdfPrinter(fonts);
  return cachedPrinter;
}

/**
 * Tạo PDF Buffer từ TDocumentDefinitions chuẩn pdfmake với font Roboto hỗ trợ tiếng Việt đầy đủ.
 */
export async function generatePdfBuffer(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  const printer = getRobotoPrinter();
  const normalizedDef: TDocumentDefinitions = {
    ...docDefinition,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.3,
      color: '#1e293b',
      ...(docDefinition.defaultStyle ?? {}),
    },
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(normalizedDef);
      const chunks: Buffer[] = [];

      pdfDoc.on('data', (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      pdfDoc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      pdfDoc.on('error', (err: Error) => {
        reject(err);
      });
      pdfDoc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function buildMetadataBlock(metadata: PdfMetadataField[]): Content {
  const rows: TableCell[][] = [];
  for (let i = 0; i < metadata.length; i += 2) {
    const left = metadata[i];
    const right = metadata[i + 1];
    rows.push([
      { text: `${left.label}:`, style: 'metaLabel', border: [false, false, false, false] },
      { text: left.value, style: 'metaValue', border: [false, false, false, false] },
      right
        ? { text: `${right.label}:`, style: 'metaLabel', border: [false, false, false, false] }
        : { text: '', border: [false, false, false, false] },
      right
        ? { text: right.value, style: 'metaValue', border: [false, false, false, false] }
        : { text: '', border: [false, false, false, false] },
    ]);
  }

  return {
    margin: [0, 0, 0, 12],
    fillColor: '#f8fafc',
    table: {
      widths: ['18%', '32%', '18%', '32%'],
      body: rows,
    },
    layout: {
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
  };
}

function buildSectionTable(section: PdfTableSection): Content[] {
  const body: TableCell[][] = [
    [
      { text: 'Khoản mục', style: 'tableHeader', fillColor: '#e2e8f0' },
      { text: 'Ghi chú', style: 'tableHeader', fillColor: '#e2e8f0' },
      {
        text: section.valueHeader ?? 'Số tiền (VNĐ)',
        style: 'tableHeader',
        alignment: 'right',
        fillColor: '#e2e8f0',
      },
    ],
  ];

  for (const row of section.rows) {
    body.push([
      { text: row.label, bold: Boolean(row.isBold), fontSize: 9.5 },
      { text: row.note ?? '', fontSize: 8.5, color: '#64748b' },
      {
        text: row.value,
        alignment: 'right',
        bold: Boolean(row.isBold),
        fontSize: 9.5,
      },
    ]);
  }

  if (section.totalLabel && section.totalValue) {
    body.push([
      {
        text: section.totalLabel,
        colSpan: 2,
        bold: true,
        fillColor: '#f1f5f9',
        fontSize: 10,
      },
      {},
      {
        text: section.totalValue,
        alignment: 'right',
        bold: true,
        fillColor: '#f1f5f9',
        fontSize: 10,
      },
    ]);
  }

  return [
    { text: section.title, style: 'sectionTitle', margin: [0, 8, 0, 4] },
    {
      margin: [0, 0, 0, 6],
      table: {
        headerRows: 1,
        widths: ['45%', '30%', '25%'],
        body,
      },
      layout: {
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#e2e8f0',
        paddingTop: () => 5,
        paddingBottom: () => 5,
        paddingLeft: () => 6,
        paddingRight: () => 6,
      },
    },
  ];
}

/**
 * Dựng khung tài liệu PDF có cấu trúc chuẩn A4/A5 tiếng Việt (tiêu đề, metadata, bảng chi tiết, hộp tổng kết, chữ ký).
 */
export function buildStructuredPdfDocument(
  options: StructuredPdfOptions,
): TDocumentDefinitions {
  const content: Content[] = [];

  if (options.companyName) {
    content.push({
      text: options.companyName.toUpperCase(),
      fontSize: 10,
      bold: true,
      color: '#1d4ed8',
    });
  }
  if (options.companyMeta) {
    content.push({
      text: options.companyMeta,
      fontSize: 8.5,
      color: '#64748b',
      margin: [0, 0, 0, 8],
    });
  }

  content.push({
    text: options.title,
    style: 'docTitle',
    alignment: 'center',
    margin: [0, 4, 0, options.subtitle ? 2 : 10],
  });

  if (options.subtitle) {
    content.push({
      text: options.subtitle,
      fontSize: 10,
      color: '#475569',
      alignment: 'center',
      margin: [0, 0, 0, 12],
    });
  }

  if (options.metadata && options.metadata.length > 0) {
    content.push(buildMetadataBlock(options.metadata));
  }

  for (const section of options.sections) {
    content.push(...buildSectionTable(section));
  }

  if (options.highlight) {
    const highlightRows: TableCell[][] = [
      [
        {
          stack: [
            { text: options.highlight.label, fontSize: 10, bold: true, color: '#1e3a8a' },
            ...(options.highlight.subtext
              ? [{ text: options.highlight.subtext, fontSize: 8.5, color: '#475569' }]
              : []),
          ],
          fillColor: '#eff6ff',
          border: [true, true, false, true],
        },
        {
          text: options.highlight.value,
          fontSize: 13,
          bold: true,
          color: '#1d4ed8',
          alignment: 'right',
          fillColor: '#eff6ff',
          border: [false, true, true, true],
        },
      ],
    ];

    content.push({
      margin: [0, 10, 0, 10],
      table: {
        widths: ['58%', '42%'],
        body: highlightRows,
      },
      layout: {
        hLineColor: () => '#93c5fd',
        vLineColor: () => '#93c5fd',
        paddingTop: () => 8,
        paddingBottom: () => 8,
        paddingLeft: () => 10,
        paddingRight: () => 10,
      },
    });
  }

  if (options.footnote) {
    content.push({
      text: options.footnote,
      fontSize: 8.5,
      italics: true,
      color: '#64748b',
      margin: [0, 4, 0, 14],
    });
  }

  if (options.signatures && options.signatures.length > 0) {
    content.push({
      margin: [0, 10, 0, 0],
      columns: options.signatures.map((sig) => ({
        width: '*',
        alignment: 'center',
        stack: [
          { text: sig.title, bold: true, fontSize: 9.5 },
          {
            text: sig.subtitle ?? '(Ký và ghi rõ họ tên)',
            italics: true,
            fontSize: 8.5,
            color: '#64748b',
            margin: [0, 2, 0, 36],
          },
          ...(sig.name ? [{ text: sig.name, bold: true, fontSize: 9.5 }] : []),
        ],
      })),
    });
  }

  return {
    pageSize: options.pageSize ?? 'A4',
    pageOrientation: options.pageOrientation ?? 'portrait',
    pageMargins: [36, 36, 36, 36],
    content,
    styles: {
      docTitle: {
        fontSize: 15,
        bold: true,
        color: '#0f172a',
      },
      sectionTitle: {
        fontSize: 10.5,
        bold: true,
        color: '#0f172a',
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: '#334155',
      },
      metaLabel: {
        fontSize: 9,
        color: '#64748b',
      },
      metaValue: {
        fontSize: 9.5,
        bold: true,
        color: '#0f172a',
      },
    },
  };
}
