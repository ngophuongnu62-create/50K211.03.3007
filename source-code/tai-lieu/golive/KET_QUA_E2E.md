# Kết quả kiểm thử đầu–cuối trên bản triển khai (Ưu tiên 4)

Chạy lúc 09:57 11/11/2026 bằng `npm run test:bao-cao` (thư mục `e2e`) trên trình duyệt Chromium, gọi vào bản production chạy bằng Docker Compose.

**Tổng: 24 ca · Đạt: 24 · Không đạt: 0**

## Quản lý (trình duyệt) (7/7 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-QL-01 | Quản lý đăng nhập sai mật khẩu | báo "Tên đăng nhập hoặc mật khẩu không chính xác…" | Đạt |
| TC-QL-02 | Quản lý đăng nhập đúng | Trang chủ "Xin chào, Trần Thu Trang" kèm cảnh báo xung đột | Đạt |
| TC-QL-03 | Tạo lịch dạy mới cho IELTS 6.5 – K13: đề xuất phương án, lưu | "Tạo lịch dạy thành công!", lịch ở trạng thái Nháp | Đạt |
| TC-QL-04 | Phân công giáo viên đề xuất cho IELTS 6.5 – K12 và gửi thông báo | "Gửi phân công lịch dạy thành công!" | Đạt |
| TC-QL-05 | Phê duyệt rồi phát hành lịch Kids Movers – K04 | "Phát hành lịch dạy thành công!", gửi thông báo chính thức | Đạt |
| TC-QL-06 | Tra cứu lịch dạy với khoảng ngày ngược | báo "Ngày bắt đầu không được lớn hơn ngày kết thúc"; mở chi tiết một lịch | Đạt |
| TC-QL-07 | Quản lý thấy phiếu mới trong "Phản hồi & yêu cầu", cập nhật "Đang xử lý" | "Cập nhật trạng thái thành công!" | Đạt |

## Giáo viên / Trợ giảng (trình duyệt) (4/4 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-GV-01 | Giáo viên Phạm Thu Hà nhận lịch vừa phân công và xác nhận | "Đã xác nhận thành công" | Đạt |
| TC-GV-02 | Giáo viên Nguyễn Thị Lan đề xuất thay đổi bỏ trống lý do | "Không được để trống"; nhập lý do | Đạt |
| TC-GV-03 | Cập nhật lịch rảnh: chọn 3 ca | "Bạn mới chọn 3 ca…"; chọn đủ 5 ca | Đạt |
| TC-GV-04 | Chuyển ngôn ngữ sang EN | menu hiển thị tiếng Anh ("My schedule") | Đạt |

## Phụ huynh / Học viên (trình duyệt) (7/7 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-PH-01 | Phụ huynh nhập sai số điện thoại | báo "Thông tin Tên học viên hoặc Số điện thoại không chính xác…" | Đạt |
| TC-PH-02 | Học viên học 3 lớp đăng nhập | màn hình Chọn lớp | Đạt |
| TC-PH-03 | Xin nghỉ một ca tuần sau | "Gửi yêu cầu xin nghỉ thành công", ca hiển thị "Báo vắng" | Đạt |
| TC-PH-04 | Xác nhận một ca học dự kiến | thành công; từ chối ca khác bỏ trống lý do | Đạt |
| TC-PH-05 | Gửi ý kiến kèm ảnh minh chứng | "Gửi thành công" kèm mã phiếu | Đạt |
| TC-PH-06 | Phụ huynh tra cứu lại mã phiếu | tiến độ đồng bộ "Đang xử lý", không lộ ghi chú nội bộ của Quản lý | Đạt |
| TC-PH-07 | Bấm "Đổi học viên" | về trang đăng nhập; mở lại thời khóa biểu | Đạt |

## Hệ thống, phân quyền giao diện, vận hành (6/6 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-HT-01 | Mở địa chỉ triển khai: trang chọn đối tượng hiển thị đủ 3 cổng | Phụ huynh / Học viên, Quản lý, Giáo viên / Trợ giảng | Đạt |
| TC-HT-02 | Mở thẳng đường dẫn sâu /quan-ly/quan-ly-lich khi chưa đăng nhập | chuyển về trang đăng nhập Quản lý | Đạt |
| TC-HT-03 | API không tồn tại trả JSON 404; kiểm tra sức khỏe (máy chủ + CSDL) trả "ok" |  | Đạt |
| TC-HT-04 | Giáo viên mở trang của Quản lý (/quan-ly/ho-so-giao-vien) | bị chuyển về Trang chủ Giáo viên | Đạt |
| TC-HT-05 | Quản lý đăng xuất | về trang chọn đối tượng; quay lại trang quản lý | Đạt |
| TC-HT-06 | Không có lỗi JavaScript nào trên mọi trang đã đi qua |  | Đạt |

