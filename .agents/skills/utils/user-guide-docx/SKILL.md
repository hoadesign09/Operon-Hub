---
name: user-guide-docx
description: Tự động mở Chrome thao tác theo luồng nghiệp vụ, chụp ảnh màn hình rõ nét và biên soạn thành file Word (.docx) hướng dẫn sử dụng hoàn chỉnh, trình bày sẵn trang bìa, bảng biểu, khung lưu ý và ảnh minh họa cho người dùng cuối.
---

# Skill: Biên soạn Tài liệu Hướng dẫn Sử dụng Chuẩn Doanh nghiệp (.docx)

## 1. Nguyên tắc viết cho Người dùng cuối (End-User Standards)
Tài liệu hướng tới nhân viên văn phòng / người vận hành không rành kỹ thuật. Bắt buộc tuân thủ:
1. **Không dùng thuật ngữ kỹ thuật:** Cấm viết các từ như `API`, `database`, `JSON`, `HTTP 500`, `payload`, `null`, `token`, `cache`. Thay bằng ngôn ngữ nghiệp vụ dễ hiểu (vd: thay *"API timeout"* bằng *"Hệ thống phản hồi chậm, vui lòng thử lại sau vài giây"*).
2. **In đậm chính xác tên nút & menu:** Bọc bằng `**...**` đúng nguyên văn nhãn hiển thị trên màn hình (vd: bấm nút **Tạo phiếu mới**, chọn menu **Quản lý trình ký** → **Chờ duyệt**). Script xuất Word sẽ tự chuyển `**...**` thành chữ in đậm.
3. **Cấu trúc 3 ý cho mỗi thao tác:** Luôn mô tả rõ: *(1) Truy cập ở đâu* → *(2) Nhập/chọn thông tin gì* → *(3) Kết quả nhìn thấy sau khi bấm*.
4. **Dữ liệu mẫu sạch khi chụp ảnh:** Chỉ thao tác trên môi trường Local/Dev (`_dev` DB), dùng dữ liệu tiếng Việt thực tế (vd: *Nguyễn Văn An*, *Đề xuất mua văn phòng phẩm tháng 11*). Cấm chụp màn hình chứa dữ liệu rác (`test123`, `asdf`, `lorem ipsum`) hoặc dữ liệu thật trên Production.

---

## 2. Cấu trúc chuẩn 6 Phần của Tài liệu Hướng dẫn Sử dụng
Trừ khi người dùng chỉ yêu cầu viết cho 1 chức năng nhỏ lẻ, mọi tài liệu HDSD đầy đủ đều tổ chức theo 6 phần sau:

1. **Trang bìa (Cover Page):** Tên hệ thống, tên phân hệ/tài liệu, phiên bản, ngày ban hành, đơn vị biên soạn, đối tượng áp dụng.
2. **Phần 1 — Giới thiệu chung & Phân quyền sử dụng:**
   - Mục đích của hệ thống/phân hệ.
   - Bảng phân quyền theo vai trò (`Vai trò` | `Phạm vi dữ liệu` | `Chức năng được phép thao tác`).
3. **Phần 2 — Hướng dẫn Truy cập & Đăng nhập:**
   - Trình duyệt khuyến nghị (Chrome/Edge), đường dẫn truy cập.
   - Các bước đăng nhập, đổi mật khẩu lần đầu và cách xử lý khi quên mật khẩu.
4. **Phần 3 — Tổng quan Giao diện chính:**
   - 1 ảnh chụp toàn màn hình sau khi đăng nhập.
   - Giải thích nhanh các khu vực: Thanh menu trái, Thanh tìm kiếm/thông báo trên cùng, Khu vực làm việc chính.
5. **Phần 4 — Hướng dẫn Thao tác Nghiệp vụ chi tiết:**
   - Chia từng mục nhỏ theo đúng luồng công việc thực tế:
     - *4.1. Xem danh sách, tìm kiếm & lọc dữ liệu*
     - *4.2. Tạo mới hồ sơ / phiếu (kèm Bảng giải thích các trường nhập liệu: Tên trường | Bắt buộc | Hướng dẫn nhập & Ví dụ)*
     - *4.3. Xem chi tiết, chỉnh sửa, hủy nháp / xóa*
     - *4.4. Quy trình gửi duyệt, phê duyệt / từ chối & theo dõi lịch sử*
     - *4.5. Xuất báo cáo Excel / In PDF*
   - Mỗi bước quan trọng đều có ảnh chụp màn hình + chú thích + `expectedResult` (Kết quả mong đợi) + hộp `callout` (Mẹo hoặc Lưu ý quan trọng).
6. **Phần 5 — Câu hỏi thường gặp (FAQ) & Xử lý lỗi cơ bản:**
   - Bảng 3 cột (`Tình huống / Thông báo` | `Nguyên nhân thường gặp` | `Cách tự xử lý`).
7. **Phần 6 — Thông tin Hỗ trợ Kỹ thuật:**
   - Kênh liên hệ IT Helpdesk (Email, số nội bộ, khung giờ hỗ trợ) và thông tin cần cung cấp khi báo lỗi (ảnh chụp màn hình, mã phiếu).

---

## 3. Quy trình Thực thi Bắt buộc (4 Bước)

### Bước 1: Chuẩn bị môi trường & Thư mục
- Tạo thư mục `docs/user-guide/<slug-tai-lieu>/screenshots/` nếu chưa tồn tại.
- Xác nhận ứng dụng đang chạy ở Local (`localhost`) và dùng dữ liệu mẫu sạch của DB `_dev`.

### Bước 2: Mở Chrome & Chụp ảnh tuần tự (Playwright MCP)
- Mở trình duyệt với khung hình chuẩn (`1366x768`), điều hướng tới URL ứng dụng bằng `browser_navigate`.
- Trước khi chụp mỗi ảnh:
  - Đợi tải xong hoàn toàn (không còn spinner loading, không còn khung skeleton).
  - Đóng các popup thông báo/toast thừa nếu không liên quan đến bước đang hướng dẫn.
  - Điền sẵn dữ liệu mẫu đẹp vào form trước khi chụp màn hình form nhập liệu.
- Gọi `browser_take_screenshot` lưu dạng `.png` vào thư mục `screenshots/` theo quy ước đánh số thứ tự:
  `01-dang-nhap.png`, `02-tong-quan.png`, `03-danh-sach.png`, `04-tao-moi.png`, `05-phe-duyet.png`, `06-xuat-bao-cao.png`.
- Chụp xong toàn bộ luồng thì đóng trình duyệt (`browser_close`).

### Bước 3: Soạn file JSON có cấu trúc (`content.json`)
Lưu tại `docs/user-guide/<slug-tai-lieu>/content.json` theo đúng schema định dạng sẵn dưới đây:

```json
{
  "cover": {
    "systemName": "HỆ THỐNG PORTAL NỘI BỘ OPERON HUB",
    "title": "TÀI LIỆU HƯỚNG DẪN SỬ DỤNG",
    "subtitle": "Phân hệ Quản lý Trình ký & Phê duyệt Nội bộ",
    "version": "1.0",
    "releaseDate": "28/11/2026",
    "author": "Phòng Công nghệ Thông tin",
    "audience": "Toàn thể Cán bộ Nhân viên, Trưởng bộ phận & Ban Giám đốc"
  },
  "headerText": "Operon Hub — Hướng dẫn sử dụng Phân hệ Trình ký",
  "footerText": "Tài liệu lưu hành nội bộ",
  "sections": [
    {
      "heading": "1. Giới thiệu chung & Phân quyền sử dụng",
      "description": "Phân hệ Trình ký giúp số hóa toàn bộ quy trình tạo đề xuất, đính kèm chứng từ và phê duyệt đa cấp trực tuyến.",
      "table": {
        "headers": ["Vai trò", "Phạm vi dữ liệu", "Quyền thao tác chính"],
        "rows": [
          ["Nhân viên", "Phiếu do mình tạo", "Tạo mới, lưu nháp, gửi duyệt, hủy phiếu nháp, theo dõi tiến độ"],
          ["Trưởng bộ phận", "Phiếu thuộc phòng ban", "Xem chi tiết, phê duyệt cấp 1, từ chối (kèm lý do), bình luận"],
          ["Ban Giám đốc", "Toàn công ty", "Phê duyệt cấp cuối, xem báo cáo tổng hợp và xuất Excel/PDF"]
        ]
      },
      "callout": {
        "type": "info",
        "title": "Khuyến nghị trình duyệt",
        "text": "Sử dụng **Google Chrome** hoặc **Microsoft Edge** phiên bản mới nhất trên máy tính để giao diện hiển thị đầy đủ nhất."
      }
    },
    {
      "heading": "2. Hướng dẫn Thao tác Nghiệp vụ",
      "steps": [
        {
          "title": "2.1. Tạo mới và gửi phiếu trình ký",
          "details": [
            "Tại thanh menu bên trái, chọn mục **Trình ký nội bộ** → bấm nút **+ Tạo phiếu mới** ở góc trên bên phải.",
            "Điền đầy đủ các thông tin vào biểu mẫu theo bảng hướng dẫn bên dưới và đính kèm tệp chứng từ (PDF, ảnh hoặc Excel).",
            "Bấm **Lưu nháp** nếu muốn chỉnh sửa sau, hoặc bấm **Gửi duyệt** để chuyển ngay cho Trưởng bộ phận."
          ],
          "fieldTable": {
            "headers": ["Tên trường", "Bắt buộc", "Hướng dẫn nhập & Ví dụ"],
            "rows": [
              ["Tiêu đề phiếu", "Có (*)", "Ghi ngắn gọn nội dung đề xuất. VD: Đề xuất mua thiết bị văn phòng tháng 11"],
              ["Loại đề xuất", "Có (*)", "Chọn đúng danh mục để hệ thống tự động gán đúng quy trình duyệt"],
              ["Tệp đính kèm", "Không", "Hỗ trợ PDF, PNG, JPG, XLSX. Dung lượng tối đa 10MB/tệp"]
            ]
          },
          "image": "screenshots/04-tao-moi.png",
          "caption": "Hình 2: Màn hình tạo mới phiếu trình ký với đầy đủ thông tin mẫu",
          "expectedResult": "Hệ thống hiển thị thông báo màu xanh **Gửi phiếu thành công**, tự động cấp mã phiếu và chuyển trạng thái sang **Chờ duyệt cấp 1**.",
          "callout": {
            "type": "warning",
            "title": "Lưu ý quan trọng",
            "text": "Sau khi bấm **Gửi duyệt**, bạn không thể tự chỉnh sửa nội dung phiếu. Nếu nhập sai, hãy bấm **Thu hồi** (khi cấp trên chưa duyệt) hoặc liên hệ người duyệt trả lại phiếu."
          }
        }
      ]
    },
    {
      "heading": "3. Câu hỏi thường gặp (FAQ) & Xử lý lỗi",
      "table": {
        "headers": ["Tình huống / Thông báo", "Nguyên nhân thường gặp", "Cách tự xử lý"],
        "rows": [
          ["Không thấy nút Phê duyệt", "Tài khoản chưa được phân quyền duyệt hoặc phiếu chưa tới lượt duyệt của bạn", "Kiểm tra lại trạng thái phiếu tại tab Lịch sử duyệt; liên hệ IT nếu sai vai trò"],
          ["Báo lỗi khi tải tệp lên", "Tệp vượt quá 10MB hoặc sai định dạng cho phép", "Nén nhỏ tệp PDF/ảnh xuống dưới 10MB và thử tải lại"]
        ]
      }
    }
  ]
}