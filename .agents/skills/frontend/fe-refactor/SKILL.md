---
name: fe-refactor
description: Tách logic và component Frontend tái sử dụng (đưa vào src/lib/portable/ nếu dùng đa dự án) nhưng giữ nguyên 100% giao diện, CSS và hành vi cũ. Dùng khi dọn code Frontend hoặc gọi /fe-refactor.
---

# Skill: Safe Frontend Refactor & Reusability

## Quy tắc cốt lõi
Giữ nguyên 100% giao diện, hành vi, class CSS/styling và props hiện có; không phá vỡ các màn hình khác đang dùng chung component.

## Quy trình
1. **Kiểm tra Registry:** Đọc `.ai/rules/reusable-registry.md` để xem đã có component/helper dùng chung chưa.
2. **Phân tách sạch:**
   - Tách logic xử lý dữ liệu (format, tính toán, validate, filter) ra khỏi file giao diện thành hàm thuần (pure function).
   - Nếu component/helper dùng được cho dự án khác (không dính API/store/text nghiệp vụ) → đưa vào `src/lib/portable/` theo `.ai/rules/coding-standards.md` và cập nhật `reusable-registry.md`.
3. **Tối ưu hiệu năng cơ bản:** Loại bỏ biến state dư thừa (có thể tính trực tiếp từ state/props có sẵn), tránh tạo lại hàm/object nặng trong vòng lặp render không cần thiết.
4. **Xác nhận:** Liệt kê rõ các file bị ảnh hưởng và 2–3 thao tác UI cần kiểm tra lại sau khi refactor.