# Operon Hub

**Cổng Quản lý Vận hành Doanh nghiệp SME (Enterprise Operations Portal)** được xây dựng theo kiến trúc **Modular Monolith** (Single-Tenant Multi-Branch), cho phép triển khai hoàn chỉnh **Core Platform + Phân hệ Hành chính Nhân sự (HRM)** ở Giai đoạn 1 và cắm mở rộng các phân hệ **CRM / Tài chính / Dự án** ở các giai đoạn tiếp theo mà không cần sửa đổi lõi hệ thống.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8+-4479a1.svg)](https://www.mysql.com/)

---

## 1. Tính năng nổi bật (Giai đoạn 1 — Hoàn thành 100%)

### Core Platform (Nền tảng Lõi Đa Phân hệ)
- **Xác thực & Phân quyền RBAC:** Đăng nhập JWT (`jose`, HttpOnly Cookies, Refresh Token Rotation), phân quyền chi tiết theo vai trò và **4 cấp phạm vi dữ liệu** (`OWN`, `DEPARTMENT`, `BRANCH`, `ALL`).
- **Đa chi nhánh (Multi-Branch):** Quản trị trụ sở chính và các chi nhánh thành viên, lọc dữ liệu xuyên suốt theo chi nhánh đang chọn trên Topbar.
- **Universal Approval Engine:** Động cơ phê duyệt đa cấp dùng chung cho toàn Portal (hỗ trợ điều kiện rẽ nhánh và hook đồng bộ nghiệp vụ cho HRM/CRM).
- **Thông báo & Nhật ký kiểm toán:** Trung tâm thông báo thời gian thực (`NotificationBell`) và Audit Logs ghi nhận mọi thay đổi nhạy cảm.
- **Giao diện Midnight Command (Dual-Rail + Bento Analytics):** Thanh chuyển phân hệ `68px` tối gọn gàng, Sub-menu lọc chuẩn RBAC, Account & Security Hub tại `/my/profile`, Dashboard Bento tương tác và chế độ Responsive Mobile.

### Phân hệ Hành chính Nhân sự (HRM)
- **Cơ cấu Tổ chức:** Cây phòng ban đa cấp (Org Chart), quản lý chức danh & cấp bậc.
- **Hồ sơ Nhân viên 360° & ESS:** Quản lý hồ sơ nhân sự, tự động cấp tài khoản liên kết, lưu trữ/tải tài liệu an toàn (chống Path Traversal), xuất Excel tiếng Việt, cổng tự phục vụ nhân viên (`/my/*`).
- **Hợp đồng Lao động & Quá trình Công tác:** Quy tắc 1 hợp đồng hiệu lực, cảnh báo hết hạn (`≤ 15 ngày`, `≤ 30 ngày`, quá hạn), lịch sử điều chuyển/thăng tiến.
- **Nghỉ phép, Tăng ca (OT) & Công tác:** Quản lý loại phép, quỹ phép năm (tính thâm niên), tự động trừ T7/CN/ngày lễ, chống trùng lịch, phân loại hệ số OT `150% / 200% / 300%`, tích hợp luồng duyệt đa cấp.
- **Chấm công & Bảng công Tháng:** Ca làm việc, phân ca, ngày lễ, chấm công Web (Check-in/Check-out), Import/Export Excel, tổng hợp bảng công 5 nguồn dữ liệu và cơ chế khóa/mở khóa kỳ công.
- **Tính lương & Phiếu lương (Payroll VN):** Tính lương công chuẩn, phụ cấp, OT miễn thuế phần vượt `100%`, BHXH/BHYT/BHTN theo trần quy định, thuế TNCN lũy tiến 7 bậc, xuất bảng lương Excel & phiếu lương PDF tiếng Việt chuẩn A4/A5 (`pdfmake`).
- **Hành chính Văn phòng (Admin Ops):**
  - Quản lý Tài sản & Cấp phát/Thu hồi thiết bị (chống xung đột bằng `SELECT ... FOR UPDATE`, cảnh báo chưa thu hồi khi nghỉ việc, xuất biên bản bàn giao PDF).
  - Đặt Phòng họp thông minh chống trùng lịch theo khung giờ.
  - Bản tin Thông báo Nội bộ kèm thống kê tỷ lệ đã đọc theo nhân viên.
- **Dashboard Vận hành HRM:** KPI tổng hợp theo vai trò/phạm vi quyền (chặn tuyệt đối rò rỉ dữ liệu quỹ lương), 4 biểu đồ tương tác (`recharts`), danh sách hành động nhanh.

---

## 2. Công nghệ sử dụng

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@tabler/icons-react`, `recharts`.
- **Backend & Database:** Next.js Route Handlers (REST API `/api/v1/*`), MySQL 8+ (`InnoDB`, `utf8mb4_unicode_ci`), `mysql2`, `kysely`, `zod`.
- **Xuất tài liệu & Tiện ích:** `exceljs` (Import/Export `.xlsx` MIT), `pdfmake` (Xuất `.pdf` tiếng Việt MIT), `dayjs`, `jose`.
- **Kiểm thử:** Vitest (`61` test suites / `150` automated tests), ESLint 9, TypeScript strict check.

---

## 3. Cấu trúc Thư mục chính

```text
├── database/
│   ├── migrations/          # 13 SQL migrations (UP/DOWN) cho 36 bảng MySQL
│   ├── migrator.ts          # Công cụ chạy migrate/rollback có bảo vệ Local/Dev
│   └── seed-core.ts         # Khởi tạo dữ liệu mẫu idempotent (Vai trò, Chi nhánh, HRM)
├── src/
│   ├── app/                 # Next.js App Router (Portal UI & 100+ API routes)
│   ├── components/          # UI Components theo Core, HRM & Design Studio
│   ├── config/              # Cấu hình biến môi trường & Kysely DB schema
│   ├── layouts/             # Dual-Rail Midnight Command PortalShell
│   ├── lib/portable/        # 11 module tiện ích thuần tái sử dụng đa dự án
│   ├── middlewares/         # Middleware xác thực JWT & kiểm tra quyền RBAC
│   ├── modules/             # Nghiệp vụ phân tách theo Core, Approvals & HRM
│   └── shared/              # Chuẩn hóa API Response & Error Handling
├── tests/                   # 61 bộ kiểm thử Unit, API, Database & Architecture
└── .agents/                 # Tài liệu Blueprint, Specs, Logs, Reports & Master Test Cases
```

---

## 4. Hướng dẫn Cài đặt & Chạy Local

### Yêu cầu môi trường
- Node.js `>= 20` (khuyến nghị Node `22+` / `24+`)
- MySQL `8.0+`

### Bước 1: Cài đặt phụ thuộc
```bash
npm install
```

### Bước 2: Cấu hình biến môi trường
Sao chép file mẫu `.env.example` thành `.env` và điền thông tin kết nối MySQL Local cùng khóa bí mật JWT:
```bash
cp .env.example .env
```

### Bước 3: Khởi tạo Cơ sở dữ liệu & Dữ liệu mẫu
```bash
npm run db:migrate
npm run db:status
npm run db:seed:core
```

### Bước 4: Khởi chạy ứng dụng
```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`:
- **Tài khoản Quản trị mẫu (Local Seed):** `admin@operonhub.local` / `Admin@123456`
- **Design Studio tham chiếu giao diện:** `http://localhost:3000/design-studio`

---

## 5. Các lệnh thường dùng

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run dev` | Chạy máy chủ phát triển Next.js |
| `npm run build` | Biên dịch production build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript (`tsc --noEmit`) |
| `npm run lint` | Kiểm tra chuẩn mã nguồn ESLint |
| `npm run test` | Chạy toàn bộ 61 bộ kiểm thử tự động Vitest |
| `npm run db:migrate` | Chạy migration MySQL (`UP`) trên Local/Dev |
| `npm run db:rollback` | Rollback migration gần nhất (`DOWN`) trên Local/Dev |
| `npm run db:status` | Xem trạng thái các migration đã áp dụng |
| `npm run db:seed:core` | Nạp dữ liệu khởi tạo (idempotent) |

---

## 6. Kiểm thử & Tài liệu dự án

- **Kho Test Case tổng hợp (Excel):** [.agents/test-cases/master-testcases.xlsx](.agents/test-cases/master-testcases.xlsx) (`74` Master Cases, `100% PASS`).
- **Kiến trúc tổng thể (Blueprint):** [.agents/specs/blueprints/operon-hub-hrm.blueprint.md](.agents/specs/blueprints/operon-hub-hrm.blueprint.md).

---

## 7. Giấy phép (License)

Dự án được phát hành theo giấy phép **MIT License** — xem chi tiết tại file [LICENSE](./LICENSE).
