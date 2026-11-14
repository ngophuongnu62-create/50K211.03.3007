# Tài khoản

## Bản production (vận hành thật)

Chỉ có **một** tài khoản Quản lý khởi tạo, được `init-master-data` tạo khi CSDL chưa có Quản lý nào:

| Tên đăng nhập | Mật khẩu | Ghi chú |
| --- | --- | --- |
| `admin` (đổi được qua `ADMIN_TEN_DANG_NHAP`) | Mật khẩu tạm ngẫu nhiên in **một lần** trong log khởi động (`docker compose logs app \| grep "Mật khẩu tạm"`), hoặc giá trị `ADMIN_MAT_KHAU_TAM` | Bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên (`mustChangePassword: true`) |

Giáo viên / trợ giảng do Quản lý thêm qua MH11 nhận mật khẩu tạm riêng và cũng bị bắt buộc đổi ở lần đăng nhập đầu.
Phụ huynh / học viên đăng nhập bằng họ tên học viên + số điện thoại (không mật khẩu, theo UC_1 BR04).

### Tài khoản MongoDB (không phải tài khoản người dùng)

| Tài khoản | Đặt ở `.env` | Dùng cho |
| --- | --- | --- |
| `quantri` (`MONGO_ROOT_USER`) | `MONGO_ROOT_PASSWORD` | Quản trị CSDL: bước thiết lập, sao lưu / khôi phục. Giữ bí mật, không cấp cho ứng dụng |
| `broadway_app` (`MONGO_APP_USER`) | `MONGO_APP_PASSWORD` | Ứng dụng web – không xóa được dữ liệu, nhật ký `audit_logs` chỉ đọc và thêm |

## Bản demo / UAT (dữ liệu mẫu)

Chỉ nạp bằng lệnh riêng ở môi trường development / UAT, khi CSDL chưa có dữ liệu nghiệp vụ:
`docker compose run --rm -e NODE_ENV=development thiet-lap-csdl node src/seed/seed-demo.js` (hoặc `npm run seed:demo` trong thư mục `backend`).
Lệnh tự từ chối trên production và từ chối khi CSDL đã có dữ liệu thật.
**Mật khẩu chung của mọi tài khoản nhân sự demo: `Broadway@2026`** (không bắt buộc đổi, để trình diễn).
Dữ liệu lịch dạy tính tương đối theo tuần nạp, nên luôn có lịch tuần này, tuần tới và các tình huống cần xử lý.

## Quản lý – cổng "Đăng nhập Quản lý"

| Tên đăng nhập | Họ tên | Gợi ý thử |
| --- | --- | --- |
| `quanly` | Trần Thu Trang | Trang chủ có cảnh báo xung đột; lớp IELTS 6.5 – K13 chưa có lịch (tạo lịch MH20); IELTS 6.5 – K12, TOEIC 650 – K06 ở trạng thái Nháp (phân công MH23); Kids Movers – K04 chờ phê duyệt, TOEIC 650 – K05 đã duyệt chờ phát hành (MH24); "Tạo lịch tuần mới" có 2 buổi bị ảnh hưởng (MH22) |
| `quanly2` | Lê Minh Hoàng | Quản lý thứ hai (thử thao tác đồng thời) |

## Giáo viên / Trợ giảng – cổng "Đăng nhập Giáo viên / Trợ giảng"

| Tên đăng nhập | Họ tên | Loại | Chuyên môn | Gợi ý thử |
| --- | --- | --- | --- | --- |
| `gvnguyenlan` | Nguyễn Thị Lan | Giáo viên – toàn thời gian | IELTS, Giao tiếp | Có ca dự kiến Giao tiếp B1 – K09 chờ phản hồi (còn khoảng 18 giờ); có yêu cầu đổi lịch đang chờ xử lý |
| `gvtranquan` | Trần Minh Quân | Giáo viên – bán thời gian | Giao tiếp | Dạy Giao tiếp A2 – K08; bận Thứ Tư tuần tới (bị ảnh hưởng ở lịch tuần) |
| `gvphamha` | Phạm Thu Hà | Giáo viên – toàn thời gian | IELTS, TOEIC | Dạy TOEIC 650 – K05; được đề xuất cho IELTS 6.5 – K12 |
| `gvvomai` | Võ Ngọc Mai | Giáo viên – toàn thời gian | Thiếu nhi, Giao tiếp | Dạy Kids Starters – K03, Kids Movers – K04 |
| `gvdavid` | David Miller | Giáo viên – bán thời gian | IELTS | |
| `gvmandy` | Mandy | Giáo viên – bán thời gian | Thiếu nhi | Dạy GS Milky – U15 |
| `gvhaley` | Haley | Giáo viên – bán thời gian | Thiếu nhi | Dạy GS Rabbit – U29 |
| `gvjohn` | John | Giáo viên – bán thời gian | Thiếu nhi, Giao tiếp | Được đề xuất dạy thay ở lịch tuần |
| `tgleanh` | Lê Hoàng Anh | Trợ giảng – toàn thời gian | Giao tiếp | Trợ giảng Giao tiếp A2 – K08 |
| `tgtyna` | Ty Na | Trợ giảng – bán thời gian | | Trợ giảng IELTS Foundation – K15 |
| `tgtuyetnhi` | Tuyết Nhi | Trợ giảng – bán thời gian | | Trợ giảng GS Milky – U15 |
| `tgnhuy` | Như Ý | Trợ giảng – bán thời gian | | |

## Phụ huynh / Học viên – cổng "Vào cổng Phụ huynh / Học viên" (không cần mật khẩu)

Nhập **Họ tên học viên** và **Số điện thoại** đã đăng ký (không phân biệt hoa thường, cho phép dấu cách trong số điện thoại).

| Họ tên học viên | Số điện thoại | Lớp đang học | Gợi ý thử |
| --- | --- | --- | --- |
| Nguyễn Minh An | 0905000456 | IELTS Foundation – K15, Giao tiếp A2 – K08, Giao tiếp B1 – K09 | Học nhiều lớp → màn hình Chọn lớp; có ca dự kiến cần xác nhận; có phiếu góp ý |
| Lê Văn Bình | 0934556778 | Giao tiếp A2 – K08, Giao tiếp B1 – K09 | Có phiếu đã được trả lời chính thức |
| Đỗ Thị Hằng | 0905667889 | Giao tiếp A2 – K08 | Học một lớp → vào thẳng Thời khóa biểu |
| Trần Gia Huy | 0912345001 | Kids Movers – K04, Kids Starters – K03 | Có ca dự kiến của Kids Movers – K04 |
| Phạm Bảo Ngọc | 0912345002 | Kids Movers – K04 | Đã xác nhận ca dự kiến |
| Hoàng Minh Khoa | 0912345003 | IELTS Foundation – K15 | |
| Vũ Thanh Tâm | 0912345004 | TOEIC 650 – K05 | |
| Bùi Anh Thư | 0912345005 | GS Milky – U15 | |
| Ngô Gia Bảo | 0912345006 | GS Rabbit – U29 | |
| Đặng Khánh Linh | 0912345007 | Kids Starters – K03 | |

## Lưu ý trước khi dùng thật

Tài khoản và dữ liệu trên dùng để nghiệm thu, trình diễn. Khi đưa vào vận hành thật cần nạp danh mục, lớp, nhân sự,
học viên thật của trung tâm và **không dùng chung mật khẩu mẫu**. Giáo viên mới thêm qua MH11 được hệ thống cấp mật khẩu tạm riêng.
