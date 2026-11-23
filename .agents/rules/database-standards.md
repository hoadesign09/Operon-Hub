---
trigger: model_decision
description: Quy chuẩn thiết kế Database, migration UP/DOWN, phân quyền chỉ tự động chạy trên Local/Dev và ma trận chấm lỗi DB.
---

# Database Standards & Access Permissions

## A. Quy chuẩn thiết kế & Truy vấn Database
1. **Quy ước đặt tên (Naming):**
   - Dùng `snake_case` chữ thường toàn bộ cho bảng, cột, index, constraint.
   - Tên bảng số nhiều (`users`, `audit_logs`, `order_items`).
   - Khóa chính: `id` (`BIGINT UNSIGNED AUTO_INCREMENT` hoặc `UUID`).
   - Khóa ngoại: `<ten_bang_so_it>_id` (vd: `user_id`, `role_id`), bắt buộc đặt tên constraint `fk_<bang>_<cot>`.
   - Index: `idx_<bang>_<cot>`, Unique: `uq_<bang>_<cot>`.
2. **Cột bắt buộc (Audit & Soft Delete):**
   - Mọi bảng nghiệp vụ đều phải có: `created_at`, `updated_at`.
   - Các bảng dữ liệu quan trọng phải dùng xóa mềm (`deleted_at NULL`) thay vì xóa cứng (`DELETE`).
   - Lưu vết người thao tác khi có auth: `created_by`, `updated_by`.
3. **Bảng mã & Kiểu dữ liệu:**
   - MySQL/MariaDB: bắt buộc `CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` (hỗ trợ đầy đủ tiếng Việt & emoji).
   - PostgreSQL: `UTF8`.
   - Tiền tệ dùng `DECIMAL(18,2)` (hoặc `BIGINT` cho VNĐ), KHÔNG dùng `FLOAT`/`DOUBLE`.
   - Thời gian lưu chuẩn UTC hoặc thống nhất 1 timezone theo cấu hình dự án.
4. **An toàn truy vấn & Hiệu năng:**
   - 100% truy vấn phải dùng **Parameterized Query / Prepared Statement** (hoặc ORM query builder). Cấm nối chuỗi SQL trực tiếp.
   - Không dùng `SELECT *` trong code nghiệp vụ — chỉ chọn đúng cột cần thiết.
   - Bắt buộc đánh index cho toàn bộ khóa ngoại và các cột thường xuyên lọc (`WHERE`, `ORDER BY`, `JOIN`).

## B. Phân quyền truy cập & Tự động hóa Database

| Môi trường | Nhận diện qua `.env` | Create / Migrate / Update | Seed / Reset Data | Xóa bảng / Cột (`DROP`) |
| :--- | :--- | :--- | :--- | :--- |
| **Local / Dev** | `NODE_ENV=development` và DB host là `localhost` / `127.0.0.1` | **ĐƯỢC PHÉP TỰ ĐỘNG** | **ĐƯỢC PHÉP TỰ ĐỘNG** | Phải hỏi xác nhận trước |
| **Staging** | `NODE_ENV=staging` | Chỉ sinh file migration, **KHÔNG tự chạy** | Cấm | Cấm |
| **Production** | `NODE_ENV=production` hoặc host ngoài local | **CẤM TUYỆT ĐỐI** | **CẤM TUYỆT ĐỐI** | **CẤM TUYỆT ĐỐI** |

## C. Quy tắc Migration bắt buộc
1. **Không sửa tay DB trực tiếp:** Mọi thay đổi schema (tạo bảng, thêm cột, sửa index) đều phải đi qua file migration có phiên bản (`YYYYMMDD_HHMMSS_<mo_ta>.sql` hoặc ORM migration).
2. **Không sửa file migration đã chạy:** Nếu cần chỉnh sửa schema cũ, bắt buộc tạo file migration mới nối tiếp.
3. **Bắt buộc có Rollback (`DOWN`):** Mỗi file migration đều phải đi kèm script đảo ngược để khôi phục khi lỗi.
4. **Kiểm tra môi trường trước khi chạy:** Trước khi thực thi bất kỳ lệnh migration/seed nào, AI bắt buộc đọc biến kết nối DB để chắc chắn đang trỏ vào `localhost` / `127.0.0.1` (Dev). Nếu trỏ ra IP/domain khác → dừng ngay lập tức.
5. **Ghi Log DB:** Mọi lệnh tạo/cập nhật/migration đã chạy phải ghi rõ tên file migration, danh sách bảng ảnh hưởng và kết quả vào `.ai/logs/work/`.