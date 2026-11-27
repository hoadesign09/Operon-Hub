---
name: api-contract
description: Chuẩn hóa và xuất tài liệu Request/Response API. Dùng khi tạo hoặc sửa endpoint, đồng bộ contract giữa Backend và Frontend, hoặc gọi /api-contract.
---

# Skill: API Contract & Endpoint Audit

## Nhiệm vụ
Quét route/controller liên quan để chuẩn hóa cấu trúc Request/Response và cập nhật tài liệu API cho Frontend gọi không bị lệch field.

## Quy trình
1. **Đọc mã nguồn endpoint:** Xác định Method, URL, Middleware (auth/role/validation), Params, Query, Body và Response.
2. **Kiểm tra chuẩn REST & Tính nhất quán:**
   - Response thống nhất 1 cấu trúc chuẩn (vd: `{ success, data, message, meta }`).
   - Mã HTTP đúng ngữ nghĩa: `200/201` (OK), `400` (Validation), `401` (Chưa đăng nhập), `403` (Không có quyền), `404` (Không tìm thấy), `409` (Trùng dữ liệu), `500` (Lỗi server).
   - Không trả về dữ liệu nhạy cảm (`password`, `hash`, `token` nội bộ, stack trace).
3. **Kiểm tra tương thích ngược:** Nếu đổi tên hoặc xóa field trong Response, bắt buộc cảnh báo để Frontend cập nhật đồng bộ.
4. **Xuất tài liệu gọn:** Trình bày bảng gồm `Endpoint`, `Auth/Role`, `Request JSON mẫu`, `Response JSON mẫu (Success & Error)`.