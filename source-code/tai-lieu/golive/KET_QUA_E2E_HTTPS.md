# Kết quả kiểm thử HTTPS (Caddy)

Chạy lúc 09:58 11/11/2026 bằng `npm run test:https:bao-cao` (thư mục `e2e`), gọi vào bản Docker chạy sau Caddy.

**Tổng: 5 ca · Đạt: 5 · Không đạt: 0**

## Tiêu chuẩn production (dữ liệu gốc, chống trùng đồng thời, nhật ký, bảo mật, dữ liệu lạ) (5/5 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-SX-E10 | Chứng chỉ TLS hợp lệ cho đúng tên miền: chuỗi tin cậy, còn hạn (≥ 7 ngày với chứng chỉ công khai), TLS 1.2+, HTTP/2 |  | Đạt |
| TC-SX-E11 | Mở bằng http:// | tự chuyển vĩnh viễn (308) sang https:// giữ nguyên đường dẫn | Đạt |
| TC-SX-E12 | Phản hồi HTTPS có HSTS 1 năm, CSP tự nâng cấp HTTPS, không lộ phần mềm máy chủ, tệp giao diện được nén |  | Đạt |
| TC-SX-E13 | Sau proxy, ứng dụng ghi đúng IP người dùng và không bị giả mạo bằng header X-Forwarded-For |  | Đạt |
| TC-SX-E14 | Trình duyệt mở giao diện qua HTTPS, đăng nhập được; mọi yêu cầu đều là https://, không có nội dung hỗn hợp hay lỗi JavaScript |  | Đạt |

