---
name: sql-optimize
description: Phân tích và tối ưu câu truy vấn SQL/ORM chậm, phát hiện N+1 query, full table scan và đề xuất composite index. Dùng khi tối ưu truy vấn hoặc gọi /sql-optimize.
---

# Skill: SQL & Query Optimization

## Quy trình
1. **Phân tích câu truy vấn / ORM code:**
   - Phát hiện `SELECT *` → rút gọn chỉ lấy đúng cột cần thiết.
   - Phát hiện lỗi **N+1 query** (gọi query bên trong vòng lặp `for`/`map`) → đề xuất gom bằng `JOIN`, `WHERE IN (...)` hoặc eager loading.
   - Phát hiện điều kiện cản trở index (vd: bọc hàm lên cột trong `WHERE` như `YEAR(created_at) = 2026` → đổi thành `created_at >= '2026-01-01' AND created_at < '2027-01-01'`, hoặc `LIKE '%abc%'`).
2. **Kiểm tra bảo mật:** Đảm bảo 100% giá trị động truyền qua Parameterized Query (`?` / `$1`), không nối chuỗi SQL.
3. **Đề xuất Index:** Đưa ra câu lệnh `CREATE INDEX` đúng thứ tự cột (cột lọc `=` trước, cột lọc khoảng `>`, `<`, `BETWEEN` hoặc `ORDER BY` sau).
4. **Đối chiếu kết quả:** Đảm bảo câu query tối ưu trả về đúng tập dữ liệu và thứ tự như câu cũ.