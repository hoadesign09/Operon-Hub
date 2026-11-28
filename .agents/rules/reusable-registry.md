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
| `normalizeLocale`, `parseCookieValue`, `interpolateTemplate`, `pickLocalizedText`, `createTranslator` | `src/lib/portable/i18n-engine.ts` | `Cross-Project` | `None` | Engine đa ngôn ngữ thuần túy: chuẩn hóa locale, đọc cookie, nội suy `{param}`, chọn text song ngữ DB (`name`/`nameEn`) và tra từ điển có fallback |
| `rankBetween`, `rankBefore`, `rankAfter`, `generateInitialRanks`, `compareRanks` | `src/lib/portable/fractional-rank.ts` | `Cross-Project` | `None` | Thuật toán Fractional Indexing (LexoRank) sắp xếp kéo-thả O(1) cho Kanban & Backlog |
| `computeBurndownSeries`, `computeVelocitySeries`, `computeProjectEvm` | `src/lib/portable/agile-metrics.ts` | `Cross-Project` | `None` | Tính dữ liệu Sprint Burndown, Sprint Velocity và chỉ số EVM/Burn Rate dự án thuần túy |
| `wouldCreateDependencyCycle`, `computeCriticalPath`, `autoShiftDependents` | `src/lib/portable/gantt-scheduler.ts` | `Cross-Project` | `None` | Kiểm tra chu trình DAG, tính đường găng CPM (Early/Late/Slack) và tự động đẩy lịch FS/SS/FF/SF |
| `computeWorkloadMatrix` | `src/lib/portable/workload-calculator.ts` | `Cross-Project` | `dayjs` (MIT) | Tính ma trận phân bổ công suất nguồn lực (Workload Heatmap) loại trừ cuối tuần, ngày lễ và nghỉ phép |
| `calculateProposalLineTotals`, `canTransitionProposalStatus`, `formatProposalCode` | `src/lib/portable/proposal-calculator.ts` | `Cross-Project` | `None` | Tính dự toán chi tiết từng hạng mục đề xuất, kiểm tra chuyển trạng thái vòng đời và sinh mã đề xuất chuẩn |
| `computeEffectiveSlaHours`, `calculateSlaDeadlines`, `shiftSlaDeadlineByMinutes`, `evaluateSlaStatus`, `canTransitionItTicketStatus`, `formatTicketCode` | `src/lib/portable/sla-calculator.ts` | `Cross-Project` | `None` | Engine tính hạn SLA theo mức ưu tiên, đánh giá trạng thái SLA (ON_TRACK/AT_RISK/BREACHED/MET/PAUSED), kiểm tra vòng đời ticket và sinh mã ticket chuẩn |
| `computeOrgTreeMetrics`, `filterOrgHierarchy`, `collectOrgNodeIds`, `findOrgNodePath`, `flattenOrgHierarchy`, `getOrgAvatarInitials` | `src/lib/portable/org-chart-utils.ts` | `Cross-Project` | `None` | Tiện ích thuần túy xử lý cây Sơ đồ Tổ chức: tính tổng quân số/độ sâu, lọc giữ nhánh cha, làm phẳng kèm breadcrumb và tạo avatar initials |
| `calculatePaymentLineItems`, `computeAdvanceSettlement`, `evaluateDisbursementProgress`, `canTransitionPaymentStatus`, `canCollaborateOnPaymentStatus`, `formatPaymentCode`, `amountToVietnameseWords`, `amountToEnglishWords` | `src/lib/portable/payment-calculator.ts` | `Cross-Project` | `None` | Engine tài chính thuần túy: tính bảng kê VAT, đối chiếu quyết toán tạm ứng, tiến độ giải ngân, vòng đời phiếu thanh toán và đọc số tiền bằng chữ VI/EN |
| `computeBudgetSnapshot`, `evaluateBudgetImpact`, `computeProposalTransferReserve`, `computePaymentReserveRequirement`, `computeDisbursementBudgetMutation`, `canTransitionBudgetStatus`, `formatBudgetCode` | `src/lib/portable/budget-calculator.ts` | `Cross-Project` | `None` | Engine kế toán ngân sách thuần túy: tính số dư khả dụng, sức khỏe quỹ, kiểm soát chặn cứng/cảnh báo mềm, chuyển giao giữ chỗ chống trừ trùng Đề xuất ↔ Thanh toán và biến động giải ngân/hoàn quỹ |
| `normalizeThemeMode`, `resolveThemeMode`, `toggleThemeMode`, `buildThemeInitScript` | `src/lib/portable/theme-mode.ts` | `Cross-Project` | `None` | Tiện ích quản lý chế độ sáng/tối/hệ thống (light/dark/system) và sinh inline script chống FOUC |
| `ok`, `created`, `fail`, `AppError`, `withErrorHandler` | `src/shared/api-response.ts` | `Project-Only` | `next`, `zod` | Chuẩn hóa JSON Response & bắt lỗi thống nhất cho Next.js Route Handlers |
| `Skeleton`, `SkeletonTableRows`, `SkeletonTable`, `SkeletonKpiGrid`, `SkeletonCardGrid`, `SkeletonListRows`, `SkeletonDetailPage`, `SkeletonPage`, `SkeletonPortalShell` | `src/components/ui/Skeleton.tsx` | `Project-Only` | `react` | Bộ Skeleton Loading UI chuẩn Precision Grid chống layout shift cho toàn bộ trang, bảng, card, modal và shell |
