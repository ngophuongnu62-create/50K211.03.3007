# Kết quả kiểm tra bộ dữ liệu thử

Sinh và kiểm tra tự động bằng `npm run sinh-du-lieu-thu` (thư mục `backend`). Thời điểm "hiện tại" của bộ dữ liệu: **Thứ Bảy, 14/11/2026 lúc 06:54**.

**Kiểm tra logic: 21/21 quy tắc đạt · Gọi thử API thật: 109/109 đạt**

Toàn bộ dữ liệu được ghi qua model của hệ thống vào MongoDB tạm, nên đồng thời đã qua: kiểm tra kiểu / bắt buộc / giá trị liệt kê
của Mongoose, `$jsonSchema` của CSDL, và các chỉ mục duy nhất chống trùng phòng (`UX_LichDay_Phong`), trùng lớp (`UX_LichDay_Lop`),
trùng giáo viên / trợ giảng (`UX_LichDay_NhanSu`), trùng đăng ký phòng (`UX_DangKyPhong`).

## Quy tắc logic

| # | Quy tắc | Số mục kiểm | Kết quả |
| --- | --- | --- | --- |
| 1 | Sĩ số lớp bằng số học viên được gán vào lớp | 12 | Đạt |
| 2 | Phòng của mọi buổi học đủ sức chứa sĩ số lớp | 184 | Đạt |
| 3 | Số buổi còn hiệu lực × số tiết mỗi buổi = tổng số tiết của lớp | 11 | Đạt |
| 4 | Mọi buổi học nằm trong thời gian khóa học | 185 | Đạt |
| 5 | Trạng thái lớp khớp ngày học (Kết thúc / Đang học / Chưa mở) | 12 | Đạt |
| 6 | Không trùng phòng, trùng lớp, trùng giáo viên / trợ giảng (kể cả với đăng ký phòng) | 192 | Đạt |
| 7 | Giáo viên được phân công đúng chuyên môn môn học của lớp | 184 | Đạt |
| 8 | Mỗi buổi tối đa 1 giáo viên + 1 trợ giảng; vai trò khớp loại nhân sự | 184 | Đạt |
| 9 | Lịch rảnh mỗi tuần ≥ 5 ca, cập nhật trong khung Thứ Hai 08:00 – Thứ Năm 23:59 của tuần trước | 144 | Đạt |
| 10 | Buổi được phân công nằm trong lịch rảnh đã đăng ký (trừ tình huống nghỉ phép cài sẵn) | 184 | Đạt |
| 11 | Trạng thái lịch khớp phân công; giáo viên phản hồi trong 24 giờ sau khi gửi | 185 | Đạt |
| 12 | Lịch sử thao tác đúng thứ tự (Tạo → Phân công → Gửi dự kiến → Phê duyệt → Phát hành) và trước giờ học | 185 | Đạt |
| 13 | Xác nhận / từ chối ca học: đúng học viên của lớp, trong 24 giờ sau khi gửi, trước thời điểm hiện tại | 1857 | Đạt |
| 14 | Báo vắng: buổi đã phát hành, đúng học viên, gửi trước giờ học ≥ 2 tiếng, sau khi phát hành | 33 | Đạt |
| 15 | Học viên học nhiều lớp không có hai buổi trùng ngày–ca | 170 | Đạt |
| 16 | Phiếu phản hồi: loại phiếu đúng nhóm người gửi; lịch sử xử lý đúng chuỗi trạng thái và thời gian | 12 | Đạt |
| 17 | Thông báo: người nhận tồn tại, đã gửi trước thời điểm hiện tại | 836 | Đạt |
| 18 | Đăng ký phòng: đăng ký trước giờ sử dụng; hủy trước giờ sử dụng | 8 | Đạt |
| 19 | Tên đăng nhập, email, số điện thoại nhân sự không trùng nhau; học viên trùng số chỉ khi là anh chị em | 184 | Đạt |
| 20 | Mọi ảnh bằng cấp / tệp minh chứng có thật trong kho tệp (GridFS) | 18 | Đạt |
| 21 | Bộ đếm mã tự sinh ≥ mã lớn nhất đang dùng (mã tạo mới sau khi nhập không bị trùng) | 8 | Đạt |

## Tình huống thật được cài sẵn để thử chức năng cảnh báo

- **Sai lịch rảnh**: Trần Minh Quân (GV-002) xin nghỉ phép Thứ Tư 18/11 (phiếu NghiPhep) và đã bỏ ca Thứ Tư Ca 2 khỏi lịch rảnh tuần tới lúc 11/11 10:05 – trong khung đăng ký. Buổi Giao tiếp A2 – K08 ngày đó cần giáo viên dạy thay (John – GV-008 – rảnh và đúng chuyên môn).

Trang chủ Quản lý hiện **4 cảnh báo** – đều từ tình huống trên:
- Sai lịch rảnh: Trần Minh Quân · Thứ Tư 18/11 · Ca 2
- Sai lịch rảnh: Trần Minh Quân · Thứ Tư 25/11 · Ca 2
- Sai lịch rảnh: Trần Minh Quân · Thứ Tư 02/12 · Ca 2
- Sai lịch rảnh: Trần Minh Quân · Thứ Tư 09/12 · Ca 2

Vì các tuần sau chưa mở cổng đăng ký lịch rảnh, hệ thống tạm dùng mẫu lịch rảnh của tuần gần nhất cho các tuần đó, nên cảnh báo
lặp lại ở các Thứ Tư tiếp theo trong 28 ngày tới cho tới khi giáo viên đăng ký lịch rảnh các tuần đó.

## Gọi thử API thật trên bộ dữ liệu

| Kiểm tra | Kết quả |
| --- | --- |
| Quản lý đăng nhập | Đạt |
| Trang chủ Quản lý (MH04) | Đạt |
| Quản lý lịch dạy (MH19) | Đạt |
| Lớp chưa có lịch (MH20) có IE65-K13 | Đạt |
| Đề xuất phương án lịch cho IE65-K13 | Đạt |
| Phân công IELTS 6.5 – K12: có giáo viên đề xuất (MH23) | Đạt |
| Phân công TOEIC 650 – K06: có giáo viên đề xuất | Đạt |
| Kids Movers – K04 đủ điều kiện phê duyệt (MH24) | Đạt |
| Lịch tuần tới (MH22): buổi bị ảnh hưởng do GV nghỉ phép | Đạt |
| Tra cứu lịch dạy (MH17) | Đạt |
| Phòng trống hôm nay (MH05) | Đạt |
| Danh sách đăng ký phòng (MH08) | Đạt |
| Hồ sơ giáo viên (MH09) | Đạt |
| Chi tiết hồ sơ Nguyễn Thị Lan (MH10) | Đạt |
| Ảnh bằng cấp "Cử nhân Ngôn ngữ Anh – ĐH Ngoại ngữ Đà Nẵng" hiển thị được | Đạt |
| Ảnh bằng cấp "IELTS Academic 8.0 – IDP · 2025" hiển thị được | Đạt |
| Phản hồi & yêu cầu (MH13) | Đạt |
| gvnguyenlan: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvnguyenlan: lịch dạy | Đạt |
| gvnguyenlan: ca dự kiến | Đạt |
| Nguyễn Thị Lan có 12 ca Giao tiếp B1 – K09 chờ phản hồi | Đạt |
| gvnguyenlan: lịch rảnh | Đạt |
| gvnguyenlan: yêu cầu đã gửi | Đạt |
| gvtranquan: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvtranquan: lịch dạy | Đạt |
| gvtranquan: ca dự kiến | Đạt |
| gvtranquan: lịch rảnh | Đạt |
| gvtranquan: yêu cầu đã gửi | Đạt |
| gvphamha: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvphamha: lịch dạy | Đạt |
| gvphamha: ca dự kiến | Đạt |
| gvphamha: lịch rảnh | Đạt |
| gvphamha: yêu cầu đã gửi | Đạt |
| gvvomai: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvvomai: lịch dạy | Đạt |
| gvvomai: ca dự kiến | Đạt |
| gvvomai: lịch rảnh | Đạt |
| gvvomai: yêu cầu đã gửi | Đạt |
| gvdavid: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvdavid: lịch dạy | Đạt |
| gvdavid: ca dự kiến | Đạt |
| gvdavid: lịch rảnh | Đạt |
| gvdavid: yêu cầu đã gửi | Đạt |
| gvmandy: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvmandy: lịch dạy | Đạt |
| gvmandy: ca dự kiến | Đạt |
| gvmandy: lịch rảnh | Đạt |
| gvmandy: yêu cầu đã gửi | Đạt |
| gvhaley: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvhaley: lịch dạy | Đạt |
| gvhaley: ca dự kiến | Đạt |
| gvhaley: lịch rảnh | Đạt |
| gvhaley: yêu cầu đã gửi | Đạt |
| gvjohn: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| gvjohn: lịch dạy | Đạt |
| gvjohn: ca dự kiến | Đạt |
| gvjohn: lịch rảnh | Đạt |
| gvjohn: yêu cầu đã gửi | Đạt |
| tgleanh: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| tgleanh: lịch dạy | Đạt |
| tgleanh: ca dự kiến | Đạt |
| tgleanh: lịch rảnh | Đạt |
| tgleanh: yêu cầu đã gửi | Đạt |
| tgtyna: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| tgtyna: lịch dạy | Đạt |
| tgtyna: ca dự kiến | Đạt |
| tgtyna: lịch rảnh | Đạt |
| tgtyna: yêu cầu đã gửi | Đạt |
| tgtuyetnhi: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| tgtuyetnhi: lịch dạy | Đạt |
| tgtuyetnhi: ca dự kiến | Đạt |
| tgtuyetnhi: lịch rảnh | Đạt |
| tgtuyetnhi: yêu cầu đã gửi | Đạt |
| tgnhuy: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu | Đạt |
| tgnhuy: lịch dạy | Đạt |
| tgnhuy: ca dự kiến | Đạt |
| tgnhuy: lịch rảnh | Đạt |
| tgnhuy: yêu cầu đã gửi | Đạt |
| Phụ huynh / học viên Nguyễn Minh An đăng nhập | Đạt |
| Nguyễn Minh An: danh sách lớp | Đạt |
| Nguyễn Minh An: thời khóa biểu IEF-K15 | Đạt |
| Nguyễn Minh An: thời khóa biểu GT-A2-08 | Đạt |
| Nguyễn Minh An: lịch dự kiến | Đạt |
| Nguyễn Minh An: phiếu góp ý | Đạt |
| Phụ huynh / học viên Lê Văn Bình đăng nhập | Đạt |
| Lê Văn Bình: danh sách lớp | Đạt |
| Lê Văn Bình: thời khóa biểu GT-B1-09 | Đạt |
| Lê Văn Bình: lịch dự kiến | Đạt |
| Lê Văn Bình: phiếu góp ý | Đạt |
| Phụ huynh / học viên Trần Gia Huy đăng nhập | Đạt |
| Trần Gia Huy: danh sách lớp | Đạt |
| Trần Gia Huy: thời khóa biểu Kids-K03 | Đạt |
| Trần Gia Huy: lịch dự kiến | Đạt |
| Trần Gia Huy: phiếu góp ý | Đạt |
| Phụ huynh / học viên Phạm Bảo Ngọc đăng nhập | Đạt |
| Phạm Bảo Ngọc: danh sách lớp | Đạt |
| Phạm Bảo Ngọc: thời khóa biểu Kids-K04 | Đạt |
| Phạm Bảo Ngọc: lịch dự kiến | Đạt |
| Phạm Bảo Ngọc: phiếu góp ý | Đạt |
| Phụ huynh / học viên Trần Gia Hân đăng nhập | Đạt |
| Trần Gia Hân: danh sách lớp | Đạt |
| Trần Gia Hân: thời khóa biểu GS-MILKY | Đạt |
| Trần Gia Hân: lịch dự kiến | Đạt |
| Trần Gia Hân: phiếu góp ý | Đạt |
| Phụ huynh / học viên Đỗ Nhật Phúc đăng nhập | Đạt |
| Đỗ Nhật Phúc: danh sách lớp | Đạt |
| Đỗ Nhật Phúc: thời khóa biểu GS-RABBIT | Đạt |
| Đỗ Nhật Phúc: lịch dự kiến | Đạt |
| Đỗ Nhật Phúc: phiếu góp ý | Đạt |

## Số bản ghi xuất ra

| Collection | Số bản ghi |
| --- | --- |
| `caHoc` | 3 |
| `phongHoc` | 12 |
| `monHoc` | 4 |
| `khoaHoc` | 11 |
| `lopHoc` | 12 |
| `nguoiDung` | 14 |
| `phuHuynhHocVien` | 170 |
| `lichRanh` | 144 |
| `lichDay` | 185 |
| `dangKyPhong` | 8 |
| `phanHoiGopY` | 12 |
| `thongBao` | 836 |
| `boDem` | 18 |
| `tepTaiLen.files` | 18 |
| `tepTaiLen.chunks` | 18 |
