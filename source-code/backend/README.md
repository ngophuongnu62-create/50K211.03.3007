# Broadway – Backend (Ưu tiên 1: Backend + Database)

API cho Hệ thống quản lý lịch dạy và phân công giáo viên – Trung tâm Ngoại ngữ Broadway.
Node.js 22 · Express 4 · Mongoose 8 · MongoDB 7 (replica set, có giao dịch).

## Chạy thử nhanh

```bash
npm install
npm run db:dev            # MongoDB replica set cục bộ (không cần cài MongoDB), in ra MONGODB_URI
npm run init-master-data  # danh mục gốc (ca học, phòng học, môn học) + tài khoản Admin – chỉ THÊM, không xóa
npm run seed:demo         # dữ liệu demo – chỉ chạy ở development và khi CSDL chưa có dữ liệu nghiệp vụ
# hoặc bộ dữ liệu thử đầy đủ, đúng logic (../tai-lieu/du-lieu-thu/README.md):
npm run sinh-du-lieu-thu  # sinh + tự kiểm tra (21 quy tắc, gọi thử API) → ../tai-lieu/du-lieu-thu/json
npm run nap-du-lieu-thu   # nạp vào CSDL trong MONGODB_URI (thay dữ liệu; CSDL đã có dữ liệu thì thêm -- --xac-nhan)
npm run dev               # http://localhost:4000/api
```

## Môi trường (`NODE_ENV`)

| Môi trường | Tệp cấu hình (nạp theo thứ tự ưu tiên) | Đặc điểm |
| --- | --- | --- |
| `development` | `.env.development.local` → `.env.development` → `.env` | Có giá trị mặc định để chạy ngay; CORS cho Vite `localhost:5173`; giới hạn tần suất nới rộng |
| `test` | như trên với `test` | Dùng bởi `npm test` (MongoDB trong bộ nhớ); tắt giới hạn tần suất trừ bộ kiểm thử bảo mật |
| `production` | biến môi trường máy chủ hoặc `.env.production` (mẫu: `.env.production.example`, không đưa lên Git) | **Không có giá trị mặc định** cho CSDL, bí mật, tên miền; MongoDB không xác thực / thiếu / yếu / `CORS_ORIGIN=*` / `FAKE_NOW` → từ chối khởi động |

MongoDB production bật xác thực, 2 tài khoản: quản trị chạy `node src/db/thiet-lap-csdl.js` (cấu trúc CSDL + vai trò `broadwayApp`
+ tài khoản ứng dụng); ứng dụng chạy bằng tài khoản `broadway_app` (`MONGODB_USER` / `MONGODB_PASSWORD`, `MONGODB_DONG_BO_CAU_TRUC=0`)
– đọc / thêm / sửa dữ liệu nghiệp vụ, không xóa; `audit_logs` chỉ đọc và thêm.

## Kiến trúc (Chương 7: nguyên khối, phân tầng MVC, client–server 3 tầng)

```
src/
  config/       env, kết nối MongoDB (tạo collection + validator + chỉ mục)
  constants/    enums (Bảng 4.1), messages (câu thông báo trích nguyên văn đặc tả)
  models/       12 collection Mongoose theo tài liệu thiết kế MongoDB + boDem (sinh mã)
  db/           validators.js – $jsonSchema ở mức collection (lớp kiểm tra thứ hai); quyenCSDL.js – vai trò MongoDB của ứng dụng;
                thiet-lap-csdl.js – bước thiết lập CSDL bằng tài khoản quản trị
  middlewares/  auth (JWT + phiên bản token, phân quyền, bắt buộc đổi mật khẩu tạm), baoMat (CORS, giới hạn tần suất),
                upload (ảnh/tệp), errorHandler (bắt lỗi toàn cục, giới hạn thời gian xử lý)
  services/     nghiệp vụ theo use case (UC_1 → UC_14), khaDung (rảnh/xung đột)
  controllers/  mỏng: gọi service, trả JSON chuẩn
  routes/       /api/auth, /api/quan-ly, /api/giao-vien, /api/phu-huynh
  jobs/         tác vụ định kỳ: khóa phân công quá hạn 24 giờ
  seed/         init-master-data (danh mục gốc + Admin, không xóa) · seed-demo (dữ liệu demo, chặn trên production)
  utils/        giaoDich (giao dịch + khóa tài nguyên chống trùng đồng thời), nhatKy (audit_logs), nguCanh (mã yêu cầu, người thực hiện)
```

Phản hồi thành công: `{ success: true, message?, data }`.
Phản hồi lỗi: `{ success: false, code, message, fieldErrors?, data? }` – `message` là câu thông báo trong đặc tả.

## Tài khoản

Production: chỉ có Admin khởi tạo (mật khẩu tạm in một lần khi `init-master-data`, bắt buộc đổi ở lần đăng nhập đầu).
Demo (`npm run seed:demo`, mật khẩu chung `Broadway@2026`): xem `../tai-lieu/golive/TAI_KHOAN_MAU.md`.

## Danh sách API

| Use case | Phương thức & đường dẫn |
| --- | --- |
| UC_1 | `POST /api/auth/dang-nhap`, `POST /api/auth/phu-huynh/dang-nhap`, `GET /api/auth/toi`, `POST /api/auth/dang-xuat`, `POST /api/auth/doi-mat-khau` |
| Nhật ký | `GET /api/quan-ly/nhat-ky?hanhDong&loaiDoiTuong&maDoiTuong&nguoiThucHien&tuNgay&denNgay&trang&soDong` (chỉ đọc) |
| MH04 | `GET /api/quan-ly/tong-quan` |
| UC_2.1 | `GET /api/quan-ly/phong-hoc/trong?ngay&tenPhong&trangThai`, `GET /api/quan-ly/phong-hoc/:maPhong?ngay` |
| UC_2.2 | `POST /api/quan-ly/phong-hoc/kiem-tra`, `POST /api/quan-ly/dang-ky-phong` |
| UC_2.3 | `GET /api/quan-ly/dang-ky-phong`, `PATCH /api/quan-ly/dang-ky-phong/:maDangKy/huy` |
| UC_3 | `GET /api/quan-ly/ho-so-giao-vien`, `GET /:maNhanSu`, `POST` (multipart, `bangCap[]`), `PUT /:maNhanSu` |
| UC_4 | `GET /api/quan-ly/phan-hoi`, `GET /:maPhanHoi`, `PATCH /:maPhanHoi/trang-thai`, `POST /:maPhanHoi/tra-loi` |
| UC_5 | `GET /api/quan-ly/lich-day?loaiLop&maLop&maGiaoVien&maTroGiang&maPhong&tuNgay&denNgay&trangThaiXacNhan`, `GET /:maLichDay` |
| UC_6 (MH19) | `GET /api/quan-ly/quan-ly-lich?trangThai` |
| UC_6.1 | `GET /quan-ly-lich/lop-chua-co-lich`, `POST /quan-ly-lich/de-xuat`, `POST /quan-ly-lich/kiem-tra-phuong-an`, `POST /quan-ly-lich` |
| UC_6.2 | `GET /quan-ly-lich/tuan-toi`, `POST /quan-ly-lich/tuan-toi/xac-nhan` |
| UC_6.3 | `GET /quan-ly-lich/:maLop/phan-cong`, `GET /api/quan-ly/nhan-su`, `POST /quan-ly-lich/:maLop/kiem-tra-giao-vien`, `POST /quan-ly-lich/:maLop/phan-cong`, `POST /quan-ly-lich/:maLop/gui-thong-bao` |
| UC_6.4 | `GET /quan-ly-lich/:maLop/kiem-tra`, `POST /:maLop/phe-duyet`, `POST /:maLop/phat-hanh`, `POST /:maLop/gui-lai-thong-bao`, `POST /:maLop/phan-cong-lai`, `PATCH /quan-ly-lich/de-xuat-thay-doi/:maLichDay/:maPhanHoiLichDay` |
| MH25 | `GET /api/giao-vien/tong-quan` |
| UC_7 | `GET /api/giao-vien/lich-day`, `GET /lich-day/:maLichDay` |
| UC_8 | `GET /api/giao-vien/ca-du-kien`, `GET /:maLichDay`, `POST /:maLichDay/xac-nhan`, `POST /:maLichDay/de-xuat-thay-doi` |
| UC_9 | `GET /api/giao-vien/lich-ranh`, `PUT /api/giao-vien/lich-ranh` |
| UC_10 | `POST /api/giao-vien/yeu-cau`, `GET /api/giao-vien/yeu-cau` |
| UC_12 | `GET /api/phu-huynh/lop`, `GET /thoi-khoa-bieu?maLop&tuan`, `GET /ca-hoc/:maLichDay` |
| UC_11 | `GET /api/phu-huynh/lich-du-kien`, `POST /:maLichDay/xac-nhan`, `POST /:maLichDay/tu-choi`, `POST /lich-du-kien/xac-nhan-tat-ca` |
| UC_13 | `GET /api/phu-huynh/ca-hoc/:maLichDay/xin-nghi`, `POST /api/phu-huynh/ca-hoc/:maLichDay/xin-nghi` |
| UC_14 | `POST /api/phu-huynh/gop-y` (multipart, `tepDinhKem[]`), `GET /gop-y`, `GET /gop-y/:maPhieu` |
| Chung | `GET /api/thong-bao`, `GET /api/danh-muc/{ca-hoc,phong-hoc,mon-hoc,lop-hoc,khoa-hoc}`, `POST /api/quan-ly/thong-bao/gui-lai` |

## Quy tắc phụ thuộc thời gian

Giờ Việt Nam (UTC+7). Hạn 24 giờ (UC_8, UC_11), xin nghỉ trước 2 tiếng (UC_13), cổng lịch rảnh 08:00 Thứ Hai – 23:59 Thứ Năm (UC_9).
Có thể giả lập thời điểm bằng biến `FAKE_NOW` khi lập trình / kiểm thử (bị bỏ qua và chặn khởi động trên production).

## Kiểm thử

```bash
npm test               # 156 ca: sai quyền, nhập sai dữ liệu, trùng lịch, thời hạn / xin nghỉ trễ, tiêu chuẩn production,
                       #          xác thực MongoDB + vai trò chỉ ghi nhật ký (MongoDB bật xác thực)
npm run test:bao-cao   # ghi kết quả vào ../tai-lieu/kiem-thu/KET_QUA_KIEM_THU.md
```

Kiểm thử dùng MongoDB replica set trong bộ nhớ và cố định đồng hồ ở 09:00 Thứ Tư 11/11/2026 (giờ Việt Nam)
để các quy tắc 2 tiếng, 24 giờ, cổng lịch rảnh cho kết quả lặp lại được. Báo cáo: `../tai-lieu/kiem-thu/BAO_CAO_KIEM_THU.md`.
