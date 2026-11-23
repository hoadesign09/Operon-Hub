---
name: db-migration
description: Tạo và rà soát file migration database an toàn (có đủ UP/DOWN rollback, chuẩn snake_case, utf8mb4, bảo vệ môi trường). Dùng khi thay đổi schema hoặc gọi /db-migration.
---

# Skill: Safe Database Migration

## Quy tắc tham chiếu
Tuân thủ tuyệt đối `.ai/rules/database-standards.md`.

## Quy trình
1. **Kiểm tra thiết kế schema:**
   - Tên bảng/cột `snake_case`, bảng số nhiều, charset `utf8mb4` (MySQL) / `UTF8` (PostgreSQL).
   - Tiền tệ dùng `DECIMAL(18,2)` hoặc `BIGINT`; có đủ `created_at`, `updated_at` (và `deleted_at` nếu cần xóa mềm).
   - Đánh index cho toàn bộ khóa ngoại và cột lọc chính.
2. **Kiểm tra rủi ro khóa bảng & mất dữ liệu:**
   - Cảnh báo nếu có `DROP COLUMN`, `DROP TABLE`, `ALTER` đổi kiểu dữ liệu làm cắt cụt (truncate) dữ liệu cũ, hoặc thêm cột `NOT NULL` không có `DEFAULT` trên bảng đã có dữ liệu.
3. **Sinh file Migration hoàn chỉnh:**
   - Bắt buộc có cả 2 phần: `UP` (áp dụng thay đổi) và `DOWN` (rollback khôi phục nguyên trạng).
   - Không sửa file migration cũ đã chạy; luôn tạo file mới theo timestamp `YYYYMMDD_HHMMSS_<mo_ta>`.
4. **Quyền thực thi:**
   - Chỉ tự chạy migrate khi `.env` là `development` và DB host là `localhost`/`127.0.0.1`.
   - Nếu là Staging/Production → chỉ sinh file + lệnh chạy tay, KHÔNG thực thi.