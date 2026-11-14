# Kết quả kiểm thử đầu–cuối tiêu chuẩn production

Chạy lúc 09:57 11/11/2026 bằng `npm run test:production:bao-cao` (thư mục `e2e`) trên Chromium, gọi vào bản Docker vừa khởi tạo bằng init-master-data (chưa nạp dữ liệu demo).

**Tổng: 9 ca · Đạt: 9 · Không đạt: 0**

## Tiêu chuẩn production (dữ liệu gốc, chống trùng đồng thời, nhật ký, bảo mật, dữ liệu lạ) (9/9 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-SX-E01 | CORS: trang web lạ gọi API | 403 "Địa chỉ truy cập không được phép…"; giao diện chính thức gọi bình thường | Đạt |
| TC-SX-E02 | Admin khởi tạo đăng nhập bằng mật khẩu tạm | bị chuyển sang "Đổi mật khẩu tạm", không vào được trang Quản lý | Đạt |
| TC-SX-E03 | Mật khẩu mới yếu / xác nhận không khớp | báo lỗi tiếng Việt ngay trên biểu mẫu | Đạt |
| TC-SX-E04 | Bấm đúp nút "Đổi mật khẩu" | chỉ 1 yêu cầu được gửi; đổi thành công | Đạt |
| TC-SX-E05 | Thiết bị thứ hai còn giữ phiên cũ | bị đăng xuất, về trang đăng nhập kèm lý do "Phiên đăng nhập đã hết hiệu lực…" | Đạt |
| TC-SX-E06 | Mật khẩu tạm không dùng được nữa; mật khẩu mới đăng nhập thẳng vào Trang chủ |  | Đạt |
| TC-SX-E07 | Mất kết nối khi đăng nhập | "Không kết nối được máy chủ…"; máy chủ bảo trì (502 trang HTML) | Đạt |
| TC-SX-E08 | Dải cảnh báo "Mất kết nối mạng…" hiện khi thiết bị offline và tự ẩn khi có mạng lại |  | Đạt |
| TC-SX-E09 | Không có lỗi JavaScript nào trên mọi trang đã đi qua |  | Đạt |

