---
name: api-bug-triage
description: Khoanh vùng nguyên nhân gốc (Root Cause) và đề xuất bản vá tối thiểu cho lỗi Backend/API/DB (400, 401, 403, 500, timeout). Dùng khi debug backend hoặc gọi /api-bug-triage.
---

# Skill: Backend & API Bug Triage

## Quy trình
1. **Thu thập ngữ cảnh:** Đọc stack trace, HTTP status code (`400/401/403/500`), request payload và đoạn code liên quan.
2. **Truy vết Root Cause theo 4 lớp:**
   - Lớp Route/Middleware (auth, CORS, permission, body parser).
   - Lớp Validation & Logic (null/undefined, sai kiểu dữ liệu, async/await thiếu `try/catch`).
   - Lớp Database (sai tên cột, constraint/foreign key, deadlock, timezone).
   - Lớp Tích hợp ngoài (timeout, rate-limit, thay đổi format từ API bên thứ 3).
3. **Đề xuất bản vá tối thiểu (Minimal Diff):** Giữ nguyên cấu trúc và tương thích ngược, chỉ sửa đúng điểm gây lỗi.
4. **Ghi nhận:** Lưu ngắn gọn nguyên nhân gốc + cách sửa vào `.ai/logs/work/bugfix-history.md` và liệt kê 2–3 case cần test lại.