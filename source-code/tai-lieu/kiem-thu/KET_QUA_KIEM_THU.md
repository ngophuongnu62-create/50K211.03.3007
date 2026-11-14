# Kết quả kiểm thử nghiệp vụ và tiêu chuẩn production

Chạy lúc 09:32 11/11/2026 bằng `npm test` (thư mục `backend`). Đồng hồ hệ thống cố định ở 09:00 Thứ Tư 11/11/2026 (giờ Việt Nam), dữ liệu mẫu nạp lại trước mỗi nhóm.

**Tổng: 156 ca · Đạt: 156 · Không đạt: 0**

## Sai quyền (xác thực, phân quyền, cách ly dữ liệu) (26/26 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-PQ-01 | Gọi API Quản lý không kèm token | 401 "Vui lòng đăng nhập…" | Đạt |
| TC-PQ-02 | Gọi API Giáo viên và Phụ huynh không kèm token | 401 | Đạt |
| TC-PQ-03 | Token sai định dạng / không theo kiểu Bearer | 401 | Đạt |
| TC-PQ-04 | Token giả mạo vai trò Quản lý (ký bằng khóa khác) | 401 | Đạt |
| TC-PQ-05 | Token đã hết hạn | 401 | Đạt |
| TC-PQ-06 | Token hợp lệ nhưng tự khai vai trò Quản lý cho tài khoản Giáo viên | vẫn bị chặn 403 | Đạt |
| TC-PQ-07 | Token của tài khoản không còn tồn tại | 401 | Đạt |
| TC-PQ-08 | Đăng nhập tài khoản đang bị tạm khóa | 403 "Tài khoản đang bị tạm khóa…" | Đạt |
| TC-PQ-09 | Tài khoản bị khóa sau khi đã đăng nhập: token cũ không dùng được nữa | 403 | Đạt |
| TC-PQ-10 | Giáo viên gọi các chức năng của Quản lý (xem, thêm, sửa, duyệt) | 403 "Bạn không có quyền…" | Đạt |
| TC-PQ-11 | Trợ giảng gọi chức năng của Quản lý | 403; chức năng Giáo viên / Trợ giảng | Đạt |
| TC-PQ-12 | Phụ huynh / Học viên gọi API Quản lý, Giáo viên, danh mục nội bộ | 403 | Đạt |
| TC-PQ-13 | Quản lý gọi API riêng của Giáo viên và Phụ huynh | 403 | Đạt |
| TC-PQ-14 | Giáo viên gọi API Phụ huynh (xin nghỉ, xác nhận ca học) | 403 | Đạt |
| TC-PQ-15 | Giáo viên tải tệp lên chức năng thêm hồ sơ của Quản lý | 403 và không lưu tệp nào | Đạt |
| TC-PQ-16 | Giáo viên xem chi tiết lịch dạy của giáo viên khác | 404 "Lịch dạy không còn khả dụng!" | Đạt |
| TC-PQ-17 | Giáo viên chỉ thấy lịch dạy của chính mình (UC_7 BR01) |  | Đạt |
| TC-PQ-18 | Giáo viên xác nhận / đề xuất thay đổi ca dự kiến được phân công cho người khác | 404 | Đạt |
| TC-PQ-19 | Giáo viên gửi kèm mã nhân sự khác khi lưu lịch rảnh | chỉ lịch rảnh của chính mình thay đổi (UC_9 BR04) | Đạt |
| TC-PQ-20 | "Yêu cầu của tôi" và thông báo chỉ chứa dữ liệu của chính giáo viên |  | Đạt |
| TC-PQ-21 | Phụ huynh xem thời khóa biểu lớp học viên không theo học | 403 | Đạt |
| TC-PQ-22 | Phụ huynh xem chi tiết / xin nghỉ ca học của lớp khác | 404, không ghi nhận báo vắng | Đạt |
| TC-PQ-23 | Phụ huynh xác nhận ca dự kiến của lớp học viên không theo học | 404 | Đạt |
| TC-PQ-24 | Phụ huynh tra cứu phiếu phản hồi của học viên khác | 404 (UC_14) | Đạt |
| TC-PQ-25 | Phụ huynh chỉ thấy tiến độ công khai, không thấy ghi chú nội bộ của Quản lý (UC_14 BR02) |  | Đạt |
| TC-PQ-26 | Lịch sử phản hồi và lịch dự kiến của phụ huynh chỉ thuộc học viên trong phiên |  | Đạt |

## Nhập sai dữ liệu (41/41 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-DL-01 | Đăng nhập nhân sự bỏ trống mật khẩu | 400 "Vui lòng nhập đầy đủ…" | Đạt |
| TC-DL-02 | Đăng nhập sai mật khẩu | 401, không trả token | Đạt |
| TC-DL-03 | Chèn toán tử NoSQL vào tên đăng nhập / mật khẩu ({"$ne": null}) | không đăng nhập được | Đạt |
| TC-DL-04 | Phụ huynh nhập sai số điện thoại / chèn toán tử NoSQL | 401 "Thông tin…không đúng" | Đạt |
| TC-DL-05 | Gửi JSON hỏng cú pháp | 400 "Dữ liệu không hợp lệ" (không lỗi 500) | Đạt |
| TC-DL-06 | Tham số truy vấn chứa toán tử ($ne) khi tra cứu lịch dạy | 400, không thực thi điều kiện | Đạt |
| TC-DL-07 | Thân yêu cầu chứa toán tử ({"$ne": null}) khi kiểm tra giáo viên phân công | 400 | Đạt |
| TC-DL-08 | Ô tìm kiếm chứa ký tự đặc biệt của biểu thức chính quy "(*[" | 200, không lỗi máy chủ | Đạt |
| TC-DL-09 | Tìm phòng trống với ngày không tồn tại (31/02) hoặc trạng thái lạ | 400 (luồng 6.a) | Đạt |
| TC-DL-10 | Đăng ký phòng thiếu ca học / phòng không tồn tại / ca không tồn tại | 400 (BR3) | Đạt |
| TC-DL-11 | Đăng ký phòng cho ca đã kết thúc (hôm qua) | 400 | Đạt |
| TC-DL-12 | Thêm hồ sơ bỏ trống họ tên, SĐT, email, địa chỉ, bằng cấp | 400, báo lỗi từng trường (7b) | Đạt |
| TC-DL-13 | Email sai định dạng và SĐT không đủ 10 số | 400 với thông báo đúng từng trường (7a) | Đạt |
| TC-DL-14 | SĐT có chữ cái / bắt đầu khác 0 | 400 | Đạt |
| TC-DL-15 | SĐT hoặc email trùng với nhân sự khác | 409 (7c), hồ sơ không được tạo | Đạt |
| TC-DL-16 | Họ tên dài hơn 100 ký tự / loại nhân sự không hợp lệ | 400 | Đạt |
| TC-DL-17 | Ảnh bằng cấp sai loại tệp (PDF, TXT) | 400 "Tệp đính kèm không đúng định dạng…" | Đạt |
| TC-DL-18 | Tệp văn bản đổi đuôi thành .png (giả mạo ảnh) | 400, không lưu tệp | Đạt |
| TC-DL-19 | Dữ liệu sai thì ảnh vừa tải lên không bị lưu lại trên máy chủ |  | Đạt |
| TC-DL-20 | Sửa hồ sơ bỏ hết bằng cấp | 400 (Trình độ học vấn bắt buộc) | Đạt |
| TC-DL-21 | Cập nhật trạng thái phản hồi không chọn trạng thái / trạng thái lạ | 400 (7a) | Đạt |
| TC-DL-22 | Từ chối phản hồi không ghi lý do | 400 (7b); ghi chú 501 ký tự | Đạt |
| TC-DL-23 | Trả lời người gửi để trống / vượt 500 ký tự | 400 "Không được để trống!" | Đạt |
| TC-DL-24 | Giáo viên gửi yêu cầu thiếu loại, tiêu đề, nội dung | 400, báo "Không được để trống!" từng trường (5a) | Đạt |
| TC-DL-25 | Giáo viên gửi yêu cầu loại dành cho phụ huynh / nội dung 501 ký tự | 400 | Đạt |
| TC-DL-26 | Phụ huynh gửi ý kiến thiếu tiêu đề hoặc nội dung | 400 "Vui lòng nhập đầy đủ Tiêu đề và Nội dung…" (5a) | Đạt |
| TC-DL-27 | Phụ huynh gửi ý kiến với phân loại không có trong danh sách / nội dung 501 ký tự | 400 | Đạt |
| TC-DL-28 | Tệp minh chứng sai loại (.txt) / quá 5 tệp / lớn hơn 5 MB | 400 | Đạt |
| TC-DL-29 | Ý kiến thiếu nội dung kèm tệp minh chứng | 400 và tệp không bị lưu lại trên máy chủ | Đạt |
| TC-DL-30 | Tra cứu lịch dạy với ngày sai định dạng / ngày bắt đầu sau ngày kết thúc | 400 (BR05) | Đạt |
| TC-DL-31 | Đề xuất lịch khi chưa chọn lớp / lớp không tồn tại | 400 "Vui lòng chọn lớp học!" (3.a) | Đạt |
| TC-DL-32 | Đề xuất lịch với khoảng thời gian học ngược (từ ngày > đến ngày) | 400 | Đạt |
| TC-DL-33 | Lưu phương án thiếu ngày học / giờ học / phòng | 400, không tạo buổi nào | Đạt |
| TC-DL-34 | Xác nhận lịch tuần không có thay đổi nào / buổi bù thiếu thông tin | 400 | Đạt |
| TC-DL-35 | Giáo viên đề xuất thay đổi bỏ trống lý do | 400 "Không được để trống"; lý do 501 ký tự | Đạt |
| TC-DL-36 | Giáo viên đề xuất ca thay thế không tồn tại | 400, ca vẫn chờ phản hồi | Đạt |
| TC-DL-37 | Lưu lịch rảnh không chọn ca nào | 400 "Bạn phải chọn ít nhất 1 ca rảnh…" (5a) | Đạt |
| TC-DL-38 | Lưu lịch rảnh 5 ô nhưng có ô trùng nhau (thực chất 4 ca) | 400 "Bạn mới chọn 4 ca…" (BR02) | Đạt |
| TC-DL-39 | Lưu lịch rảnh có ca ngoài tuần kế tiếp / ca học không tồn tại | 400, lịch rảnh cũ giữ nguyên | Đạt |
| TC-DL-40 | Từ chối ca học dự kiến không nhập lý do | 400 "Vui lòng nhập lý do từ chối…"; 501 ký tự | Đạt |
| TC-DL-41 | Xin nghỉ không chọn lý do / lý do ngoài danh sách / ghi chú 501 ký tự | 400, không ghi nhận báo vắng | Đạt |

## Trùng lịch (30/30 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-TL-01 | Kiểm tra phòng đang có lớp học (P.102 Thứ Hai 16/11 Ca 2) | 409 "Phòng học không còn trống…" (5.a) | Đạt |
| TC-TL-02 | Đăng ký phòng đã có đăng ký khác (P.202 Thứ Năm 12/11 Ca 3) | 409, không tạo bản ghi mới | Đạt |
| TC-TL-03 | Đăng ký phòng trùng buổi của lịch còn ở trạng thái Nháp (IE65-K12, P.202 Thứ Ba 17/11 Ca 3) | 409 | Đạt |
| TC-TL-04 | 5 yêu cầu đăng ký cùng phòng, cùng ca gửi đồng thời | chỉ 1 thành công, 4 bị từ chối 409 | Đạt |
| TC-TL-05 | Hủy đăng ký rồi đăng ký lại đúng phòng, ca đó | 201 (đăng ký đã hủy không giữ chỗ) | Đạt |
| TC-TL-06 | Mọi phương án hệ thống đề xuất đều có phòng trống và giáo viên đúng chuyên môn rảnh (BR01) |  | Đạt |
| TC-TL-07 | Sửa phương án sang phòng đang có lớp (P.201 Thứ 3, 5 Ca 3) | 409 "Thời gian hoặc phòng học bị trùng" (7.b) | Đạt |
| TC-TL-08 | Sửa phương án sang phòng không đủ sức chứa (P3, 15 chỗ cho lớp 18 học viên) | 409 | Đạt |
| TC-TL-09 | Sửa phương án vào ca không giáo viên IELTS nào rảnh (Chủ Nhật Ca 2) | 409 | Đạt |
| TC-TL-10 | Lưu phương án trùng phòng (bỏ qua bước kiểm tra) | 409, không tạo buổi dạy nào | Đạt |
| TC-TL-11 | Hai Quản lý cùng lưu lịch cho một lớp cùng lúc | 1 thành công, 1 bị từ chối; lớp không có buổi trùng | Đạt |
| TC-TL-12 | Danh sách đề xuất không chứa giáo viên đã có lịch dạy cùng ca (Lan dạy IEF-K15 Thứ 3, 5 Ca 3) |  | Đạt |
| TC-TL-13 | Chọn ngoài đề xuất giáo viên trùng lịch (Lan) | 409 "Cảnh báo xung đột lịch dạy…" (4.a.8) | Đạt |
| TC-TL-14 | Cố lưu phân công giáo viên trùng lịch (bỏ qua bước kiểm tra) | 409, lịch vẫn ở trạng thái Nháp | Đạt |
| TC-TL-15 | Phân công giáo viên sai chuyên môn (Quân – Giao tiếp, cho lớp IELTS) | 409 | Đạt |
| TC-TL-16 | Phân công giáo viên đúng chuyên môn nhưng không có lịch rảnh ca đó (Hà – TOEIC-K06 Ca 2) | 409 | Đạt |
| TC-TL-17 | Phân công trợ giảng vào vai trò giáo viên (Lê Hoàng Anh) | 409 | Đạt |
| TC-TL-18 | Phân công giáo viên phù hợp (David Miller) | 200, lịch chuyển "Chờ GV xác nhận" | Đạt |
| TC-TL-19 | Hệ thống phát hiện buổi bị ảnh hưởng: P.101 Chủ Nhật 22/11 Ca 2 trùng đăng ký sự kiện; GV Quân bận Thứ Tư 18/11 |  | Đạt |
| TC-TL-20 | Xác nhận lịch tuần nhưng giữ phòng đang bị đăng ký sự kiện | 409 "Lịch tuần bị xung đột!" (10a) | Đạt |
| TC-TL-21 | Đổi ca buổi học sang phòng đang có lớp khác (P.302 Thứ Tư Ca 3 – GS Milky) | 409 | Đạt |
| TC-TL-22 | Thêm buổi bù với giáo viên đang dạy lớp khác cùng ca (Lan, Thứ Ba 17/11 Ca 3) | 409 | Đạt |
| TC-TL-23 | Thêm buổi bù trùng đúng ca học sẵn có của chính lớp đó | 409 | Đạt |
| TC-TL-24 | Đổi giáo viên sang người sai chuyên môn (Mandy – Thiếu nhi cho lớp Giao tiếp) | 409 | Đạt |
| TC-TL-25 | Sau các lần bị từ chối, dữ liệu lịch tuần không bị thay đổi (BR06) |  | Đạt |
| TC-TL-26 | Chọn giáo viên, phòng theo đề xuất của hệ thống | 200, các buổi chuyển "Chờ GV xác nhận" | Đạt |
| TC-TL-27 | Chèn trực tiếp vào CSDL buổi dạy trùng phòng–ngày–ca (bỏ qua API) | bị chỉ mục UX_LichDay_Phong chặn | Đạt |
| TC-TL-28 | Chèn trực tiếp vào CSDL buổi học trùng lớp–ngày–ca ở phòng khác | bị chỉ mục UX_LichDay_Lop chặn | Đạt |
| TC-TL-29 | Chèn trực tiếp hai đăng ký phòng còn hiệu lực cùng phòng–ngày–ca | bị chỉ mục UX_DangKyPhong chặn | Đạt |
| TC-TL-30 | Trang chủ Quản lý cảnh báo xung đột lịch dạy (trùng phòng P.101, sai lịch rảnh GV Quân) |  | Đạt |

## Thời hạn và xin nghỉ trễ (27/27 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-TH-01 | Xin nghỉ lúc 09:00 cho ca 13:30 cùng ngày (trước 4 giờ 30 phút) | 201, ca chuyển "Báo vắng" | Đạt |
| TC-TH-02 | Xin nghỉ đúng 11:30 (vừa tròn 02 tiếng trước giờ học) | 201 (BR01 "tối thiểu 02 tiếng") | Đạt |
| TC-TH-03 | Xin nghỉ lúc 11:31 (còn 1 giờ 59 phút) | 422 "Đơn xin nghỉ phải được gửi trước giờ học tối thiểu 02 tiếng…" (5a) | Đạt |
| TC-TH-04 | Mở chi tiết ca lúc 12:00 | nút "Xin nghỉ ca này" bị khóa và kèm lý do | Đạt |
| TC-TH-05 | Xin nghỉ đúng 13:30 (ca vừa bắt đầu) | 422 "Không thể báo vắng cho ca học đã hoặc đang diễn ra…" (1a) | Đạt |
| TC-TH-06 | Xin nghỉ lúc 15:00 (ca đang diễn ra) và cho ca của tuần trước | 422 (1a) | Đạt |
| TC-TH-07 | Gửi đơn xin nghỉ lần thứ hai cho cùng ca | 409, không ghi trùng | Đạt |
| TC-TH-08 | Gửi đồng thời 3 đơn xin nghỉ cùng ca của cùng học viên | chỉ 1 được ghi nhận | Đạt |
| TC-TH-09 | Xin nghỉ ca thuộc lịch chưa phát hành (GT-B1-09 đang chờ xác nhận) | 404 | Đạt |
| TC-TH-10 | Xác nhận lúc 02:59 ngày 12/11 (còn 1 phút trước hạn) | 200 | Đạt |
| TC-TH-11 | Phản hồi lại ca đã xác nhận | 409 (mỗi ca chỉ phản hồi một lần) | Đạt |
| TC-TH-12 | Xác nhận đúng 03:00 ngày 12/11 (tròn 24 giờ) | 403 "Đã quá thời hạn gửi phản hồi" (BR03) | Đạt |
| TC-TH-13 | Đề xuất thay đổi sau hạn 24 giờ | 403, không lưu đề xuất | Đạt |
| TC-TH-14 | Sau hạn: danh sách "Phản hồi lịch dạy" không còn ca này; chi tiết ca báo quá hạn và khóa phản hồi |  | Đạt |
| TC-TH-15 | Xác nhận ca học trong hạn | 200; xác nhận lại cùng ca | Đạt |
| TC-TH-16 | Từ chối lúc 02:59 ngày 12/11 | 200; trạng thái "Từ chối xác nhận" chuyển về Quản lý | Đạt |
| TC-TH-17 | Xác nhận, từ chối, xác nhận tất cả đúng 03:00 ngày 12/11 (tròn 24 giờ) | 403 "Đã quá thời hạn phản hồi lịch học" (BR03) | Đạt |
| TC-TH-18 | Sau hạn, màn hình lịch dự kiến hiển thị "Đã quá thời hạn…" và khóa toàn bộ ca chưa phản hồi |  | Đạt |
| TC-TH-19 | Lưu lịch rảnh lúc 07:59 Thứ Hai (cổng chưa mở) | 403 "Hệ thống đã đóng cổng đăng ký…" (4b) | Đạt |
| TC-TH-20 | Lưu lịch rảnh đúng 08:00 Thứ Hai (cổng vừa mở) | 200 | Đạt |
| TC-TH-21 | Lưu lịch rảnh lúc 23:59 Thứ Năm (phút cuối của cổng) | 200 | Đạt |
| TC-TH-22 | Lưu lịch rảnh lúc 00:00 Thứ Sáu, Thứ Bảy, Chủ Nhật (cổng đã đóng) | 403, lịch rảnh đã lưu giữ nguyên | Đạt |
| TC-TH-23 | Trang chủ giáo viên chỉ hiện nhắc việc cổng lịch rảnh khi cổng đang mở |  | Đạt |
| TC-TH-24 | Hủy đăng ký phòng khi đã đến giờ sử dụng (P.202 Thứ Năm 12/11 Ca 3, lúc 18:00) | 422 (8.a) | Đạt |
| TC-TH-25 | Hủy đăng ký phòng trước giờ sử dụng 1 phút (17:29) | 200; hủy lần hai | Đạt |
| TC-TH-26 | Lập lịch tuần: thêm buổi bù ngoài tuần tới (sau 22/11) | 400 (BR01 chỉ xử lý tuần tới) | Đạt |
| TC-TH-27 | Phát hành lịch chưa được phê duyệt (Kids-K04 đang chờ) | 409; phê duyệt lịch giáo viên chưa xác nhận (GT-B1-09) | Đạt |

## Xác thực MongoDB và vai trò chỉ ghi nhật ký (MongoDB bật xác thực) (7/7 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-CSDL-01 | Kết nối không đăng nhập | MongoDB từ chối mọi thao tác (đã bật xác thực) | Đạt |
| TC-CSDL-02 | Ứng dụng khởi động khi CSDL chưa được thiết lập | báo rõ cần chạy bước thiết lập | Đạt |
| TC-CSDL-03 | Tài khoản quản trị chạy bước thiết lập trên CSDL trống: tạo đủ collection, vai trò broadwayApp, tài khoản ứng dụng; chạy lại lần 2 vẫn thành công |  | Đạt |
| TC-CSDL-04 | Tài khoản ứng dụng: đăng nhập được, trên audit_logs chỉ có quyền đọc và thêm |  | Đạt |
| TC-CSDL-05 | Ứng dụng chạy nghiệp vụ thật bằng tài khoản hạn chế: đăng nhập, phân công (giao dịch + khóa + nhật ký), init-master-data |  | Đạt |
| TC-CSDL-06 | Tài khoản ứng dụng đi thẳng driver (bỏ qua Mongoose) cũng KHÔNG sửa / xóa / làm mất được nhật ký |  | Đạt |
| TC-CSDL-07 | Tài khoản ứng dụng không xóa được dữ liệu nghiệp vụ, không đổi cấu trúc, không tự nâng quyền |  | Đạt |

## Tiêu chuẩn production (dữ liệu gốc, chống trùng đồng thời, nhật ký, bảo mật, dữ liệu lạ) (25/25 đạt)

| Mã | Kịch bản | Kết quả mong đợi | Kết quả |
| --- | --- | --- | --- |
| TC-SX-01 | Phân công cùng một giáo viên vào 2 lớp trùng ca (IE65-K12 và IE65-K13, Thứ 3–5 Ca 3) gửi đồng thời | đúng 1 thành công | Đạt |
| TC-SX-02 | Phân công cùng một trợ giảng vào 2 lớp trùng ca gửi đồng thời | đúng 1 thành công | Đạt |
| TC-SX-03 | Hai Quản lý cùng gán 2 trợ giảng khác nhau cho một lớp | mỗi buổi chỉ có đúng 1 trợ giảng | Đạt |
| TC-SX-04 | CSDL từ chối buổi dạy có 2 trợ giảng hoặc 1 nhân sự xuất hiện 2 lần (bỏ qua API) |  | Đạt |
| TC-SX-05 | Chèn trực tiếp buổi dạy khiến giáo viên dạy 2 lớp cùng ngày–ca | chỉ mục UX_LichDay_NhanSu chặn | Đạt |
| TC-SX-06 | Đăng ký phòng P.401 và lưu lịch lớp IE65-K13 vào P.401 cùng ngày–ca gửi đồng thời | đúng 1 thành công, không trùng phòng | Đạt |
| TC-SX-07 | Hai Quản lý cùng hủy một đăng ký phòng | 1 thành công, 1 nhận 422 (không lỗi 500) | Đạt |
| TC-SX-08 | Hai Quản lý cùng chuyển 2 buổi khác nhau vào cùng phòng–ca khi lập lịch tuần | đúng 1 thành công | Đạt |
| TC-SX-09 | Phân công giáo viên ghi nhật ký: người thực hiện, thời điểm, hành động, dữ liệu cũ và mới, mã yêu cầu |  | Đạt |
| TC-SX-10 | Thao tác bị từ chối (409) không để lại nhật ký – nhật ký và dữ liệu cùng được ghi hoặc cùng hủy |  | Đạt |
| TC-SX-11 | Tạo / hủy đăng ký phòng, xin nghỉ, từ chối yêu cầu, lưu lịch rảnh đều được ghi nhật ký |  | Đạt |
| TC-SX-12 | Nhật ký không thể bị sửa hay xóa qua ứng dụng |  | Đạt |
| TC-SX-13 | Thêm hồ sơ giáo viên ghi nhật ký nhưng tuyệt đối không lưu mật khẩu (kể cả dạng băm) |  | Đạt |
| TC-SX-14 | Quản lý tra cứu nhật ký theo hành động, có phân trang; Giáo viên không được xem (403) |  | Đạt |
| TC-SX-15 | CORS: chỉ tên miền giao diện khai báo được gọi API; tên miền lạ | 403; không có Origin vẫn dùng được | Đạt |
| TC-SX-16 | Chống dò mật khẩu: sai quá ngưỡng | 429 tiếng Việt; tài khoản khác và lần đăng nhập đúng không bị tính | Đạt |
| TC-SX-17 | Chặn spam API: vượt số yêu cầu / phút | 429 "Bạn thao tác quá nhanh…"; kiểm tra sức khỏe không bị chặn | Đạt |
| TC-SX-18 | Tài khoản mới cấp phải đổi mật khẩu tạm ở lần đăng nhập đầu; token cũ bị vô hiệu sau khi đổi |  | Đạt |
| TC-SX-19 | Phụ huynh không có chức năng đổi mật khẩu (403) |  | Đạt |
| TC-SX-20 | Cấu hình production thiếu / yếu (MongoDB không xác thực, JWT ngắn, CORS "*", tắt giới hạn tần suất, giờ giả lập) | từ chối khởi động | Đạt |
| TC-SX-21 | Chạy init-master-data trên CSDL đang có dữ liệu: không xóa, không ghi đè, không tạo thêm gì |  | Đạt |
| TC-SX-22 | CSDL chưa có Quản lý: tạo đúng 1 tài khoản Admin với mustChangePassword = true; chạy lại không tạo thêm |  | Đạt |
| TC-SX-23 | Nạp dữ liệu demo bị từ chối khi CSDL đã có dữ liệu thật (không có dấu hiệu dữ liệu demo) |  | Đạt |
| TC-SX-24 | Mọi API × dữ liệu rác (JSON hỏng, toán tử $, kiểu sai, chuỗi rất dài, ngày sai) | không có phản hồi 5xx | Đạt |
| TC-SX-25 | JSON hỏng | 400 tiếng Việt; thân yêu cầu quá lớn | Đạt |

