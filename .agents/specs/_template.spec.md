---
task_id: TASK-YYYYMMDD-NN
roadmap_ref: TASK-XX (nếu thuộc Blueprint)
module: core | hrm | crm
status: DRAFT
created_at: YYYY-MM-DD
approved_at: null
---

# Task Spec: <Tên Task ngắn gọn, rõ mục tiêu>

> **Single Source of Truth:** Coder, Reviewer và Tester đối soát 1-1 theo các mã `[FR-xx]`, `[DB-xx]`, `[API-xx]`, `[UI-xx]` trong tài liệu này. Chỉ triển khai sau khi `status: APPROVED`.

---

## 1. Mục tiêu & Phạm vi (Objective & Scope)

### 1.1. Mục tiêu nghiệp vụ / kỹ thuật
- Mô tả ngắn gọn vấn đề cần giải quyết và giá trị đầu ra sau khi hoàn tất task.

### 1.2. Phạm vi file (Scope)
- **Files tạo mới:**
  - `path/to/new-file.ts`
- **Files chỉnh sửa:**
  - `path/to/existing-file.ts`
- **Module liên đới có nguy cơ ảnh hưởng:**
  - `src/modules/...` (hoặc `Không có`)
- **Ngoài phạm vi (Out of Scope):**
  - Liệt kê rõ những thứ không làm trong task này để tránh Scope Creep.

---

## 2. Thiết kế Chức năng & Luật Nghiệp vụ (`[FR-xx]`)

- **`[FR-01]` <Tên chức năng>:**
  - **Mô tả luồng:** ...
  - **Quyền (RBAC / Data Scope):** ...
  - **Quy tắc nghiệp vụ / Công thức:** ...
  - **Ngoại lệ & Chặn lỗi:** ...

---

## 3. Thiết kế Database (`[DB-xx]`)

*(Ghi `Không thay đổi DB` nếu không thay đổi schema)*

- **`[DB-01]` <Tên bảng / thay đổi>:**
  - **Chuẩn bắt buộc:** `InnoDB`, `utf8mb4_unicode_ci`, `snake_case`, audit columns (`created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`).
  - **Cấu trúc cột & Ràng buộc:** PK, FK (`fk_<bang>_<cot>`), Unique (`uq_<bang>_<cot>`), Index (`idx_<bang>_<cot>`).
  - **Migration dự kiến:** `database/migrations/YYYYMMDD_HHMMSS_<mo_ta>.sql` (bắt buộc có cả `UP` và `DOWN`, chỉ tự động chạy ở `NODE_ENV=development` với host `localhost`/`127.0.0.1`).

---

## 4. Thiết kế Backend / API (`[API-xx]`)

*(Ghi `Không thay đổi API` nếu thuần Frontend)*

- **`[API-01]` `<METHOD> /api/v1/...`:**
  - **Middleware:** Auth / Permission / Rate-limit / Validation (`zod`).
  - **Request (Query / Params / Body):**
    ```json
    {}
    ```
  - **Response Success (`200` / `201`):**
    ```json
    { "success": true, "data": {} }
    ```
  - **Error Codes:** `400`, `401`, `403`, `404`, `409`, `500`.
  - **Tương thích ngược:** Ghi rõ có/không phá vỡ API cũ.

---

## 5. Thiết kế Frontend / Giao diện (`[UI-xx]`)

*(Ghi `Không thay đổi UI` nếu thuần Backend)*

- **`[UI-01]` `<Đường dẫn route / Component>`:**
  - **Bố cục & Thành phần:** ...
  - **Luồng tương tác & Kết nối API:** Gắn mã `[API-xx]`.
  - **4 Trạng thái bắt buộc:**
    - `Loading`: Skeleton + khóa nút kèm spinner chống double-click.
    - `Empty`: Thông báo trạng thái trống + nút hành động chính.
    - `Error`: Thông báo lỗi tiếng Việt rõ ngữ cảnh + nút Thử lại.
    - `Success`: Format ngày `DD/MM/YYYY`, tiền tệ VNĐ chuẩn, xử lý text dài.
  - **Responsive & Export (nếu có):** ...

---

## 6. Tái sử dụng (`portable/`), Package MIT & Regression Match

### 6.1. Tái sử dụng (Reuse-First)
- **Dùng lại từ `.agents/rules/reusable-registry.md`:** ...
- **Tạo mới trong `src/lib/portable/` (đạt 5 tiêu chí Zero Business Coupling):** ...

### 6.2. Danh sách Package dự kiến (`package-policy.md`)
| Package | Loại (`dep`/`devDep`) | License | Lý do sử dụng |
| :--- | :---: | :---: | :--- |
| `<name>` | `dependencies` | `MIT` | ... |

*(Bắt buộc chạy `node .agents/scripts/check-license.js --pkg <name>` trước khi cài và `--audit` sau khi cài.)*

### 6.3. Regression Test Cases đã Match (`.agents/test-cases/master-testcases.json`)
- Danh sách `TC_ID` cũ có `target_files` trùng Scope: `Không có` / `TC-xxx, TC-yyy`.

---

## 7. Kế hoạch Triển khai (`T1..Tn`) & Tiêu chí Nghiệm thu

| Sub-task | Nội dung thực hiện | Mã Spec liên kết | File chính |
| :--- | :--- | :--- | :--- |
| `T1` | ... | `[DB-01]` | ... |
| `T2` | ... | `[API-01]`, `[FR-01]` | ... |
| `T3` | ... | `[UI-01]` | ... |

### Checklist Nghiệm thu (Reviewer & Tester)
- [ ] Đáp ứng 100% mã `[FR-xx]`, `[DB-xx]`, `[API-xx]`, `[UI-xx]`.
- [ ] Pass kiểm tra `node .agents/scripts/check-license.js --audit` (hoặc khớp ngoại lệ đã được duyệt).
- [ ] Pass unit/integration test và build không lỗi.
- [ ] Đã cập nhật `.agents/rules/reusable-registry.md` nếu có thêm module `portable/`.
