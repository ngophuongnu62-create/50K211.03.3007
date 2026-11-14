# Báo cáo gia cố mã nguồn lên tiêu chuẩn Production

Hệ thống quản lý lịch dạy và phân công giáo viên – Trung tâm Ngoại ngữ Broadway · Nhóm 50K211.03.3007

Phạm vi: rà soát toàn bộ Backend, Database, Frontend theo 5 yêu cầu bắt buộc. Nghiệp vụ, phân quyền và màn hình vẫn bám
đặc tả use case và thiết kế Figma; mọi điểm phải bổ sung ngoài tài liệu được ghi rõ ở mục 7.

## Tóm tắt kết quả kiểm chứng

| Bộ kiểm thử | Số ca | Kết quả | Báo cáo |
| --- | --- | --- | --- |
| Backend (nghiệp vụ cũ 124 ca + 25 ca tiêu chuẩn production + 7 ca trên MongoDB bật xác thực) | 156 | 156 đạt | `tai-lieu/kiem-thu/KET_QUA_KIEM_THU.md` |
| Đầu–cuối trên trình duyệt, bản Docker (MongoDB bật xác thực) vừa khởi tạo bằng `init-master-data` | 9 | 9 đạt | `tai-lieu/golive/KET_QUA_E2E_PRODUCTION.md` |
| Đầu–cuối nghiệp vụ trên bản Docker (MongoDB bật xác thực, sau khi nạp dữ liệu demo ở chế độ UAT) | 24 | 24 đạt | `tai-lieu/golive/KET_QUA_E2E.md` |
| HTTPS qua Caddy (chứng chỉ, chuyển hướng, header, IP sau proxy, giao diện) | 5 | 5 đạt | `tai-lieu/golive/KET_QUA_E2E_HTTPS.md` |

Ba bộ đầu–cuối trên cũng đã chạy lại toàn bộ **qua HTTPS sau Caddy** (9/9, 24/24) với tên miền thử `lichday.localhost`
(chứng chỉ từ CA nội bộ của Caddy). Việc xin chứng chỉ Let's Encrypt thật cần tên miền thật trỏ về máy chủ công khai nên chưa thử được
trong môi trường phát triển.

Ca TC-SX-24 gửi **3.270 yêu cầu dữ liệu rác** vào toàn bộ API (JSON hỏng, toán tử `$`, sai kiểu, chuỗi 5.000 ký tự, ngày không
tồn tại, mã lớp 300 ký tự…) → không còn phản hồi 5xx nào.

---

## 1. An toàn dữ liệu và tách biệt môi trường

### 1.1 `seed.js` → `init-master-data.js` (không bao giờ xóa dữ liệu)

| Trước | Sau |
| --- | --- |
| `src/seed/seed.js` và `khoiTao.js` gọi `deleteMany` trên 13 collection rồi nạp dữ liệu mẫu; production chỉ chặn bằng biến xác nhận | Đã xóa cả hai tệp |
| Image Docker chạy `khoiTao.js` mỗi lần khởi động | Image chạy `src/seed/init-master-data.js` mỗi lần khởi động |

`init-master-data` (`src/seed/init-master-data.js` + `khoiTaoDuLieuGoc.js` + `duLieuGoc.js`):

- Chỉ khởi tạo danh mục gốc: **3 ca học, 12 phòng học** (gồm 3 phòng của cơ sở 76 Phạm Tứ), **4 môn học**, và **một tài khoản Quản lý khởi tạo**.
- Ghi bằng `bulkWrite` + `upsert` + `$setOnInsert`: thiếu thì thêm, có rồi thì **giữ nguyên** (không ghi đè dữ liệu Quản lý đã sửa).
- Không có bất kỳ lệnh `delete*`, `drop*`, `replace*` nào.
- Tài khoản Admin chỉ được tạo khi CSDL **chưa có Quản lý nào**: mật khẩu tạm ngẫu nhiên (hoặc `ADMIN_MAT_KHAU_TAM`), in **một lần** ra log, băm bcrypt 12 vòng, `mustChangePassword: true`.
- Kiểm chứng: TC-SX-21 (chạy 2 lần trên CSDL đang có dữ liệu → số bản ghi 10 collection không đổi, phòng đã sửa giữ nguyên), TC-SX-22 (CSDL chưa có Quản lý → tạo đúng 1 Admin, chạy lại không tạo thêm). Trên Docker: khởi động lần 2 in `Ca học: thêm 0, giữ nguyên 3 … Tài khoản Quản lý: đã có – không tạo thêm, không đổi mật khẩu`.

Dữ liệu demo tách sang `src/seed/seed-demo.js` (`npm run seed:demo`), có 3 lớp chặn:

1. Từ chối khi `NODE_ENV=production` (đã thử trên image: `seed:demo bị chặn trên production`).
2. Từ chối khi CSDL đã có dữ liệu nghiệp vụ (lịch dạy, lớp, học viên, nhân sự, phiếu, đăng ký phòng, lịch rảnh) mà không mang dấu hiệu dữ liệu demo `DU_LIEU_DEMO` (TC-SX-23).
3. Chỉ xóa–nạp lại được trên CSDL do chính nó tạo ra (có dấu hiệu demo).

### 1.2 Tách cấu hình `development` / `production`

`src/config/env.js` viết lại:

- `NODE_ENV` chỉ nhận `development | test | production`; sai là dừng ngay.
- Nạp tệp theo thứ tự `.env.<NODE_ENV>.local` → `.env.<NODE_ENV>` → `.env`; biến môi trường thật của máy chủ luôn thắng.
- `backend/.env.development` (được đưa lên Git, không chứa bí mật) – có mặc định để chạy ngay.
- `backend/.env.production.example` – mẫu; `.env.production`, `.env.*.local` nằm trong `.gitignore`.
- Production **không có giá trị mặc định** cho CSDL, bí mật, tên miền. Từ chối khởi động khi: thiếu `MONGODB_URI` / `JWT_SECRET` / `CORS_ORIGIN`; `JWT_SECRET` < 32 ký tự hoặc trùng khóa lập trình; `CORS_ORIGIN` là `*` hoặc sai dạng; `BCRYPT_ROUNDS` < 10; tắt giới hạn tần suất; có `FAKE_NOW` (giờ giả lập) – TC-SX-20.
- Giờ giả lập `FAKE_NOW` bị **bỏ qua** trên production (trước đây nếu lỡ đặt sẽ làm sai mọi hạn 24 giờ / 2 tiếng).
- Script: `npm start` (production), `npm run dev` (development), `npm test` (test).

---

## 2. Chống xung đột lịch và toàn vẹn dữ liệu (concurrency)

### 2.1 Lỗ hổng tìm thấy khi rà soát

| # | Vị trí | Lỗi | Hậu quả |
| --- | --- | --- | --- |
| 1 | Phân công GV/TG (`quanLyLich.phanCong`), lưu lịch (`luuLich`), đăng ký phòng (`dangKyPhong`), xác nhận lịch tuần (`xacNhanLichTuan`) | Kiểm tra trùng chạy **ngoài** giao dịch rồi mới ghi | 2 Quản lý bấm cùng lúc có thể cùng qua kiểm tra → 1 giáo viên / trợ giảng / phòng bị xếp 2 lớp cùng ca. Chỉ mục duy nhất cũ chỉ chặn trùng phòng–ca và lớp–ca, **không** chặn trùng nhân sự, và không chặn được trùng giữa đăng ký phòng ↔ lịch dạy (2 collection khác nhau) |
| 2 | Duyệt / từ chối đề xuất đổi lịch của giáo viên (`xuLyDeXuatThayDoi`) | Đọc – sửa – ghi không nguyên tử | 2 người xử lý cùng lúc → đề xuất bị duyệt và từ chối chồng nhau |
| 3 | Hủy đăng ký phòng đồng thời (`huyDangKy`) | Lần hủy thứ hai trả **500** | Lỗi hệ thống thay vì thông báo nghiệp vụ |
| 4 | Phụ huynh "Xác nhận tất cả" (`xacNhanTatCa`) | Vòng lặp ghi từng ca, không giao dịch | Lỗi giữa chừng để lại trạng thái xác nhận dở dang |
| 5 | Tác vụ tự khóa phân công quá hạn 24 giờ | Không giao dịch, không nhật ký | Không truy vết được |

### 2.2 Cơ chế đã áp dụng (3 lớp)

1. **Khóa tài nguyên trong giao dịch** (`src/utils/giaoDich.js` → `trongGiaoDichCoKhoa`): mỗi thao tác xếp lịch xác định trước các tài nguyên bị chạm (`PHONG:<mã>`, `NHANSU:<mã>`, `LOP:<mã>`), ghi `$inc` vào tài liệu khóa (collection `khoaTaiNguyen`) **ngay lệnh đầu tiên** của giao dịch MongoDB (`readConcern: snapshot`, `writeConcern: majority`). Hai giao dịch chạm cùng phòng / nhân sự / lớp → MongoDB báo xung đột ghi, giao dịch đến sau tự chạy lại và lúc đó thấy dữ liệu mới.
2. **Kiểm tra lại toàn bộ ràng buộc bên trong giao dịch** với dữ liệu mới nhất (phòng trống, sức chứa, lịch rảnh, chuyên môn, nhân sự không trùng ca, lớp chưa có lịch…) trước khi ghi. Kiểm tra trước giao dịch chỉ để báo lỗi nhanh.
3. **Chỉ mục duy nhất trong CSDL** là chốt chặn cuối cùng (kể cả khi ai đó ghi thẳng vào CSDL):
   - `UX_LichDay_Phong` (phòng–ngày–ca), `UX_LichDay_Lop` (lớp–ngày–ca), `UX_DangKyPhong` – đã có.
   - **Mới** `UX_LichDay_NhanSu`: chỉ mục multikey `phanCong.maNhanSu + ngayDay + maCa` cho các buổi còn hiệu lực → một giáo viên / trợ giảng không thể có 2 buổi cùng ngày–ca (TC-SX-05).
   - **Mới** kiểm tra ở model `LichDay`: mỗi buổi tối đa **1 giáo viên và 1 trợ giảng**, không nhân sự nào xuất hiện 2 lần (TC-SX-04).
   - Lỗi trùng khóa `E11000` từ CSDL được chuyển thành **409** kèm thông báo tiếng Việt (không còn 500).

Thao tác trạng thái dùng **cập nhật nguyên tử có điều kiện** (`updateOne` với điều kiện trạng thái hiện tại, kiểm `modifiedCount`): hủy đăng ký phòng, duyệt / từ chối đề xuất đổi lịch (`$elemMatch` + `arrayFilters` trên phiếu còn `ChoXuLy`), xác nhận / từ chối ca học, xin nghỉ (không cho gửi trùng), đổi mật khẩu.

### 2.3 API đã rà soát

| Nhóm API trong yêu cầu | API cụ thể | Bảo vệ |
| --- | --- | --- |
| Xếp lịch | `POST /quan-ly/quan-ly-lich` (tạo lịch), `POST …/tuan-toi/xac-nhan` (lịch tuần: đổi phòng, đổi ca, hủy buổi, buổi bù), `POST …/phe-duyet`, `…/phat-hanh`, `…/phan-cong-lai` | Khóa phòng + lớp + nhân sự, kiểm tra lại trong giao dịch, chỉ mục duy nhất |
| Đăng ký / phân công ca dạy | `POST …/:maLop/phan-cong` (giáo viên, trợ giảng), `POST …/gui-thong-bao`, `POST /quan-ly/dang-ky-phong`, `PUT /giao-vien/lich-ranh` | Khóa nhân sự + lớp / phòng; `UX_LichDay_NhanSu` |
| Đổi ca | `POST /giao-vien/ca-du-kien/:ma/de-xuat-thay-doi`, `PATCH /quan-ly/quan-ly-lich/de-xuat-thay-doi/…`, đổi ca trong lịch tuần | Cập nhật nguyên tử theo trạng thái phiếu |
| Đơn xin nghỉ | `POST /phu-huynh/ca-hoc/:ma/xin-nghi` | Giao dịch + điều kiện nguyên tử "chưa gửi" + kiểm tra lại hạn 2 tiếng tại thời điểm ghi |

Về "duyệt đơn xin nghỉ": theo UC_13, đơn xin nghỉ được ghi nhận ngay là "Báo vắng" và thông báo cho Quản lý – đặc tả **không có**
bước duyệt. Nhóm không tự thêm luồng duyệt. Các luồng duyệt / từ chối thật sự có trong đặc tả (đề xuất đổi lịch của giáo viên,
phiếu yêu cầu / góp ý, phê duyệt lịch) đều đã được gia cố.

### 2.4 Kiểm chứng gửi đồng thời

| Ca | Tình huống | Kết quả |
| --- | --- | --- |
| TC-SX-01 | 2 Quản lý cùng lúc phân công **cùng 1 giáo viên** vào 2 lớp trùng ca | đúng 1 thành công (200), 1 bị từ chối (409); giáo viên không có 2 buổi cùng ca; lớp thua vẫn sạch ở trạng thái Nháp |
| TC-SX-02 | Cùng lúc phân công **cùng 1 trợ giảng** vào 2 lớp trùng ca | đúng 1 thành công |
| TC-SX-03 | 2 Quản lý cùng gán **2 trợ giảng khác nhau** cho 1 lớp | mọi buổi chỉ có đúng 1 trợ giảng |
| TC-SX-06 | Đăng ký phòng P.401 và lưu lịch lớp vào P.401 cùng ngày–ca, gửi cùng lúc | đúng 1 thành công, phòng không bị trùng |
| TC-SX-07 | 2 Quản lý cùng hủy 1 đăng ký phòng | 200 + 422 (trước đây 500) |
| TC-SX-08 | Buổi bù trong lịch tuần và đăng ký phòng tranh cùng phòng–ca | tối đa 1 thành công, không 5xx |
| TC-TL-04, TC-TL-11, TC-TH-08 (cũ) | 5 đăng ký cùng phòng; 2 Quản lý cùng lưu lịch 1 lớp; 3 đơn xin nghỉ cùng ca | vẫn đạt |

---

## 3. Nhật ký hệ thống (`audit_logs`)

### 3.1 Cấu trúc một bản ghi

| Trường | Nội dung |
| --- | --- |
| `thoiDiem` | Thời gian thực hiện |
| `nguoiThucHien` | `{ ma, vaiTro, hoTen }` – lấy từ phiên đăng nhập (tác vụ tự động ghi `HE_THONG`) |
| `hanhDong` | Mã hành động, VD `PHAN_CONG.GIAO_VIEN` |
| `doiTuong` | `{ loai, ma }` – VD `{ loai: 'LopHoc', ma: 'IE65-K12' }` |
| `moTa` | Mô tả ngắn |
| `duLieuCu` / `duLieuMoi` | Ảnh chụp dữ liệu trước / sau (null khi tạo mới / xóa) |
| `ip`, `userAgent`, `maYeuCau` | Truy vết; `maYeuCau` trùng header `X-Request-Id` của phản hồi và mã tra cứu hiển thị cho người dùng khi lỗi |

Ví dụ thật lấy từ bản Docker sau khi chạy E2E:

```json
{
  "thoiDiem": "2026-11-11T02:05:40.641Z",
  "nguoiThucHien": { "ma": "QL-001", "vaiTro": "QuanLy", "hoTen": "Trần Thu Trang" },
  "hanhDong": "PHAN_CONG.GIAO_VIEN",
  "doiTuong": { "loai": "LopHoc", "ma": "IE65-K12" },
  "moTa": "Phân công giáo viên GV-003 cho 16 buổi",
  "duLieuCu":  [{ "maLichDay": "LD-000112", "maPhong": "P202", "maCa": "CA3", "ngayDay": "2026-11-17", "trangThaiLich": "Nhap", "phanCong": [] }, "…"],
  "duLieuMoi": [{ "maLichDay": "LD-000112", "maPhong": "P202", "maCa": "CA3", "ngayDay": "2026-11-17", "trangThaiLich": "ChoGVXacNhan",
                  "phanCong": [{ "maNhanSu": "GV-003", "vaiTro": "GiaoVien", "trangThaiPhanCong": "ChoXacNhan" }] }, "…"],
  "ip": "172.18.0.1",
  "maYeuCau": "2816fab9-2ec8-4359-b4a8-c54496dcafb5"
}
```

### 3.2 Hành động được ghi

| Nhóm trong yêu cầu | Mã hành động |
| --- | --- |
| Tạo / sửa / xóa lịch học | `LICH_DAY.TAO` (tạo lịch, buổi bù), `LICH_DAY.CAP_NHAT` (đổi phòng / ca / giáo viên trong lịch tuần), `LICH_DAY.HUY` (hủy buổi – hệ thống không xóa cứng lịch), `LICH_DAY.PHE_DUYET`, `LICH_DAY.PHAT_HANH` |
| Phân công trợ giảng / giáo viên | `PHAN_CONG.GIAO_VIEN`, `PHAN_CONG.TRO_GIANG`, `PHAN_CONG.PHAN_CONG_LAI`, `PHAN_CONG.GUI_THONG_BAO`, `PHAN_CONG.GV_XAC_NHAN`, `PHAN_CONG.GV_DE_XUAT_THAY_DOI`, `PHAN_CONG.HET_HAN` (tự động) |
| Duyệt / từ chối đơn từ | `DE_XUAT_THAY_DOI.DUYET`, `DE_XUAT_THAY_DOI.TU_CHOI`, `PHAN_HOI.TU_CHOI`, `PHAN_HOI.CAP_NHAT_TRANG_THAI`, `PHAN_HOI.TRA_LOI`, `XIN_NGHI.TAO`, `XAC_NHAN_CA_HOC.XAC_NHAN`, `XAC_NHAN_CA_HOC.TU_CHOI`, `XAC_NHAN_CA_HOC.XAC_NHAN_TAT_CA`, `YEU_CAU.TAO`, `GOP_Y.TAO` |
| Thao tác quan trọng khác | `DANG_KY_PHONG.TAO`, `DANG_KY_PHONG.HUY`, `HO_SO_NHAN_SU.TAO`, `HO_SO_NHAN_SU.CAP_NHAT`, `LICH_RANH.CAP_NHAT`, `TAI_KHOAN.DANG_NHAP`, `TAI_KHOAN.DOI_MAT_KHAU` |

### 3.3 Bảo đảm của nhật ký

- **Cùng giao dịch với dữ liệu**: nhật ký ghi bằng cùng `session` → thao tác thành công thì có nhật ký, thao tác bị từ chối / lỗi thì cả dữ liệu lẫn nhật ký đều không được ghi (TC-SX-10).
- **Không sửa / xóa được qua ứng dụng**: model chặn mọi lệnh `update*`, `findOneAndUpdate`, `replaceOne`, `delete*` (TC-SX-12); collection có `$jsonSchema` bắt buộc đủ trường.
- **Không lưu bí mật**: tự loại `matKhau`, `phienBanToken`, `matKhauTam`, `token`; hồ sơ nhân sự ghi theo danh sách trường cho phép (TC-SX-13 xác nhận nhật ký không chứa mật khẩu gốc lẫn chuỗi băm).
- **Tra cứu**: API chỉ đọc cho Quản lý `GET /api/quan-ly/nhat-ky` (lọc hành động, đối tượng, người thực hiện, khoảng ngày; phân trang tối đa 100 dòng) – TC-SX-14. Có chỉ mục theo thời điểm, đối tượng, người thực hiện, hành động.
- **Khóa ở tầng CSDL** (mục 4.4): MongoDB bật xác thực; tài khoản của ứng dụng chỉ có quyền **đọc và thêm** trên `audit_logs`, nên
  kể cả đi thẳng vào MongoDB bằng tài khoản ứng dụng cũng không sửa, xóa, đổi chỉ mục hay đổi validator được (TC-CSDL-06).

---

## 4. Bảo mật production

### 4.1 CORS nghiêm ngặt (`src/middlewares/baoMat.js`)

- Chỉ chấp nhận Origin nằm trong `CORS_ORIGIN` (bắt buộc trên production, cấm `*`) hoặc chính máy chủ (khi backend phục vụ luôn giao diện).
- Origin lạ bị **từ chối 403** `NGUON_KHONG_DUOC_PHEP` ngay (không chỉ thiếu header), không trả `Access-Control-Allow-Origin`.
- Chỉ mở các phương thức / header cần dùng; yêu cầu không có Origin (công cụ giám sát, cùng nguồn) vẫn đi tiếp nhưng vẫn phải qua JWT.
- Kiểm chứng: TC-SX-15 (backend), TC-SX-E01 (trên bản Docker).

### 4.2 Giới hạn tần suất (`express-rate-limit`)

| Bộ giới hạn | Phạm vi | Ngưỡng mặc định production | Phản hồi |
| --- | --- | --- | --- |
| Chống spam API | Mọi `/api/*` và `/uploads/*`, theo IP (bỏ qua `/api/suc-khoe`) | 600 yêu cầu / phút (để rộng vì cả trung tâm thường dùng chung 1 IP qua NAT) | 429 "Bạn thao tác quá nhanh…" + `Retry-After` |
| Chống dò mật khẩu | `POST /api/auth/dang-nhap`, theo **IP + tên đăng nhập** | 10 lần **sai** / 15 phút (lần đúng không bị tính) | 429 "Bạn đã nhập sai quá nhiều lần…" |
| Chống rải mật khẩu | Đăng nhập nhân sự + phụ huynh, theo IP | 50 lần sai / 15 phút | 429 |
| Phụ huynh | `POST /api/auth/phu-huynh/dang-nhap`, theo IP + số điện thoại | 10 lần sai / 15 phút | 429 |
| Đổi mật khẩu | `POST /api/auth/doi-mat-khau` | 10 lần sai / 15 phút | 429 |

Kiểm chứng: TC-SX-16 (sai 3 lần → 429; tài khoản khác và lần đăng nhập đúng không bị ảnh hưởng), TC-SX-17 (vượt 5 yêu cầu / phút → 429).
Lưu ý: bộ đếm nằm trong bộ nhớ tiến trình – đúng với mô hình triển khai 1 phiên bản ứng dụng hiện tại; nếu chạy nhiều phiên bản cần kho đếm dùng chung (Redis).
Khi đặt sau proxy ngược phải đặt `TRUST_PROXY=1` để đếm đúng IP người dùng.

### 4.3 Bắt buộc đổi mật khẩu mặc định ở lần đăng nhập đầu (`mustChangePassword: true`)

- Model `NguoiDung` thêm `mustChangePassword`, `phienBanToken`, `matKhauDoiLuc` (kèm `$jsonSchema`).
- `mustChangePassword: true` cho: Admin khởi tạo, **mọi tài khoản giáo viên / trợ giảng do Quản lý tạo ở MH11**.
- Khi cờ bật, middleware chỉ cho gọi `GET /auth/toi`, `POST /auth/doi-mat-khau`, `POST /auth/dang-xuat`; mọi API khác → 403 `PHAI_DOI_MAT_KHAU`. Giao diện tự chuyển sang màn hình "Đổi mật khẩu tạm" và không cho vào bất kỳ trang nào khác.
- `POST /api/auth/doi-mat-khau`: bắt buộc mật khẩu hiện tại; mật khẩu mới 8–64 ký tự, có chữ và số, khác mật khẩu cũ và khác tên đăng nhập; chống truyền đối tượng `{ $ne: … }`; cập nhật nguyên tử, ghi nhật ký.
- **Vô hiệu mọi phiên cũ**: JWT mang phiên bản `pv`; đổi mật khẩu tăng `phienBanToken` → mọi token cũ (máy khác, trình duyệt khác) nhận 401 "Phiên đăng nhập đã hết hiệu lực…" (TC-SX-18, TC-SX-E05).
- Kiểm chứng trọn luồng trên trình duyệt: TC-SX-E02 → E06 (ảnh `anh/SX-01…SX-04`).

### 4.4 Xác thực MongoDB và vai trò chỉ ghi nhật ký

| Trước | Sau |
| --- | --- |
| MongoDB trong `docker-compose.yml` không cần đăng nhập; ai vào được container / mạng nội bộ là đọc, sửa, xóa được mọi thứ kể cả nhật ký | MongoDB chạy `--keyFile` (bắt buộc đăng nhập); keyfile ngẫu nhiên sinh một lần trong volume `mongo-config` |
| Ứng dụng kết nối bằng quyền cao nhất | Ứng dụng dùng tài khoản riêng `broadway_app`, vai trò tối thiểu `broadwayApp` |

Vai trò `broadwayApp` (`backend/src/db/quyenCSDL.js`):

| Tài nguyên | Quyền | Không có |
| --- | --- | --- |
| 14 collection nghiệp vụ | `find`, `insert`, `update` | `remove` (hệ thống chỉ đổi trạng thái, không xóa cứng), tạo / xóa chỉ mục, đổi validator, xóa collection |
| `audit_logs` | `find`, `insert` | mọi thao tác khác |
| CSDL `BroadwayDB` | `listCollections` | xóa CSDL; mọi quyền quản trị tài khoản / vai trò |

- **Bước thiết lập** `src/db/thiet-lap-csdl.js` (dịch vụ `thiet-lap-csdl` trong compose, chạy bằng tài khoản quản trị trước ứng dụng mỗi lần `docker compose up`):
  tạo đủ collection + validator + chỉ mục, tạo / cập nhật vai trò và tài khoản ứng dụng, tự kiểm tra tài khoản ứng dụng không sửa / xóa được nhật ký. Lỗi → ứng dụng không khởi động.
- **Ứng dụng** kết nối với `MONGODB_DONG_BO_CAU_TRUC=0`: không làm thay đổi cấu trúc, chỉ kiểm tra đủ collection; khi khởi động in tài khoản đang dùng và cảnh báo nếu tài khoản có quyền sửa / xóa nhật ký.
- **Production bắt buộc xác thực**: thiếu `MONGODB_USER` / tài khoản trong `MONGODB_URI` → từ chối khởi động (TC-SX-20).
- **Nâng cấp bản đang chạy không xác thực**: kiểm tra sức khỏe của `mongo` tự tạo tài khoản quản trị đầu tiên bằng ngoại lệ localhost của MongoDB.
  Đã thử trên Docker: số bản ghi trước / sau khớp (159 buổi dạy, 20 nhật ký…).
- Sao lưu / khôi phục chuyển sang dùng tài khoản quản trị (đã thử khôi phục sang CSDL khác: 15/15 collection khớp).

Kiểm chứng trên MongoDB bật xác thực thật (`test/06-quyen-csdl.test.js`, 7 ca) và trên Docker:

| Ca | Nội dung | Kết quả |
| --- | --- | --- |
| TC-CSDL-01 | Không đăng nhập / sai mật khẩu | bị từ chối |
| TC-CSDL-03 | Bước thiết lập trên CSDL trống, chạy lại lần 2 | tạo đủ 15 collection, vai trò, tài khoản; lần 2 chuyển sang cập nhật |
| TC-CSDL-05 | Nghiệp vụ thật bằng tài khoản hạn chế (đăng nhập, phân công trong giao dịch + khóa + ghi nhật ký, init-master-data) | chạy đúng |
| TC-CSDL-06 | Tài khoản ứng dụng đi thẳng driver: `deleteMany`, `deleteOne`, `findOneAndDelete`, `updateOne`, `updateMany`, `replaceOne`, `drop`, chỉ mục TTL, `dropIndexes`, tắt validator, đổi tên, `convertToCapped` trên `audit_logs` | **12/12 bị MongoDB từ chối**; số nhật ký, nội dung, chỉ mục không đổi; thêm mới vẫn được |
| TC-CSDL-07 | Xóa lịch dạy, xóa collection, xóa CSDL, đổi validator, tạo / xóa chỉ mục, tạo tài khoản, tự cấp quyền root, sửa vai trò, đọc bảng tài khoản | **10/10 bị từ chối** |

Khi cài mới trên Docker, bài thử phát hiện collection `boDem` (bộ đếm sinh mã, không có validator) chưa được tạo sẵn → tài khoản ứng dụng
không có quyền tạo nên ứng dụng không khởi động. Đã sửa: bước thiết lập tạo đủ mọi collection; TC-CSDL-03 kiểm tra đúng điều này.

### 4.5 Gia cố bảo mật khác

- Băm mật khẩu theo `BCRYPT_ROUNDS` (production 12, trước đây cố định 10).
- Đăng nhập với tên không tồn tại vẫn so khớp một chuỗi băm giả → thời gian phản hồi như nhau, không dò được tên đăng nhập.
- Tên tệp tải lên ngẫu nhiên 128 bit (trước 48 bit), thư mục tải lên không liệt kê tệp, không phục vụ tệp ẩn, chịu giới hạn tần suất.
- Mã tài nguyên lạ (không phải chuỗi, dài bất thường, bắt đầu bằng `$`) bị từ chối 400 trước khi chạm CSDL.
- Giới hạn thân yêu cầu 1 MB, tối đa 200 tham số form; header `X-Request-Id` cho mọi phản hồi.

---

### 4.6 HTTPS cho tên miền thật bằng Caddy

`docker-compose.https.yml` + `docker/caddy/Caddyfile`. Bật bằng 3 biến trong `.env`: `COMPOSE_FILE`, `TEN_MIEN`, `EMAIL_ACME`.
Tên miền không ghi cứng trong mã.

| Hạng mục | Thực hiện |
| --- | --- |
| Chứng chỉ | Caddy 2.11 tự xin Let's Encrypt (dự phòng ZeroSSL), tự gia hạn, lưu ở volume `caddy-data`; có tùy chọn thử bằng máy chủ staging trước |
| Chuyển hướng | `http://` → `https://` mã 308, giữ nguyên đường dẫn và tham số (TC-SX-E11) |
| Giao thức | TLS 1.2+ (đo được TLS 1.3), HTTP/2, HTTP/3 (cổng 443/udp) (TC-SX-E10) |
| Header | HSTS 1 năm; ẩn `Server`, `X-Powered-By`; CSP của ứng dụng tự thêm `upgrade-insecure-requests` khi mọi địa chỉ giao diện là `https://`; nén gzip / zstd (TC-SX-E12) |
| Cổng ứng dụng | Không còn mở 8080 ra Internet, chỉ `127.0.0.1:8080` để quản trị kiểm tra trên máy chủ (đã thử: gọi từ IP ngoài bị từ chối) |
| IP người dùng | Caddy ghi đè `X-Forwarded-For` bằng IP thật; ứng dụng tự đặt `TRUST_PROXY=1` → giới hạn tần suất và nhật ký dùng đúng IP. Gửi `X-Forwarded-For` giả mạo không có tác dụng (TC-SX-E13; IP ghi nhận `172.18.0.1` = máy người dùng, không phải IP của Caddy `172.18.0.4`) |
| CORS | `CORS_ORIGIN` tự đặt thành `https://<TEN_MIEN>` |
| Giao diện | Đăng nhập qua HTTPS, mọi yêu cầu là `https://`, không có nội dung hỗn hợp, không lỗi JavaScript (TC-SX-E14) |

## 5. Xử lý lỗi và trải nghiệm thực tế

### 5.1 Backend không sập khi gặp dữ liệu lạ

- **Bộ bắt lỗi toàn cục** (`src/middlewares/errorHandler.js`) chuẩn hóa mọi loại lỗi về `{ success:false, code, message }` tiếng Việt: lỗi kiểm tra Mongoose, sai kiểu, BSON, JSON hỏng, mã hóa lạ, thân quá lớn (413), quá nhiều tham số, trùng khóa (409), xung đột giao dịch còn lại sau khi thử lại (409), mất kết nối / CSDL quá tải (503), lỗi tải tệp. Lỗi ngoài dự kiến → 500 "Đã có lỗi xảy ra…" kèm **mã tra cứu**; chi tiết kỹ thuật chỉ ghi ở log máy chủ cùng mã yêu cầu.
- **Giới hạn thời gian xử lý** mỗi yêu cầu 30 giây (tải tệp 2 phút) → 503 thân thiện thay vì treo; `requestTimeout`, `headersTimeout`, `keepAliveTimeout` của máy chủ HTTP chống giữ kết nối treo.
- **Lưới an toàn cấp tiến trình** (`src/server.js`): `unhandledRejection` → ghi log, tiếp tục phục vụ; `uncaughtException` → ghi log, ngừng nhận yêu cầu mới, chờ yêu cầu đang xử lý xong rồi khởi động lại sạch (Docker `restart: unless-stopped` dựng lại trong vài giây; thoát có kiểm soát vì trạng thái tiến trình khi đó không còn tin cậy).
- Tác vụ định kỳ bắt lỗi riêng, không làm sập tiến trình.
- **Fuzz test** TC-SX-24: 3.270 yêu cầu rác lên mọi API → 0 lỗi 5xx. Bộ kiểm thử này đã **phát hiện và sửa** 1 lỗi: mã lớp dài 300 ký tự trên `…/phan-cong-lai`, `…/gui-thong-bao` làm tài liệu khóa vi phạm `$jsonSchema` → 500; nay trả 400.

### 5.2 Frontend

| Hạng mục | Thực hiện |
| --- | --- |
| Trạng thái đang tải | Rà soát 29 màn hình: mọi màn hình gọi API đều có `Loading` khi tải và `Alert` lỗi khi thất bại; nút đang xử lý hiện vòng xoay |
| Chặn bấm đúp | Nút dùng chung `Button` tự khóa (bằng `ref`, chặn cả 2 cú bấm liên tiếp trước khi giao diện kịp vẽ lại) khi `onClick` trả về Promise → áp dụng cho **mọi** nút lưu / gửi / duyệt của 40 màn hình mà không phải sửa từng màn hình. Biểu mẫu đăng nhập nhân sự, phụ huynh, đổi mật khẩu chặn gửi trùng khi nhấn Enter liên tục. TC-SX-E04: bấm đúp "Đổi mật khẩu" → đúng 1 yêu cầu |
| Lỗi đã sửa ở nút | `<Button disabled={false} loading>` trước đây bị thuộc tính `disabled` ghi đè → nút **không** bị khóa khi đang lưu (VD nút "Xác nhận" ca dự kiến của giáo viên) |
| Thông báo lỗi tiếng Việt | `src/api/client.js`: mất mạng → "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng…"; quá 30 giây → "Máy chủ phản hồi quá lâu…"; proxy trả trang HTML 502/503/504 → "Hệ thống đang bận hoặc đang bảo trì…"; 413, 429, 401 có câu riêng; lỗi 500 kèm "(Mã tra cứu: xxxxxxxx)" để báo kỹ thuật (TC-SX-E07) |
| Tự thử lại | Yêu cầu **đọc** (GET) gặp lỗi mạng / 502–504 tự thử lại 1 lần; yêu cầu ghi không bao giờ tự gửi lại (tránh ghi trùng) |
| Hết phiên | 401 → tự đăng xuất, về đúng trang đăng nhập kèm lý do (VD "Phiên đăng nhập đã hết hiệu lực do mật khẩu vừa được thay đổi") |
| Lỗi hiển thị | `ErrorBoundary` bọc toàn ứng dụng: lỗi vẽ giao diện ở một màn hình không làm trắng trang; hiện thông báo tiếng Việt + "Tải lại trang" / "Về trang đầu"; tự xóa khi chuyển trang |
| Mất mạng | Dải cảnh báo "Mất kết nối mạng. Các thao tác sẽ không được lưu…" hiện khi thiết bị offline, tự ẩn khi có mạng (TC-SX-E08) |

---

## 6. Danh sách tệp thay đổi chính

| Tầng | Tệp |
| --- | --- |
| Cấu hình | `backend/src/config/env.js`, `backend/src/config/db.js`, `backend/.env.development`, `backend/.env.production.example`, `.env.example`, `docker-compose.yml`, `Dockerfile`, `backend/.gitignore` |
| HTTPS | `docker-compose.https.yml`, `docker/caddy/Caddyfile`, `backend/src/app.js` (CSP nâng cấp HTTPS) |
| Xác thực MongoDB | `docker/mongo/khoi-dong.sh` (keyfile), `docker/mongo/kiem-tra.js` (kiểm tra sức khỏe, khởi tạo replica set, nâng cấp), `backend/src/db/quyenCSDL.js` (vai trò), `backend/src/db/thiet-lap-csdl.js` (bước thiết lập) |
| Dữ liệu gốc | `backend/src/seed/init-master-data.js`, `khoiTaoDuLieuGoc.js`, `duLieuGoc.js`, `seed-demo.js`, `duLieuMau.js` (chặn demo); xóa `seed.js`, `khoiTao.js` |
| CSDL / model | `models/AuditLog.js`, `models/KhoaTaiNguyen.js`, `models/LichDay.js` (chỉ mục `UX_LichDay_NhanSu`, kiểm tra 1 GV + 1 TG), `models/NguoiDung.js`, `db/validators.js` |
| Đồng thời / nhật ký | `utils/giaoDich.js`, `utils/nhatKy.js`, `utils/nguCanh.js`; service `quanLyLich`, `lichTuan`, `phongHoc`, `giaoVien`, `phuHuynh`, `phanHoi`, `hoSoGiaoVien`, `khaDung`, `auth`, `nhatKy` (mới) |
| Bảo mật / lỗi | `middlewares/baoMat.js` (mới), `middlewares/auth.js`, `middlewares/errorHandler.js`, `middlewares/upload.js`, `app.js`, `server.js`, `utils/clock.js`, `constants/messages.js`, `routes/index.js` |
| Giao diện | `api/client.js`, `components/ui.jsx` (Button chống bấm đúp), `components/ErrorBoundary.jsx`, `components/TrangThaiMang.jsx`, `auth/AuthContext.jsx`, `pages/chung/DoiMatKhau.jsx` (mới), `DangNhapNhanSu.jsx`, `DangNhapPhuHuynh.jsx`, `App.jsx`, `main.jsx` |
| Kiểm thử | `backend/test/05-production.test.js` (25 ca), `backend/test/06-quyen-csdl.test.js` (7 ca, MongoDB bật xác thực), `e2e/production.test.js` (9 ca), `e2e/https.test.js` (5 ca) |

## 7. Điểm bổ sung ngoài tài liệu đặc tả và lưu ý vận hành

1. **Màn hình "Đổi mật khẩu"** không có trong Figma; được thêm vì yêu cầu bắt buộc số 4. Màn hình dùng lại nguyên bố cục, màu và thành phần của MH02 (đăng nhập nhân sự).
2. **"Danh sách cơ sở"**: thiết kế CSDL hiện không có thực thể "cơ sở"; cơ sở 76 Phạm Tứ được thể hiện qua 3 phòng P1–P3 trong danh mục phòng. Nhóm không tự thêm collection mới.
3. **Tra cứu nhật ký** chỉ có API, chưa có màn hình (không có trong Figma).
4. **Chỉ mục mới `UX_LichDay_NhanSu`** được tạo khi khởi động. Nếu sau này nâng cấp một CSDL cũ đang có nhân sự bị xếp trùng ca, máy chủ sẽ báo lỗi tạo chỉ mục: cần xử lý các buổi trùng trước (truy vấn kiểm tra: gom `lichDay` còn hiệu lực theo `phanCong.maNhanSu + ngayDay + maCa` có số lượng > 1). Bản golive đầu tiên không bị ảnh hưởng.
5. Tài khoản demo (`seed:demo`) giữ `mustChangePassword: false` để trình diễn; tuyệt đối không nạp demo lên máy chủ thật (lệnh đã tự chặn).
