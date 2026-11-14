# Bộ dữ liệu thử – Hệ thống quản lý lịch dạy Broadway

Bộ dữ liệu để nạp vào CSDL và **chạy thử toàn bộ hệ thống** (cả 3 vai trò). Gồm 1465 bản ghi trong 15 collection, ở dạng
MongoDB Extended JSON (`json/<collection>.json`, mỗi tệp là một mảng). **Chỉ nạp vào CSDL chạy thử / nghiệm thu** – nạp sẽ
thay toàn bộ dữ liệu của các collection đó, kể cả tài khoản.

- `json/` – dữ liệu (nạp theo một trong ba cách bên dưới).
- `KIEM_TRA_LOGIC.md` – kết quả tự kiểm tra: 21 quy tắc nghiệp vụ + gọi thử API thật trên chính bộ dữ liệu này.
- `thong-tin.json` – thời điểm "hiện tại" mà bộ dữ liệu được sinh cho, và số bản ghi.

Sinh lại (và tự kiểm tra lại): `cd backend && npm run sinh-du-lieu-thu` – mã nguồn `backend/scripts/sinh-du-lieu-thu.js`.

## Nguồn dữ liệu

| Dữ liệu | Lấy từ |
| --- | --- |
| 3 ca học (07:30–11:30, 13:30–16:30, 17:30–21:00), 12 phòng, 4 môn | Biên bản phỏng vấn + danh mục gốc `backend/src/seed/duLieuGoc.js` (giống hệt `init-master-data`) |
| Tên giáo viên, trợ giảng, quản lý, lớp, phòng, học viên tiêu biểu, ngày, mã phiếu | Ví dụ "VD:" trong đặc tả use case / màn hình Figma (Nguyễn Thị Lan, Trần Minh Quân, Phạm Thu Hà, Võ Ngọc Mai, David Miller, Lê Hoàng Anh, Trần Thu Trang, Nguyễn Minh An; IELTS Foundation – K15, Giao tiếp A2 – K08, TOEIC 650, Kids Starters – K03, IELTS 6.5; "Phòng P.102 thiếu máy chiếu"; "16/11/2026 → 08/03/2027"…) và bảng lịch AS-IS (GS Milky, GS Rabbit; Mandy, Haley, John; Ty Na, Tuyết Nhi, Như Ý) như dữ liệu mẫu sẵn có |
| Giá trị liệt kê (trạng thái lịch, loại phiếu, lý do nghỉ…) | Bảng giá trị Enum của đặc tả |
| Sĩ số ~15 học viên/lớp (10–20), báo vắng ~3% lượt học | Bảng 5.27 "Ước lượng dung lượng dữ liệu" của đặc tả (thu nhỏ còn 12 lớp) |
| Nhịp học 2 buổi/tuần (Thứ 3, 5 · Thứ 2, 4 · Thứ 7, CN; lớp GS 4 buổi/tuần), 3 tiết/buổi | Ví dụ lịch trên các màn hình của đặc tả – *không* theo giả định "3 buổi/tuần" chỉ dùng để ước lượng dung lượng |
| Quy tắc thời gian: lịch rảnh ≥ 5 ca/tuần, cập nhật Thứ Hai 08:00 – Thứ Năm 23:59 tuần trước; phản hồi / xác nhận trong 24 giờ; báo vắng trước giờ học ≥ 2 tiếng | Biên bản phỏng vấn + quy tắc nghiệp vụ (BR) của các use case |

**Phần tự tạo thêm (không có trong tài liệu):** tên và số điện thoại của các học viên còn lại (sinh ngẫu nhiên, cố định theo hạt
giống – chạy lại cho ra đúng bộ cũ), email / địa chỉ nhân sự, tên bằng cấp, nội dung các phiếu phản hồi, và ảnh bằng cấp / ảnh
minh chứng – là **ảnh minh họa** có dòng chữ "ẢNH MINH HỌA – DỮ LIỆU THỬ", không phải giấy tờ thật. Chỉ 1/12 phiếu có tệp đính kèm
(phiếu cơ sở vật chất "Phòng P.102 thiếu máy chiếu"), thấp hơn mức ~30% của Bảng 5.27: phiếu của giáo viên không kèm được tệp, và
các phiếu còn lại không có nội dung cần minh chứng.

## Bảo đảm logic

Mọi bản ghi được tạo đúng theo trình tự các use case (tạo lịch → phân công → gửi dự kiến → giáo viên xác nhận → phê duyệt → phát
hành → học viên xác nhận / báo vắng…), với **đúng nội dung thông báo và lịch sử thao tác mà hệ thống tự ghi** ở từng bước.
Trước khi xuất, bộ sinh ghi tất cả vào MongoDB tạm qua model của hệ thống (validator, `$jsonSchema`, chỉ mục chống trùng phòng /
lớp / giáo viên), kiểm tra 21 quy tắc và gọi thử API thật – xem `KIEM_TRA_LOGIC.md`. Một số điểm chính:

- Sĩ số lớp = số học viên được gán; phòng đủ sức chứa; số buổi × 3 tiết = tổng số tiết; buổi học nằm trong thời gian khóa học;
  trạng thái lớp (Chưa mở / Đang học / Kết thúc) khớp ngày học.
- Không trùng phòng, lớp, giáo viên, trợ giảng (kể cả với đăng ký phòng); giáo viên đúng chuyên môn; mỗi buổi tối đa 1 GV + 1 TG.
- Buổi được phân công nằm trong lịch rảnh đã đăng ký; học viên học 2 lớp không bị trùng giờ.
- Mọi mốc thời gian ≤ thời điểm "hiện tại"; phản hồi / xác nhận trong 24 giờ; báo vắng trước giờ học ≥ 2 tiếng.
- Lịch sử xử lý phiếu đúng chuỗi trạng thái; bộ đếm mã ≥ mã lớn nhất (tạo mới sau khi nạp không bị trùng mã).

## Thời điểm của bộ dữ liệu – quan trọng

Bộ dữ liệu được sinh cho **Thứ Bảy, 14/11/2026 lúc 06:54** (xem `thong-tin.json`). Hệ thống chạy theo đồng hồ thật, nên
nạp trong vòng vài giờ sau mốc đó thì mọi màn hình khớp nhất (tuần này / tuần tới, "còn … giờ để phản hồi"…). Nạp vào ngày khác thì sinh lại cho
đúng thời điểm nạp (phải là Thứ Sáu, Thứ Bảy hoặc Chủ Nhật – sau khi cổng đăng ký lịch rảnh tuần tới đã đóng):

```bash
cd backend && npm run sinh-du-lieu-thu -- --luc 2026-11-20T14:00:00+07:00
```

## Cách nạp

Cách 1 – bằng lệnh của dự án (khuyên dùng; tự tạo collection / validator / chỉ mục còn thiếu, có xác nhận trước khi ghi đè):

```bash
cd backend && npm run nap-du-lieu-thu
```

Nạp vào CSDL MongoDB Atlas mà bản Render đang dùng – chạy trên máy cá nhân (đã `npm install` trong `backend`), lấy **3 giá trị
giống hệt mục Environment của dịch vụ trên Render**: `MONGODB_URI` (không chứa tài khoản), `MONGODB_USER`, `MONGODB_PASSWORD`.
Atlas → Network Access phải cho phép IP máy đang chạy (hướng dẫn triển khai đã mở `0.0.0.0/0`). PowerShell trên Windows:

```powershell
cd backend
$env:MONGODB_URI="mongodb+srv://<cụm>.mongodb.net/BroadwayDB?retryWrites=true&w=majority"
$env:MONGODB_USER="<tài khoản>"
$env:MONGODB_PASSWORD="<mật khẩu>"
npm run nap-du-lieu-thu -- --xac-nhan
```

Thành công khi dòng đầu ghi `database "BroadwayDB"` (đúng tên database trong `MONGODB_URI` của Render) và dòng cuối ghi
`Xong: … bản ghi`. Không cần khởi động lại dịch vụ trên Render. Đã có tài khoản quản lý trong dữ liệu nên Render không tạo lại
tài khoản `admin` khi khởi động.

Cách 2 – `mongoimport` (MongoDB Database Tools), mỗi collection một lệnh, ví dụ:

```bash
mongoimport --uri "<chuỗi kết nối>/BroadwayDB" --collection lichDay --jsonArray --drop --file json/lichDay.json
```

Lặp lại cho cả 15 tệp (tên collection = tên tệp, kể cả `tepTaiLen.files` và `tepTaiLen.chunks` chứa ảnh). Cách này không tạo
validator / chỉ mục: CSDL phải được hệ thống khởi tạo trước (chạy ứng dụng hoặc `npm run init-master-data` một lần).

Cách 3 – MongoDB Compass: mở từng collection → **Add Data → Import JSON or CSV file** → chọn tệp tương ứng (xóa dữ liệu cũ của
collection trước khi nhập).

Sau khi nạp: đăng nhập Quản lý `quanly` / mật khẩu `Broadway@2026`. Tài khoản quản lý cũ trong CSDL (nếu có) bị thay bằng
tài khoản của bộ dữ liệu; nhật ký hệ thống (`audit_logs`) không bị đụng tới.

## Tổng quan dữ liệu (tự sinh)

Thời điểm "hiện tại" của bộ dữ liệu: **Thứ Bảy, 14/11/2026 lúc 06:54** · tuần này 09/11 – 15/11/2026, tuần tới 16/11 – 22/11/2026.

14 tài khoản nhân sự (2 quản lý, 8 giáo viên, 4 trợ giảng) ·
170 học viên (12 học 2 lớp) · 12 lớp · 185 buổi dạy ·
144 bản lịch rảnh · 1857 lượt xác nhận ca học · 33 lượt báo vắng · 8 đăng ký phòng ·
12 phiếu phản hồi · 836 thông báo · 18 tệp ảnh.

### Lớp học

| Mã lớp | Tên lớp | Sĩ số | Số tiết | Lịch | Thời gian | Giáo viên / trợ giảng | Trạng thái lớp | Trạng thái lịch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IEF-K14 | IELTS Foundation – K14 | 16 | 48 | Thứ 3, 5 · Ca 3 · P.201 | 01/09 → 22/10/2026 (16 buổi) | Nguyễn Thị Lan + TG Ty Na | Kết thúc | Đã phát hành |
| IEF-K15 | IELTS Foundation – K15 | 16 | 48 | Thứ 3, 5 · Ca 3 · P.201 | 27/10 → 17/12/2026 (16 buổi) | Nguyễn Thị Lan + TG Ty Na | Đang học | Đã phát hành |
| GT-A2-08 | Giao tiếp A2 – K08 | 16 | 48 | Thứ 2, 4 · Ca 2 · P.102 | 26/10 → 16/12/2026 (16 buổi) | Trần Minh Quân + TG Lê Hoàng Anh | Đang học | Đã phát hành |
| GT-B1-09 | Giao tiếp B1 – K09 | 14 | 36 | Thứ 2, 4 · Ca 3 · P.202 | 16/11 → 23/12/2026 (12 buổi) | Nguyễn Thị Lan | Chưa mở | Chờ GV xác nhận |
| TOEIC-K05 | TOEIC 650 – K05 | 20 | 42 | Thứ 3, 5 · Ca 3 · P.301 | 17/11 → 31/12/2026 (14 buổi) | Phạm Thu Hà | Chưa mở | Đã duyệt |
| TOEIC-K06 | TOEIC 650 – K06 | 18 | 42 | Thứ 2, 4 · Ca 2 · P.301 | 16/11 → 30/12/2026 (14 buổi) | — | Chưa mở | Nháp |
| Kids-K03 | Kids Starters – K03 | 12 | 60 | Thứ 7, CN · Ca 2 · P.101 | 17/10 → 20/12/2026 (20 buổi) | Võ Ngọc Mai + TG Như Ý | Đang học | Đã phát hành |
| Kids-K04 | Kids Movers – K04 | 12 | 60 | Thứ 3, 5 · Ca 2 · P.101 | 17/11 → 21/01/2027 (20 buổi) | Võ Ngọc Mai | Chưa mở | Chờ GV xác nhận (GV đã xác nhận đủ → chờ phê duyệt) |
| IE65-K12 | IELTS 6.5 – K12 | 18 | 48 | Thứ 3, 5 · Ca 3 · P.202 | 17/11 → 07/01/2027 (16 buổi) | — | Chưa mở | Nháp |
| IE65-K13 | IELTS 6.5 – K13 | 18 | 48 | — | Chưa xếp lịch | — | Chưa mở | — |
| GS-MILKY | GS Milky – U15 | 12 | 60 | Thứ 2, 3, 4, 5 · Ca 3 · P.302 | 26/10 → 26/11/2026 (20 buổi) | Mandy + TG Tuyết Nhi | Đang học | Đã phát hành |
| GS-RABBIT | GS Rabbit – U29 | 10 | 60 | Thứ 7, CN · Ca 1 · P.303 | 17/10 → 20/12/2026 (20 buổi) | Haley | Đang học | Đã phát hành |

### Nhân sự (mật khẩu chung `Broadway@2026`)

Lịch rảnh là bản đã đăng ký cho tuần tới.

| Mã | Họ tên | Tên đăng nhập | Loại | Hình thức | Kinh nghiệm | Chuyên môn | Lịch rảnh tuần tới | Đang dạy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GV-001 | Nguyễn Thị Lan | `gvnguyenlan` | Giáo viên | Toàn thời gian | 6 năm | IELTS, Tiếng Anh giao tiếp | T2 C3, T3 C3, T4 C3, T5 C3, T6 C1, T7 C1 | IEF-K15, GT-B1-09 |
| GV-002 | Trần Minh Quân | `gvtranquan` | Giáo viên | Bán thời gian | 4 năm | Tiếng Anh giao tiếp | T2 C2, T3 C2, T5 C2, T6 C2, T7 C1 | GT-A2-08 |
| GV-003 | Phạm Thu Hà | `gvphamha` | Giáo viên | Toàn thời gian | 5 năm | IELTS, TOEIC | T2 C2, T4 C2, T3 C3, T5 C3, T7 C1 | TOEIC-K05 |
| GV-004 | Võ Ngọc Mai | `gvvomai` | Giáo viên | Toàn thời gian | 3 năm | Tiếng Anh thiếu nhi, Tiếng Anh giao tiếp | T3 C2, T5 C2, T7 C2, CN C2, T2 C1, T6 C1 | Kids-K03, Kids-K04 |
| GV-005 | David Miller | `gvdavid` | Giáo viên | Bán thời gian | 3 năm | IELTS | T3 C3, T5 C3, T2 C3, T4 C2, T6 C1 | — |
| GV-006 | Mandy | `gvmandy` | Giáo viên | Bán thời gian | 4 năm | Tiếng Anh thiếu nhi | T2 C3, T3 C3, T4 C3, T5 C3, T6 C3 | GS-MILKY |
| GV-007 | Haley | `gvhaley` | Giáo viên | Bán thời gian | 2 năm | Tiếng Anh thiếu nhi | T7 C1, CN C1, T2 C2, T3 C2, T4 C2 | GS-RABBIT |
| GV-008 | John | `gvjohn` | Giáo viên | Bán thời gian | 5 năm | Tiếng Anh thiếu nhi, Tiếng Anh giao tiếp | T2 C1, T4 C2, T6 C2, T7 C2, CN C3 | — |
| TG-001 | Lê Hoàng Anh | `tgleanh` | Trợ giảng | Toàn thời gian | 2 năm | Tiếng Anh giao tiếp | T2 C2, T4 C2, T7 C1, T3 C1, T5 C1 | GT-A2-08 |
| TG-002 | Ty Na | `tgtyna` | Trợ giảng | Bán thời gian | 1 năm | — | T3 C3, T5 C3, T6 C3, T2 C1, T4 C1 | IEF-K15 |
| TG-003 | Tuyết Nhi | `tgtuyetnhi` | Trợ giảng | Bán thời gian | 1 năm | — | T2 C3, T3 C3, T4 C3, T5 C3, T6 C3 | GS-MILKY |
| TG-004 | Như Ý | `tgnhuy` | Trợ giảng | Bán thời gian | 1 năm | — | T7 C2, CN C2, T3 C2, T5 C2, T2 C1 | Kids-K03 |

Quản lý: `quanly` (Trần Thu Trang), `quanly2` (Lê Minh Hoàng) – cùng mật khẩu.

### Phụ huynh / học viên tiêu biểu (đăng nhập bằng họ tên học viên + số điện thoại)

| Họ tên học viên | Số điện thoại | Lớp | Dùng để thử |
| --- | --- | --- | --- |
| Nguyễn Minh An | 0905000456 | IEF-K15, GT-A2-08 | Học 2 lớp → màn hình Chọn lớp; có báo vắng sẵn buổi tuần tới; có phiếu "Phòng P.102 thiếu máy chiếu" đã xử lý |
| Lê Văn Bình | 0934556778 | GT-B1-09 | Lịch dự kiến tuần tới **chưa xác nhận** (còn hạn 24 giờ) → thử xác nhận / từ chối |
| Đỗ Thị Hằng | 0905667889 | GT-A2-08 | Thời khóa biểu có buổi bù Thứ Bảy; phiếu góp ý đã được trả lời |
| Trần Gia Huy | 0912345001 | Kids-K03 | Thiếu nhi; cùng số điện thoại với em Trần Gia Hân (GS Milky) |
| Phạm Bảo Ngọc | 0912345002 | Kids-K04 | Lớp chờ phê duyệt, đã xác nhận lịch dự kiến |
| Vũ Thanh Tâm | 0912345004 | TOEIC-K05 | Lớp đã duyệt, chờ phát hành; phiếu chờ xử lý |

## Tình huống có sẵn để thử

- **Quản lý**: trang chủ có cảnh báo *Sai lịch rảnh* của Trần Minh Quân (đã xin nghỉ Thứ Tư tuần tới và bỏ ca đó khỏi lịch rảnh) –
  vào *Lập lịch tuần tới* để chọn giáo viên dạy thay (John rảnh, đúng chuyên môn). Hệ thống dùng mẫu lịch rảnh tuần gần nhất cho các
  tuần chưa đăng ký nên cảnh báo lặp lại ở các Thứ Tư sau trong 28 ngày tới – đúng thiết kế, hết khi giáo viên đăng ký các tuần đó.
- **Quản lý**: *Kids Movers – K04* đủ điều kiện phê duyệt → phát hành; *TOEIC 650 – K05* đã duyệt → phát hành;
  *TOEIC 650 – K06*, *IELTS 6.5 – K12* là bản nháp → phân công (hệ thống đề xuất Phạm Thu Hà, David Miller);
  *IELTS 6.5 – K13* chưa có lịch → tạo lịch; 5 phiếu chờ xử lý (xin nghỉ phép, xin đổi lịch, góp ý…); đăng ký / hủy phòng.
- **Giáo viên** `gvnguyenlan`: 12 ca *Giao tiếp B1 – K09* chờ phản hồi (hạn Thứ Bảy, 14/11/2026 22:00) → xác nhận / đề xuất thay đổi; cập nhật lịch rảnh.
- **Phụ huynh** Lê Văn Bình – 0934556778: lịch dự kiến *Giao tiếp B1 – K09* chưa xác nhận → xác nhận / từ chối.
  Nguyễn Minh An – 0905000456: học 2 lớp, đã báo vắng sẵn một buổi tuần tới (thử báo vắng buổi khác), có phiếu đã được trả lời.
- *Giao tiếp A2 – K08*: buổi Thứ Tư tuần này đã hủy khi lập lịch tuần (P.102 thay máy chiếu), có buổi bù Thứ Bảy.
