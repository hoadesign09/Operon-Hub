# AGENTS.md — Hệ thống Điều phối AI Dự án

> File điều phối gốc (Root Orchestrator). Mọi Agent và phiên làm việc AI trong dự án bắt buộc đọc và tuân thủ tuyệt đối các quy tắc dưới đây trước khi thao tác.

---

## 1. Chế độ Thực thi (Execution Modes)

Phân biệt rõ 2 chế độ làm việc dựa trên yêu cầu của người dùng:

### A. Full Pipeline Mode (Mặc định khi giao tính năng mới / nâng cấp lớn)
Chạy tuần tự đủ **6 Phases** theo `.ai/rules/workflow-protocol.md`:
`Phase 0–1: Planner` → **[GATE 1: Chờ người dùng duyệt `OK`]** → `Phase 2: Coder` → `Phase 3: Reviewer` → `Phase 4–5: Tester`

### B. Standalone Mode (Khi người dùng gọi đích danh 1 Agent)
Chỉ thực thi đúng Agent được gọi, ghi log tương ứng và **DỪNG LẠI** (không tự chuyển Phase):
- `/plan` → `.ai/agents/planner.md` (Hỗ trợ cả **Task Spec** lẻ và **System Blueprint** tổng thể tại `.ai/specs/blueprints/`).
- `/code` → `.ai/agents/coder.md` (Triển khai code theo Spec đã duyệt hoặc yêu cầu chỉ định).
- `/review` → `.ai/agents/eviewer.md` (Kiểm định 5 lớp cho `git diff` hoặc module chỉ định).
- `/test` → `.ai/agents/tester.md` (Kiểm thử, ghi Test Log và đồng bộ Excel cho module chỉ định).
- `/clone` → `.ai/agents/cloner.md` (Nhân bản khung dự án sạch sang thư mục mới, loại bỏ nghiệp vụ cũ).

---

## 2. Danh mục Agents & Ngân sách Tài nguyên (`.ai/agents/`)

| Lệnh | Agent | File cấu hình | Nhóm Model | Max Input | Max Output | Temp | Trách nhiệm cốt lõi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/plan` | **Planner** | `.ai/agents/planner.md` | Reasoning mạnh | 80k | 8,000 | 0.2 | Bóc tách Spec (`FR/DB/API/UI`), Blueprint hệ thống, Match Regression |
| `/code` | **Coder** | `.ai/agents/coder.md` | Coding tối ưu | 60k | 12,000 | 0.1 | Triển khai code bám Spec, DB migration (Local), cài gói MIT, tách `portable/` |
| `/review` | **Reviewer** | `.ai/agents/reviewer.md` | Reasoning độc lập | 50k | 4,000 | 0.0 | Kiểm định 5 lớp (Spec, DB, API, UI, Chuẩn & MIT), không tự sửa code |
| `/test` | **Tester** | `.ai/agents/tester.md` | Nhanh & chuẩn xác | 45k | 8,000 | 0.1 | Đối soát 100% mã Spec + Regression, ghi Test Log, xuất Excel & Report |
| `/clone` | **Cloner** | `.ai/agents/cloner.md` | Coding tối ưu | 50k | 8,000 | 0.1 | Copy khung `CORE`/`OPTIONAL`, gỡ nghiệp vụ cũ, lọc Test Case lõi, audit MIT |

---

## 3. Lệnh gọi nhanh Skills hằng ngày (`.ai/skills/`)

Chỉ đọc đúng file skill được gọi, không nạp các skill không liên quan vào context:

- **Backend / API / Database (`.ai/skills/backend-db/`):**
  - `/api` → `api-contract.md` (Chuẩn hóa & xuất tài liệu Request/Response API)
  - `/db` → `db-migration.md` (Tạo & rà soát migration an toàn có `UP`/`DOWN`)
  - `/sql` → `sql-optimize.md` (Tối ưu query chậm, bắt N+1, đề xuất index)
  - `/mock` → `mock-seed.md` (Sinh dữ liệu mẫu tiếng Việt & edge-case cho Local/Dev)
  - `/bfix` → `api-bug-triage.md` (Khoanh vùng & vá nhanh lỗi API/DB)
- **Frontend (`.ai/skills/frontend/`):**
  - `/ui` → `ui-state-check.md` (Kiểm tra đủ 4 trạng thái UI, chống double-click, responsive)
  - `/fe-api` → `api-integration.md` (Nối API an toàn, `?.`/`??`, `AbortController`, `debounce`)
  - `/export` → `export-doc-check.md` (Chuẩn hóa xuất Excel MIT & PDF tiếng Việt khổ chuẩn)
  - `/fe-clean` → `fe-refactor.md` (Tách component/helper tái sử dụng giữ nguyên giao diện cũ)

---

## 4. Bộ Quy chuẩn Bắt buộc (`.ai/rules/`) & Điểm dừng duyệt (Human Gates)

Mọi Agent phải tuân thủ 6 file quy chuẩn sau:
1. **`workflow-protocol.md`** — Vòng đời 6 Phases, **Live Progress Card** (bắt buộc in ra chat khi bắt đầu và kết thúc mỗi Phase) và **Circuit Breaker** (tối đa **3 vòng lặp** sửa lỗi; quá 3 vòng dừng báo `BLOCKED_ESCALATED`).
2. **`coding-standards.md`** & **`reusable-registry.md`** — Reuse-First; logic dùng chung đa dự án đặt tại `src/lib/portable/` (cấm import ngược nghiệp vụ/config vào `portable/`).
3. **`database-standards.md`** — Chuẩn `snake_case`, `utf8mb4`, `DECIMAL`/`BIGINT` cho tiền tệ, 100% Parameterized Query, migration bắt buộc có `DOWN`. **CHỈ tự động chạy migrate/seed khi `NODE_ENV=development` và DB host là `localhost`/`127.0.0.1`**.
4. **`package-policy.md`** — **100% MIT-Only**. Trước khi cài bất kỳ package nào bắt buộc chạy `node .ai/scripts/check-license.js --pkg <name>` (`[ALLOWED]`), cài xong chạy `node .ai/scripts/check-license.js --audit` (`[PASS]`).
5. **`clone-manifest.md`** — Ranh giới `CORE` / `OPTIONAL` / `EXCLUDE` và `Entry Points` để nhân bản dự án sạch.

**5 Điểm dừng BẮT BUỘC hỏi người dùng (Human Approval Gates):**
1. Sau **Phase 1 (Planner)** — Chờ duyệt Spec (`OK`) trước khi Coder sửa bất kỳ dòng code nào.
2. Khi Coder phát sinh file sửa đổi nằm ngoài `Scope` của Spec.
3. Khi cần thao tác DB phá hủy (`DROP TABLE`/`DROP COLUMN`) hoặc DB không trỏ về `localhost`/`127.0.0.1`.
4. Khi cần cài package không phải license `MIT` (`[BLOCKED]`).
5. Khi vượt quá **3 vòng lặp** giữa `Coder ↔ Reviewer` hoặc `Coder ↔ Tester`.

---

## 5. Tài liệu Đầu ra, Logs, Excel Test Cases & Scripts

| Loại tài liệu | Đường dẫn chuẩn | Agent phụ trách |
| :--- | :--- | :--- |
| **Task Spec (Single Source of Truth)** | `.ai/specs/YYYY-MM-DD_<task-id>.spec.md` | Planner tạo & khóa (`APPROVED`), Coder/Reviewer/Tester đối soát 1-1 |
| **System Blueprint** | `.ai/specs/blueprints/<slug>.blueprint.md` | Planner (`/plan` độc lập cho hệ thống lớn) |
| **Work Log** | `.ai/logs/work/YYYY-MM-DD_<task-id>.work.log.md` | Planner, Coder, Reviewer |
| **Test Log** | `.ai/logs/test/YYYY-MM-DD_<task-id>.test.log.md` | Tester |
| **Kho Test Case (JSON → Excel)** | `.ai/test-cases/master-testcases.json` → `.xlsx` | Tester cập nhật JSON + chạy `node .ai/scripts/sync-excel.js` |
| **Báo cáo tổng kết** | `.ai/reports/YYYY-MM-DD_<task-id>.report.md` | Tester (hoặc Cloner với `_clone-<slug>.report.md`) |

**Scripts tự động (`.ai/scripts/`):**
- `node .ai/scripts/sync-excel.js` — Đồng bộ `master-testcases.json` sang `master-testcases.xlsx` (2 sheets: `Master_Cases`, `Test_Runs`).
- `node .ai/scripts/check-license.js --pkg <name> | --audit` — Kiểm tra license MIT trước & sau khi cài package.
- `node .ai/scripts/clone-project.js --target <path> --name <slug> --exclude <list>` — Copy khung dự án sạch.

---

## 6. Kỷ luật Context & Tiết kiệm Token

- **CẤM đọc** các thư mục/file: `node_modules/`, `dist/`, `build/`, `.next/`, `.git/`, `uploads/`, `.env`, file nhị phân (`.xlsx`, `.pdf`, ảnh), và các file trong `.ai/logs/` hoặc `.ai/reports/` không thuộc `task_id` hiện tại.
- Khi tra cứu `.ai/test-cases/master-testcases.json`, chỉ lọc các bản ghi có `module` hoặc `target_files` trùng với Scope hiện tại.
- Không sửa, xóa hay làm ảnh hưởng mã nguồn ngoài phạm vi Task Spec đã được duyệt.

## 7. Quy tắc Tự kiểm tra & Tạo bù (Auto-Bootstrap)

Trước khi thực thi bước đầu tiên của bất kỳ Agent nào, tự động kiểm tra cấu trúc `.ai/` và xử lý theo 2 nhóm:

### A. Tự động tạo bù (Không cần hỏi người dùng)
Nếu thiếu bất kỳ thư mục/file dữ liệu nào dưới đây, Agent **tự động tạo mới đúng định dạng** rồi chạy tiếp:
- Thư mục rỗng: `.ai/specs/`, `.ai/specs/blueprints/`, `.ai/logs/work/`, `.ai/logs/test/`, `.ai/reports/`, `.ai/test-cases/`.
- Thư mục code tái sử dụng: `src/lib/portable/` (chỉ tạo khi có module mới cần tách; nếu dự án không dùng thư mục gốc `src/`, tạo tại `lib/portable/` theo cấu trúc thực tế của dự án và ghi chú vào Work Log).
- `.ai/test-cases/master-testcases.json` → khởi tạo nội dung: `{"cases": [], "runs": []}`.
- `.ai/logs/work/bugfix-history.md` → khởi tạo với tiêu đề `# Bugfix History`.
- `.ai/rules/reusable-registry.md` → khởi tạo bảng mục lục rỗng đúng 5 cột chuẩn.

### B. Dừng lại cảnh báo (Không tự bịa, không tự bỏ qua)
Nếu thiếu các file lõi sau, Agent **PHẢI dừng lại thông báo cho người dùng** trước khi đi tiếp:
- Thiếu file trong `.ai/rules/` hoặc `.ai/specs/_template.spec.md` → báo rõ tên file thiếu và hỏi có muốn tạo bản chuẩn không.
- Thiếu `.ai/scripts/check-license.js` khi cần cài package → **CẤM tự cài package**, dừng lại báo thiếu script kiểm tra MIT.
- Thiếu `.ai/scripts/sync-excel.js` khi Tester kết thúc Phase 4 → vẫn cập nhật `.ai/test-cases/master-testcases.json` bình thường, nhưng ghi cảnh báo `[!]` vào Live Progress Card và Report để người dùng bổ sung script xuất Excel.