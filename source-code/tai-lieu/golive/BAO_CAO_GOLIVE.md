# Báo cáo Ưu tiên 4 – Triển khai và golive

Hệ thống quản lý lịch dạy và phân công giáo viên – Trung tâm Ngoại ngữ Broadway (nhóm 50K211.03.3007)

## 1. Tình trạng 7 hạng mục bàn giao

| # | Hạng mục | Kết quả | Minh chứng |
| --- | --- | --- | --- |
| 1 | Frontend | 40 màn hình MH01–MH40 (React), build và phục vụ cùng ứng dụng | `frontend/`, ảnh `anh/` |
| 2 | Backend | API Node.js/Express theo 14 use case; 124 ca kiểm thử nghiệp vụ đạt | `backend/`, `../kiem-thu/BAO_CAO_KIEM_THU.md` |
| 3 | Cơ sở dữ liệu | MongoDB 7 replica set, validator `$jsonSchema`, chỉ mục duy nhất chống trùng lịch; sao lưu / khôi phục đã thử | mục 3 |
| 4 | Kết nối | Giao diện gọi API cùng địa chỉ (`/api`), không cần cấu hình CORS; API nối MongoDB qua `MONGODB_URI`; kiểm tra sức khỏe báo cả trạng thái CSDL | `GET /api/suc-khoe` |
| 5 | Triển khai | `Dockerfile` + `docker-compose.yml` (MongoDB + ứng dụng), đã build và chạy thật; hướng dẫn VPS, HTTPS, đám mây | `HUONG_DAN_TRIEN_KHAI.md` |
| 6 | Golive | Đã diễn tập golive trên bản production với CSDL trống: kiểm thử đầu–cuối 24/24 đạt, các bài kiểm tra vận hành đạt | mục 2, 3 |
| 7 | Tài khoản mẫu | 2 Quản lý, 8 Giáo viên, 4 Trợ giảng, 10 Phụ huynh / Học viên, tự nạp ở lần chạy đầu | `TAI_KHOAN_MAU.md` |

## 2. Kiểm thử đầu–cuối trên trình duyệt

Chạy bằng Chromium trên bản production (Docker Compose, CSDL vừa khởi tạo), các bước nối tiếp như một ngày vận hành:
Quản lý tạo lịch → phân công → phê duyệt, phát hành → Giáo viên xác nhận, đề xuất thay đổi, cập nhật lịch rảnh
→ Phụ huynh xem thời khóa biểu, xin nghỉ, xác nhận / từ chối ca học, gửi ý kiến kèm ảnh → Quản lý xử lý phiếu → Phụ huynh thấy tiến độ.

**Kết quả: 24 / 24 ca đạt, không có lỗi JavaScript trên trang.** Chi tiết: [`KET_QUA_E2E.md`](KET_QUA_E2E.md).

| Ảnh minh chứng | |
| --- | --- |
| [01 Chọn đối tượng](anh/01-chon-doi-tuong.png) · [02 Đăng nhập sai](anh/02-dang-nhap-sai.png) · [03 Trang chủ Quản lý](anh/03-trang-chu-quan-ly.png) | Đăng nhập |
| [04 Phương án đề xuất](anh/04-phuong-an-de-xuat.png) · [05 Phân công](anh/05-phan-cong-thanh-cong.png) · [06 Phát hành](anh/06-phat-hanh.png) | Quản lý lịch dạy |
| [07 GV xác nhận](anh/07-gv-xac-nhan.png) · [08 Lịch rảnh](anh/08-lich-ranh.png) | Giáo viên |
| [09 Chọn lớp](anh/09-chon-lop.png) · [10 Xin nghỉ](anh/10-xin-nghi.png) · [11 Xác nhận ca học](anh/11-xac-nhan-ca-hoc.png) · [12 Mã phiếu](anh/12-ma-phieu.png) · [14 Tra cứu phiếu](anh/14-tra-cuu-phieu.png) | Phụ huynh |
| [13 Quản lý xử lý phiếu](anh/13-ql-xu-ly-phieu.png) | Đồng bộ trạng thái phiếu |

## 3. Kiểm tra vận hành

| Kiểm tra | Kết quả |
| --- | --- |
| Lần chạy đầu trên CSDL trống | Tự tạo replica set, nạp 143 buổi dạy và tài khoản mẫu, cả hai dịch vụ `healthy` |
| Khởi động lại ứng dụng | Không nạp lại dữ liệu mẫu ("CSDL đã có 14 người dùng – bỏ qua"), phiếu và lịch vừa tạo còn nguyên |
| Tệp tải lên sau khởi động lại | Ảnh minh chứng vẫn tải được (200, `image/png`) nhờ volume `uploads` |
| Dừng an toàn | `docker compose stop app` dừng trong 0,25 giây, ghi nhận tín hiệu SIGTERM |
| Tự phục hồi | Tiến trình ứng dụng bị dừng đột ngột → Docker tự khởi động lại, `healthy` sau khoảng 20 giây |
| Sao lưu / khôi phục MongoDB | `mongodump` → `mongorestore` sang CSDL khác: `nguoiDung` 14, `lichDay` 159, `phanHoiGopY` 6, `dangKyPhong` 3 – khớp hoàn toàn |
| Bảo vệ cấu hình | Thiếu hoặc dùng `JWT_SECRET` mặc định ở production → ứng dụng từ chối khởi động |
| Bảo vệ dữ liệu | Production chỉ chạy `init-master-data` (chỉ thêm, không xóa); `seed:demo` bị chặn trên production và khi CSDL đã có dữ liệu thật – xem `BAO_CAO_GIA_CO_PRODUCTION.md` |
| Kiểm thử nghiệp vụ backend | 124 / 124 ca đạt sau khi bổ sung chế độ production |

## 4. Việc còn lại để golive công khai

Bản diễn tập chạy trong môi trường phát triển nên chưa có địa chỉ công khai. Để golive cho người dùng thật, trung tâm cần một trong hai:

1. **Máy chủ riêng (VPS)** có Docker và (nên có) tên miền → làm theo mục 3–4 của `HUONG_DAN_TRIEN_KHAI.md` (khoảng 10 phút).
2. **Tài khoản dịch vụ đám mây** (Render / Railway / Fly.io …) và **MongoDB Atlas** → làm theo mục 9.

Khuyến nghị thêm trước khi vận hành thật (chưa làm vì nằm ngoài đặc tả): giới hạn số lần đăng nhập sai, chức năng đổi mật khẩu cho nhân sự,
và lịch sao lưu tự động hằng ngày.
