---
name: export-doc-check
description: Chuẩn hóa tính năng xuất Excel (dùng thư viện MIT như exceljs) và xuất PDF khổ A4, không lỗi font tiếng Việt, không cắt dòng và xuất đủ dữ liệu theo bộ lọc. Dùng khi làm export hoặc gọi /export-doc-check.
---

# Skill: Export Excel & PDF Quality Check

## Quy tắc tham chiếu
Chỉ dùng thư viện đạt chuẩn license `MIT` theo `.ai/rules/package-policy.md` (ưu tiên `exceljs` cho Excel).

## Checklist kiểm tra
1. **Tính toàn vẹn dữ liệu:**
   - Đảm bảo xuất đủ toàn bộ bản ghi khớp với bộ lọc hiện tại (không bị cắt cụt theo `pageSize` của trang đang xem).
   - Xử lý an toàn `null`/`undefined`; định dạng ngày chuẩn `DD/MM/YYYY`; cột số/tiền giữ nguyên kiểu `Number` để Excel tính tổng (`SUM`) được.
2. **Định dạng Excel (`.xlsx`):**
   - Header in đậm, cố định dòng tiêu đề (`freeze`), đặt độ rộng cột phù hợp và bật `wrapText` cho cột mô tả dài.
   - Tên file tải về có ngữ cảnh + ngày xuất (vd: `bao-cao-2026-11-19.xlsx`).
3. **Định dạng PDF:**
   - Khóa khổ giấy chuẩn (A4 dọc/ngang), căn lề đều, kiểm tra quy tắc ngắt trang (`page-break-inside: avoid`) để không cắt đôi dòng text, bảng biểu hoặc khu vực chữ ký.
   - Đảm bảo font nhúng hiển thị đầy đủ dấu tiếng Việt (UTF-8), không lỗi ô vuông.
4. **Trải nghiệm người dùng:** Hiển thị trạng thái đang xuất file và khóa nút Export trong lúc xử lý; cảnh báo nếu dữ liệu quá lớn (> 5.000 dòng) nên chuyển sang xuất phía Backend.