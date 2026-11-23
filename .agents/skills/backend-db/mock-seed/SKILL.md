---
name: mock-seed
description: Sinh dữ liệu mẫu sát thực tế (tiếng Việt có dấu, edge-case, phân trang > 30 dòng) cho môi trường Local/Dev. Dùng khi tạo seed data hoặc gọi /mock-seed.
---

# Skill: Realistic Mock & Seed Data Generator

## Quy tắc an toàn
Chỉ chạy seed trên môi trường Local/Dev (`localhost` / `127.0.0.1`). Tuyệt đối không chạy trên Staging/Production.

## Quy trình
1. **Đọc schema bảng / API payload** để lấy đúng kiểu dữ liệu, ràng buộc khóa ngoại và độ dài tối đa (`VARCHAR`).
2. **Tạo bộ dữ liệu sát thực tế & bao phủ Edge-Case:**
   - Dữ liệu tiếng Việt đầy đủ dấu, tên dài, ký tự đặc biệt (`&`, `'`, `"`, `/`).
   - Dữ liệu rỗng/null ở các cột cho phép `NULL`.
   - Mốc ngày đầu tháng, cuối tháng, năm nhuận và nhiều bản ghi (> 30 dòng) để kiểm tra phân trang và lọc ngày.
   - Số tiền lớn, số `0`, và số thập phân (nếu có).
3. **Tính lặp lại (Idempotent):** Script seed phải hỗ trợ chạy lại nhiều lần không gây lỗi trùng khóa (`INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` / kiểm tra tồn tại trước khi insert).