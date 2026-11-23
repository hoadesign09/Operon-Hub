---
trigger: model_decision
description: Mục lục các hàm và module tái sử dụng hiện có của dự án. Đọc trước khi viết tiện ích mới và cập nhật khi tạo module portable mới.
---

# Reusable Modules Registry

> Quy tắc: Trước khi viết hàm tiện ích mới, kiểm tra bảng này. Nếu tạo mới module tái sử dụng, bắt buộc thêm 1 dòng vào bảng này.

| Tên Module / Hàm | Đường dẫn | Mức độ tái sử dụng | Dependencies | Mô tả ngắn |
| :--- | :--- | :--- | :--- | :--- |
| `hashPassword`, `verifyPassword` | `src/lib/portable/password-hasher.ts` | `Cross-Project` | `None` (`node:crypto`) | Băm & xác thực mật khẩu an toàn bằng `scrypt` + `timingSafeEqual` |
| `generateSecureToken`, `sha256Hex` | `src/lib/portable/token-hash.ts` | `Cross-Project` | `None` (`node:crypto`) | Sinh token ngẫu nhiên base64url và băm SHA-256 hex (64 ký tự) |
| `formatDateVN`, `formatDateTimeVN`, `countWorkingDays` | `src/lib/portable/date-utils.ts` | `Cross-Project` | `dayjs` (MIT) | Định dạng ngày giờ VN (`DD/MM/YYYY`) và đếm ngày làm việc loại trừ cuối tuần/lễ |
| `roundCurrency`, `formatVND`, `parseCurrencyInput` | `src/lib/portable/currency-utils.ts` | `Cross-Project` | `None` | Làm tròn, định dạng tiền tệ VNĐ (`15.000.000 ₫`) và parse chuỗi tiền tệ an toàn |
| `parsePaginationParams`, `buildPaginationMeta` | `src/lib/portable/pagination.ts` | `Cross-Project` | `None` | Chuẩn hóa tham số phân trang, sort whitelist và tạo metadata phân trang |
| `retryAsync` | `src/lib/portable/retry.ts` | `Cross-Project` | `None` | Thử lại hàm async với exponential backoff và điều kiện `shouldRetry` |
| `evaluateWorkflowConditions`, `computeApprovalTransition` | `src/lib/portable/approval-engine.ts` | `Cross-Project` | `None` | Đánh giá điều kiện luồng duyệt và tính chuyển trạng thái duyệt đa cấp thuần túy |
| `buildTree`, `wouldCreateCycle`, `collectDescendantIds` | `src/lib/portable/tree-utils.ts` | `Cross-Project` | `None` | Dựng cây phân cấp $O(n)$, phát hiện vòng lặp cha-con và lấy danh sách hậu duệ |
| `buildExcelBuffer` | `src/lib/portable/excel-exporter.ts` | `Cross-Project` | `exceljs` (MIT) | Xuất mảng dữ liệu ra `.xlsx` chuẩn tiếng Việt, auto-width, styled header, freeze & autoFilter |
| `parseExcelBuffer` | `src/lib/portable/excel-importer.ts` | `Cross-Project` | `exceljs` (MIT) | Đọc và chuẩn hóa dữ liệu từ `.xlsx` an toàn, tự dò dòng header và giới hạn dòng chống DoS |
| `generatePdfBuffer`, `buildStructuredPdfDocument` | `src/lib/portable/pdf-generator.ts` | `Cross-Project` | `pdfmake` (MIT) | Sinh file PDF tiếng Việt chuẩn Unicode (font Roboto tích hợp, khổ A4/A5) cho phiếu lương & biên bản |
| `normalizeLocale`, `parseCookieValue`, `interpolateTemplate`, `createTranslator` | `src/lib/portable/i18n-engine.ts` | `Cross-Project` | `None` | Engine đa ngôn ngữ thuần túy: chuẩn hóa locale, đọc cookie, nội suy `{param}` và tra từ điển có fallback |
| `ok`, `created`, `fail`, `AppError`, `withErrorHandler` | `src/shared/api-response.ts` | `Project-Only` | `next`, `zod` | Chuẩn hóa JSON Response & bắt lỗi thống nhất cho Next.js Route Handlers |
