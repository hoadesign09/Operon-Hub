const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  VerticalAlign,
} = require("docx");

const THEME = {
  font: "Segoe UI",
  primary: "1E3A8A",      // Xanh navy doanh nghiệp
  primaryLight: "EFF6FF", // Nền xanh nhạt
  secondary: "1D4ED8",    // Xanh tiêu đề cấp 2
  text: "1F2937",         // Xám đậm dễ đọc
  muted: "6B7280",        // Xám ghi chú
  border: "CBD5E1",       // Viền bảng nhạt
  rowAlt: "F8FAFC",       // Nền dòng bảng xen kẽ
  callouts: {
    info: { bg: "EFF6FF", border: "2563EB", titleColor: "1E40AF", defaultTitle: "Thông tin" },
    tip: { bg: "ECFDF5", border: "059669", titleColor: "065F46", defaultTitle: "Mẹo thao tác nhanh" },
    warning: { bg: "FFFBEB", border: "D97706", titleColor: "92400E", defaultTitle: "Lưu ý quan trọng" },
  },
};

function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

// Chuyển chuỗi có **in đậm** thành mảng TextRun
function parseRichText(text, baseOptions = {}) {
  const parts = String(text || "").split(/(\*\*.*?\*\*)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: THEME.font,
          size: 22,
          color: THEME.text,
          ...baseOptions,
        });
      }
      return new TextRun({
        text: part,
        font: THEME.font,
        size: 22,
        color: THEME.text,
        ...baseOptions,
      });
    });
}

function getPngDimensions(buffer) {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return { width: 1366, height: 768 };
}

function fitToPage(origW, origH, maxWidth = 570) {
  const width = Math.min(origW, maxWidth);
  const height = Math.round((origH * width) / origW);
  return { width, height };
}

function buildStyledTable(headers = [], rows = []) {
  const tableRows = [];

  if (headers.length > 0) {
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: THEME.primary, color: "auto" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(h),
                      bold: true,
                      color: "FFFFFF",
                      font: THEME.font,
                      size: 20,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }

  rows.forEach((row, rIdx) => {
    const fill = rIdx % 2 === 1 ? THEME.rowAlt : "FFFFFF";
    tableRows.push(
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: "auto" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 90, bottom: 90, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { line: 276 },
                  children: parseRichText(cell, { size: 20 }),
                }),
              ],
            })
        ),
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
    },
    rows: tableRows,
  });
}

function buildCalloutBox(callout) {
  const cfg = THEME.callouts[callout.type] || THEME.callouts.info;
  const title = callout.title || cfg.defaultTitle;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: cfg.border },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: cfg.bg, color: "auto" },
            margins: { top: 120, bottom: 120, left: 180, right: 160 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    color: cfg.titleColor,
                    font: THEME.font,
                    size: 21,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 276 },
                children: parseRichText(callout.text, { size: 20 }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildCoverPage(cover) {
  const metaRows = [
    ["Phiên bản", cover.version || "1.0"],
    ["Ngày ban hành", cover.releaseDate || new Date().toLocaleDateString("vi-VN")],
    ["Đơn vị biên soạn", cover.author || "Phòng Công nghệ Thông tin"],
    ["Đối tượng áp dụng", cover.audience || "Người dùng hệ thống"],
  ];

  return [
    new Paragraph({ spacing: { before: 1400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: (cover.systemName || "HỆ THỐNG NỘI BỘ").toUpperCase(),
          bold: true,
          color: THEME.secondary,
          font: THEME.font,
          size: 26,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 18, color: THEME.primary, space: 12 },
      },
      children: [
        new TextRun({
          text: (cover.title || "TÀI LIỆU HƯỚNG DẪN SỬ DỤNG").toUpperCase(),
          bold: true,
          color: THEME.primary,
          font: THEME.font,
          size: 48,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 1600 },
      children: [
        new TextRun({
          text: cover.subtitle || "",
          italics: true,
          color: THEME.muted,
          font: THEME.font,
          size: 26,
        }),
      ],
    }),
    buildStyledTable(["Thông tin tài liệu", "Chi tiết"], metaRows),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

async function main() {
  const inputPath = getArg("--input", "docs/user-guide/content.json");
  const outputPath = getArg("--output", "docs/user-guide/HDSD.docx");

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const baseDir = path.dirname(path.resolve(inputPath));
  const children = [];
  let imageCount = 0;

  // 1. Trang bìa
  if (raw.cover) {
    children.push(...buildCoverPage(raw.cover));
  }

  // 2. Các phần nội dung chính
  for (const section of raw.sections || []) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320, after: 140 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: THEME.primary, space: 4 },
        },
        children: [
          new TextRun({
            text: section.heading,
            bold: true,
            color: THEME.primary,
            font: THEME.font,
            size: 30,
          }),
        ],
      })
    );

    if (section.description) {
      children.push(
        new Paragraph({
          spacing: { after: 140, line: 276 },
          children: parseRichText(section.description),
        })
      );
    }

    if (section.table) {
      children.push(buildStyledTable(section.table.headers, section.table.rows));
      children.push(new Paragraph({ spacing: { after: 140 } }));
    }

    if (section.callout) {
      children.push(buildCalloutBox(section.callout));
      children.push(new Paragraph({ spacing: { after: 140 } }));
    }

    for (const step of section.steps || []) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          keepNext: true,
          children: [
            new TextRun({
              text: step.title,
              bold: true,
              color: THEME.secondary,
              font: THEME.font,
              size: 25,
            }),
          ],
        })
      );

      for (const line of step.details || []) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80, line: 276 },
            children: parseRichText(line),
          })
        );
      }

      if (step.fieldTable) {
        children.push(new Paragraph({ spacing: { before: 60 } }));
        children.push(buildStyledTable(step.fieldTable.headers, step.fieldTable.rows));
        children.push(new Paragraph({ spacing: { after: 120 } }));
      }

      if (step.image) {
        const imgPath = path.isAbsolute(step.image)
          ? step.image
          : path.resolve(baseDir, step.image);

        if (fs.existsSync(imgPath)) {
          const imgBuffer = fs.readFileSync(imgPath);
          const { width, height } = getPngDimensions(imgBuffer);
          const fitted = fitToPage(width, height, 570);
          imageCount++;

          // Đóng khung viền mảnh quanh ảnh cho sắc nét trên nền trắng
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
                left: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
                right: { style: BorderStyle.SINGLE, size: 4, color: THEME.border },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      margins: { top: 80, bottom: 80, left: 80, right: 80 },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          keepNext: Boolean(step.caption),
                          children: [
                            new ImageRun({
                              data: imgBuffer,
                              type: "png",
                              transformation: fitted,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          );

          if (step.caption) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 160 },
                children: [
                  new TextRun({
                    text: step.caption,
                    italics: true,
                    color: THEME.muted,
                    font: THEME.font,
                    size: 19,
                  }),
                ],
              })
            );
          }
        } else {
          console.warn(`[WARN] Không tìm thấy ảnh: ${imgPath}`);
        }
      }

      if (step.expectedResult) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 120, line: 276 },
            children: [
              new TextRun({
                text: "Kết quả mong đợi: ",
                bold: true,
                color: "065F46",
                font: THEME.font,
                size: 21,
              }),
              ...parseRichText(step.expectedResult, { size: 21 }),
            ],
          })
        );
      }

      if (step.callout) {
        children.push(buildCalloutBox(step.callout));
        children.push(new Paragraph({ spacing: { after: 140 } }));
      }
    }
  }

  const doc = new Document({
    creator: raw.cover?.author || "Operon Hub",
    title: raw.cover?.title || "Hướng dẫn sử dụng",
    sections: [
      {
        properties: {
          titlePage: true, // Ẩn Header/Footer ở trang bìa
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }, // Lề chuẩn 2cm
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: THEME.border, space: 4 },
                },
                children: [
                  new TextRun({
                    text: raw.headerText || raw.cover?.subtitle || "Tài liệu Hướng dẫn Sử dụng",
                    color: THEME.muted,
                    font: THEME.font,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: THEME.border, space: 4 },
                },
                children: [
                  new TextRun({
                    text: `${raw.footerText || "Lưu hành nội bộ"}   |   Trang `,
                    color: THEME.muted,
                    font: THEME.font,
                    size: 18,
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], color: THEME.muted, font: THEME.font, size: 18 }),
                  new TextRun({ text: " / ", color: THEME.muted, font: THEME.font, size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: THEME.muted, font: THEME.font, size: 18 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`[DONE] Đã xuất file Word định dạng chuẩn: ${outputPath} (đã chèn ${imageCount} ảnh)`);
}

main().catch((err) => {
  console.error("[ERROR]", err);
  process.exit(1);
});