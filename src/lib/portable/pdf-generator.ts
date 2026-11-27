/**
 * Tiện ích sinh file PDF tiếng Việt chuẩn Unicode (font Roboto nhúng sẵn, khổ A4/A5) dùng pdfmake (MIT).
 * Không phụ thuộc cấu hình hay nghiệp vụ dự án (Zero Business Coupling).
 *
 * Quy chuẩn bảng biểu:
 * - Cột "Ghi chú" (note) LUÔN nằm ở cột cuối cùng (cột 3) trên mọi bảng tài liệu.
 * - Khối chân chữ ký được bọc `unbreakable: true`, bố cục dạng thẻ có đường ký, chức danh, trạng thái & thời điểm.
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
 *   sections: [{ title: 'Thu nhập', rows: [{ label: 'Lương cơ bản', value: '15.000.000 ₫', note: 'Theo HĐLĐ' }] }],
 * });
 * const pdfBuffer = await generatePdfBuffer(doc);
 * ```
 */

import PdfPrinter from 'pdfmake';
import type {
  Alignment,
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
  labelHeader?: string;
  valueHeader?: string;
  noteHeader?: string;
  valueAlignment?: Alignment;
  columnWidths?: [string | number, string | number, string | number];
  rows: PdfSectionRow[];
  totalLabel?: string;
  totalValue?: string;
  totalNote?: string;
}

export interface PdfHighlightBox {
  label: string;
  value: string;
  subtext?: string;
}

export type PdfSignatureStatusTone = 'approved' | 'pending' | 'rejected' | 'draft';

export interface PdfSignatureSlot {
  title: string;
  stepLabel?: string;
  roleTitle?: string;
  subtitle?: string;
  name?: string;
  code?: string;
  statusText?: string;
  statusTone?: PdfSignatureStatusTone;
  signedAt?: string;
  note?: string;
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
  signatureSectionTitle?: string;
  signatureHeader?: string;
  signatures?: PdfSignatureSlot[];
  footerLeftText?: string;
}

interface VfsFontMap {
  [filename: string]: string;
}

interface SignatureTonePalette {
  fill: string;
  border: string;
  text: string;
}

const SIGNATURE_TONE_STYLES: Record<PdfSignatureStatusTone, SignatureTonePalette> = {
  approved: { fill: '#ecfdf5', border: '#6ee7b7', text: '#047857' },
  pending: { fill: '#fffbeb', border: '#fcd34d', text: '#b45309' },
  rejected: { fill: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  draft: { fill: '#f8fafc', border: '#cbd5e1', text: '#475569' },
};

const DEFAULT_TABLE_WIDTHS: [string, string, string] = ['40%', '26%', '34%'];

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
      dontBreakRows: true,
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

/**
 * Quy chuẩn chung cho tất cả tài liệu PDF:
 * Cột 1: Khoản mục (`label`)
 * Cột 2: Giá trị / Số tiền / Nội dung (`value`)
 * Cột 3 (LUÔN LÀ CỘT CUỐI CÙNG): Ghi chú (`note`)
 */
function buildSectionTable(section: PdfTableSection): Content[] {
  const valueAlignment: Alignment = section.valueAlignment ?? 'right';
  const widths = section.columnWidths ?? DEFAULT_TABLE_WIDTHS;

  const body: TableCell[][] = [
    [
      { text: section.labelHeader ?? 'Khoản mục', style: 'tableHeader', fillColor: '#e2e8f0' },
      {
        text: section.valueHeader ?? 'Số tiền (VNĐ)',
        style: 'tableHeader',
        alignment: valueAlignment,
        fillColor: '#e2e8f0',
      },
      { text: section.noteHeader ?? 'Ghi chú', style: 'tableHeader', fillColor: '#e2e8f0' },
    ],
  ];

  for (const row of section.rows) {
    body.push([
      { text: row.label, bold: Boolean(row.isBold), fontSize: 9.5 },
      {
        text: row.value,
        alignment: valueAlignment,
        bold: Boolean(row.isBold),
        fontSize: 9.5,
      },
      { text: row.note ?? '', fontSize: 8.5, color: '#64748b' },
    ]);
  }

  if (section.totalLabel && section.totalValue) {
    body.push([
      {
        text: section.totalLabel,
        bold: true,
        fillColor: '#f1f5f9',
        fontSize: 9.5,
      },
      {
        text: section.totalValue,
        alignment: valueAlignment,
        bold: true,
        fillColor: '#f1f5f9',
        fontSize: 9.5,
      },
      {
        text: section.totalNote ?? '',
        fontSize: 8.5,
        italics: true,
        color: '#475569',
        fillColor: '#f1f5f9',
      },
    ]);
  }

  return [
    { text: section.title, style: 'sectionTitle', margin: [0, 8, 0, 4] },
    {
      margin: [0, 0, 0, 6],
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths,
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

function buildSignatureStatusBadge(sig: PdfSignatureSlot): Content | null {
  if (!sig.statusText) {
    return null;
  }

  const tone: PdfSignatureStatusTone = sig.statusTone ?? 'draft';
  const palette = SIGNATURE_TONE_STYLES[tone];
  const isActed = tone === 'approved' || tone === 'rejected';

  const badgeStack: Content[] = [
    {
      text: sig.statusText.toUpperCase(),
      fontSize: 7.5,
      bold: true,
      color: palette.text,
      alignment: 'center',
    },
  ];

  if (isActed && sig.signedAt) {
    badgeStack.push({
      text: sig.signedAt,
      fontSize: 7,
      color: '#334155',
      alignment: 'center',
      margin: [0, 2, 0, 0],
    });
  }

  if (isActed && sig.note) {
    badgeStack.push({
      text: `"${sig.note}"`,
      fontSize: 7,
      italics: true,
      color: '#475569',
      alignment: 'center',
      margin: [0, 2, 0, 0],
    });
  }

  return {
    margin: [4, isActed ? 6 : 4, 4, isActed ? 8 : 22],
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: badgeStack,
            fillColor: palette.fill,
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => palette.border,
      vLineColor: () => palette.border,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 5,
      paddingRight: () => 5,
    },
  };
}

function buildSignatureCardCell(sig: PdfSignatureSlot): TableCell {
  const stack: Content[] = [];

  if (sig.stepLabel) {
    stack.push({
      text: sig.stepLabel.toUpperCase(),
      fontSize: 7,
      bold: true,
      color: '#1d4ed8',
      alignment: 'center',
      margin: [0, 0, 0, 2],
    });
  }

  stack.push({
    text: sig.title.toUpperCase(),
    bold: true,
    fontSize: 8.5,
    color: '#0f172a',
    alignment: 'center',
  });

  if (sig.roleTitle) {
    stack.push({
      text: sig.roleTitle,
      fontSize: 7.5,
      color: '#475569',
      alignment: 'center',
      margin: [0, 1.5, 0, 0],
    });
  }

  stack.push({
    text: sig.subtitle ?? '(Ký, ghi rõ họ tên)',
    italics: true,
    fontSize: 7.5,
    color: '#64748b',
    alignment: 'center',
    margin: [0, 1.5, 0, 4],
  });

  const badge = buildSignatureStatusBadge(sig);
  if (badge) {
    stack.push(badge);
  } else {
    stack.push({ text: ' ', fontSize: 8, margin: [0, 28, 0, 0] });
  }

  // Đường gạch chữ ký tự co giãn theo độ rộng cột (không phụ thuộc ký tự Unicode lạ)
  stack.push({
    margin: [10, 0, 10, 4],
    table: {
      widths: ['*'],
      body: [[{ text: '', border: [false, false, false, true] }]],
    },
    layout: {
      hLineWidth: (i) => (i === 1 ? 0.6 : 0),
      vLineWidth: () => 0,
      hLineColor: () => '#94a3b8',
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  });

  if (sig.name) {
    stack.push({
      text: sig.name,
      bold: true,
      fontSize: 8.5,
      color: '#0f172a',
      alignment: 'center',
    });
  } else {
    stack.push({
      text: 'Họ và tên: ...................',
      fontSize: 7.5,
      color: '#64748b',
      alignment: 'center',
    });
  }

  if (sig.code) {
    stack.push({
      text: sig.code,
      fontSize: 7,
      color: '#64748b',
      alignment: 'center',
      margin: [0, 1, 0, 0],
    });
  }

  const isDigitalSigned =
    sig.statusTone === 'approved' || sig.statusTone === 'rejected';
  if (sig.signedAt && !isDigitalSigned) {
    stack.push({
      text: `Ngày: ${sig.signedAt}`,
      fontSize: 7,
      color: '#475569',
      alignment: 'center',
      margin: [0, 2, 0, 0],
    });
  } else if (!sig.signedAt) {
    stack.push({
      text: 'Ngày ký: ..../..../20....',
      fontSize: 7,
      italics: true,
      color: '#64748b',
      alignment: 'center',
      margin: [0, 2, 0, 0],
    });
  }

  return {
    stack,
    fillColor: '#ffffff',
  };
}

function buildSignatureBlock(
  signatures: PdfSignatureSlot[],
  signatureSectionTitle?: string,
  signatureHeader?: string,
): Content {
  const blockStack: Content[] = [];

  if (signatureSectionTitle || signatureHeader) {
    blockStack.push({
      margin: [0, 8, 0, 6],
      columns: [
        signatureSectionTitle
          ? {
              width: '*',
              text: signatureSectionTitle.toUpperCase(),
              style: 'sectionTitle',
              fontSize: 9.5,
              color: '#0f172a',
            }
          : { width: '*', text: '' },
        signatureHeader
          ? {
              width: 'auto',
              text: signatureHeader,
              fontSize: 8.5,
              italics: true,
              color: '#475569',
              alignment: 'right',
            }
          : { width: 'auto', text: '' },
      ],
    });
  }

  // Nếu có từ 5 chữ ký trở lên, tự động chia hàng tối đa 3 ô để đảm bảo rộng thoáng, dễ đọc
  const maxPerRow = signatures.length <= 4 ? signatures.length : 3;
  for (let start = 0; start < signatures.length; start += maxPerRow) {
    const chunk = signatures.slice(start, start + maxPerRow);
    const cells: TableCell[] = chunk.map((sig) => buildSignatureCardCell(sig));
    while (cells.length < maxPerRow) {
      cells.push({ text: '', border: [false, false, false, false] });
    }

    blockStack.push({
      margin: [0, start === 0 ? 2 : 8, 0, 0],
      table: {
        widths: Array.from({ length: maxPerRow }, () => '*'),
        dontBreakRows: true,
        body: [cells],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#cbd5e1',
        paddingTop: () => 8,
        paddingBottom: () => 8,
        paddingLeft: () => 6,
        paddingRight: () => 6,
      },
    });
  }

  return {
    unbreakable: true,
    margin: [0, 6, 0, 0],
    stack: blockStack,
  };
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
      unbreakable: true,
      margin: [0, 10, 0, 10],
      table: {
        widths: ['58%', '42%'],
        dontBreakRows: true,
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
      margin: [0, 4, 0, 10],
    });
  }

  if (options.signatures && options.signatures.length > 0) {
    content.push(
      buildSignatureBlock(
        options.signatures,
        options.signatureSectionTitle,
        options.signatureHeader,
      ),
    );
  }

  const footerLeft = options.footerLeftText ?? options.companyName ?? '';

  return {
    pageSize: options.pageSize ?? 'A4',
    pageOrientation: options.pageOrientation ?? 'portrait',
    pageMargins: [36, 36, 36, 44],
    footer: (currentPage: number, pageCount: number): Content => ({
      margin: [36, 10, 36, 0],
      columns: [
        {
          width: '*',
          text: footerLeft,
          fontSize: 7.5,
          color: '#94a3b8',
        },
        {
          width: 'auto',
          text: `Trang ${currentPage} / ${pageCount}`,
          fontSize: 7.5,
          color: '#64748b',
          alignment: 'right',
        },
      ],
    }),
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
