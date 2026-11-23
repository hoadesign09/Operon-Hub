---
name: api-integration
description: Nối API phía Frontend an toàn với defensive parsing (?./??), AbortController chống race condition, debounce tìm kiếm và chuẩn hóa lỗi 401/403. Dùng khi tích hợp API vào UI hoặc gọi /api-integration.
---

# Skill: Safe Frontend API Integration

## Quy trình
1. **Đối chiếu Contract:** Đọc response mẫu từ Backend (hoặc file định nghĩa type/schema) trước khi map dữ liệu lên UI.
2. **Truy xuất dữ liệu an toàn (Defensive Parsing):**
   - Dùng optional chaining (`?.`) và giá trị mặc định (`?? []`, `?? ''`, `?? 0`) khi đọc cấu trúc JSON lồng nhau (nested object/array).
   - Không giả định mảng luôn tồn tại hoặc có phần tử `[0]`.
3. **Quản lý vòng đời Request:**
   - Hủy request cũ (`AbortController`) hoặc bỏ qua kết quả trả về muộn khi người dùng đổi bộ lọc/chuyển trang nhanh (tránh race condition hiển thị sai dữ liệu).
   - Áp dụng `debounce` (300–500ms) cho ô tìm kiếm realtime.
4. **Chuẩn hóa xử lý lỗi:**
   - Bắt riêng lỗi `401` (hết phiên → điều hướng đăng nhập/refresh token), `403` (không đủ quyền), lỗi mạng (mất kết nối), và hiển thị message gọn cho người dùng.
5. **Tái sử dụng:** Tách hàm gọi API và hàm transform dữ liệu ra file service/helper riêng, không nhồi trực tiếp logic `fetch`/`axios` phức tạp vào trong UI component.