---
name: ui-state-check
description: Rà soát màn hình và component Frontend theo 4 trạng thái (Loading, Empty, Error, Success), an toàn Form, chống double-click và responsive. Dùng khi kiểm tra giao diện hoặc gọi /ui-state-check.
---

# Skill: Frontend UI State & UX Audit

## Checklist kiểm tra bắt buộc cho từng màn hình / component
1. **Đủ 4 trạng thái dữ liệu:**
   - `Loading`: Có skeleton hoặc spinner rõ ràng, không giật layout (layout shift).
   - `Empty`: Có thông báo thân thiện khi mảng rỗng (không để bảng trắng trơn).
   - `Error`: Hiển thị thông báo lỗi dễ hiểu kèm nút thử lại (`Retry`), không crash trắng trang.
   - `Success`: Hiển thị đúng định dạng ngày (`DD/MM/YYYY`), tiền tệ (phân cách hàng nghìn), text dài có `ellipsis` hoặc `wrap` hợp lý.
2. **An toàn Form & Hành động:**
   - Khóa nút Submit (`disabled` + trạng thái đang xử lý) khi đang gọi API để chống double-click tạo bản ghi trùng.
   - Validate ngay tại client (trường bắt buộc, định dạng email/số, độ dài tối đa) và hiển thị đúng lỗi trả về từ server.
   - Yêu cầu hộp thoại xác nhận (Confirm Modal) trước các thao tác xóa hoặc thay đổi không thể hoàn tác.
3. **Responsive & Khả năng truy cập:** Kiểm tra tràn ngang (`overflow-x`) ở màn hình nhỏ/bảng nhiều cột; các nút bấm có nhãn/tooltip rõ nghĩa.