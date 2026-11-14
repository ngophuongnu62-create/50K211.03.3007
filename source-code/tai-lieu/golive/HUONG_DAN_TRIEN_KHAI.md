# Hướng dẫn triển khai và vận hành

> Cài lên máy chủ thật để chạy 24/7: dùng trình cài đặt một lệnh `trien-khai/cai-dat-may-chu.sh` – xem `VAN_HANH_24_7.md`.
> Tài liệu này mô tả chi tiết từng thành phần để tự cấu hình hoặc xử lý sự cố.

## 1. Kiến trúc triển khai

```
Trình duyệt ──HTTP(S)──▶ app (Node.js 22: API /api + giao diện React đã build) ──▶ mongo (MongoDB 7, replica set rs0, BẬT XÁC THỰC)
                              │      đăng nhập bằng tài khoản ứng dụng "broadway_app"     │
                              └── volume "uploads"                                         ├── volume "mongo-data"   (dữ liệu)
                                                                                           └── volume "mongo-config" (keyfile)
              thiet-lap-csdl (chạy rồi thoát, tài khoản quản trị) ──▶ mongo: cấu trúc CSDL + vai trò + tài khoản ứng dụng
```

- Một image duy nhất (`Dockerfile`) gồm backend và giao diện, cổng 8080. MongoDB chạy dạng replica set 1 nút vì hệ thống dùng giao dịch.
- Mỗi lần khởi động: chạy `init-master-data` – chỉ **bổ sung** danh mục gốc còn thiếu (3 ca học, 12 phòng học gồm cơ sở 76 Phạm Tứ, 4 môn học) và tạo **một** tài khoản Quản lý khởi tạo nếu CSDL chưa có Quản lý nào. Không bao giờ xóa hay ghi đè dữ liệu có sẵn; chạy lại bao nhiêu lần cũng vậy.
- Bản production **không** chứa dữ liệu demo. Dữ liệu demo chỉ nạp được bằng lệnh riêng ở môi trường development / UAT (mục 8).
- **MongoDB bắt buộc đăng nhập** (`--keyFile`, keyfile ngẫu nhiên sinh một lần trong volume `mongo-config`). Có 2 tài khoản:

  | Tài khoản | Dùng cho | Quyền |
  | --- | --- | --- |
  | Quản trị `MONGO_ROOT_USER` (vai trò `root`) | Bước `thiet-lap-csdl`, sao lưu / khôi phục, xử lý sự cố | Toàn quyền – ứng dụng **không** dùng |
  | Ứng dụng `MONGO_APP_USER` (vai trò `broadwayApp`) | Ứng dụng web, `init-master-data` | Dữ liệu nghiệp vụ: đọc, thêm, sửa – **không xóa**, không đổi cấu trúc. `audit_logs`: **chỉ đọc và thêm** |

- Mỗi lần `docker compose up`, dịch vụ `thiet-lap-csdl` chạy trước bằng tài khoản quản trị: tạo collection / validator / chỉ mục còn thiếu, tạo hoặc cập nhật vai trò `broadwayApp` và tài khoản ứng dụng, rồi tự kiểm tra tài khoản ứng dụng không sửa / xóa được nhật ký. Lỗi ở bước này → ứng dụng không khởi động.
- Ứng dụng tự khởi động lại khi gặp sự cố (`restart: unless-stopped`), có kiểm tra sức khỏe `GET /api/suc-khoe` (báo 503 khi mất kết nối CSDL).

## 2. Yêu cầu máy chủ

- Máy chủ Linux (VD: Ubuntu 22.04/24.04), tối thiểu 1 vCPU, 2 GB RAM, 10 GB đĩa
- Docker Engine 24+ có Docker Compose v2 (`docker compose version`)
- Mở cổng 8080 (hoặc 80/443 nếu dùng tên miền với HTTPS)

## 3. Triển khai lần đầu

```bash
git clone https://github.com/nanguyen250226-art/broadways.git
cd broadways
cp .env.example .env
```

Mở tệp `.env` và đặt:

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `JWT_SECRET` | Có | Chuỗi ngẫu nhiên ≥ 32 ký tự (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | Có | Địa chỉ giao diện người dùng mở trên trình duyệt, VD `https://lichday.broadway.edu.vn` hoặc `http://192.168.1.10:8080`. API từ chối (403) mọi trang web khác |
| `MONGO_ROOT_PASSWORD` | Có | Mật khẩu tài khoản quản trị MongoDB (≥ 16 ký tự, `openssl rand -hex 24`) |
| `MONGO_APP_PASSWORD` | Có | Mật khẩu tài khoản ứng dụng MongoDB (≥ 16 ký tự, **khác** mật khẩu quản trị) |
| `MONGO_ROOT_USER`, `MONGO_APP_USER` | Không | Tên tài khoản, mặc định `quantri`, `broadway_app` |
| `ADMIN_EMAIL`, `ADMIN_SO_DIEN_THOAI` | Lần đầu | Thông tin tài khoản Quản lý khởi tạo |
| `ADMIN_MAT_KHAU_TAM` | Không | Để trống: hệ thống tự sinh mật khẩu tạm ngẫu nhiên và in một lần ra log |
| `TRUST_PROXY` | Khi có proxy | Đặt `1` khi chạy sau proxy ngược (tệp HTTPS của Caddy tự đặt) để giới hạn tần suất và nhật ký ghi đúng IP |
| `COMPOSE_FILE`, `TEN_MIEN`, `EMAIL_ACME` | Khi dùng HTTPS | Bật Caddy cho tên miền thật – xem mục 4 |
| `RATE_LIMIT_API_PHUT`, `RATE_LIMIT_DANG_NHAP` | Không | Mặc định 600 yêu cầu / phút / IP; 10 lần đăng nhập sai / 15 phút / IP + tài khoản |

Thiếu biến bắt buộc, `JWT_SECRET` yếu, `CORS_ORIGIN` là `*` hoặc sai dạng → ứng dụng **từ chối khởi động** và in rõ biến nào sai.

```bash
docker compose up -d --build
```

```bash
docker compose ps
```

```bash
curl http://localhost:8080/api/suc-khoe
```

Khi hai dịch vụ đều `healthy`, lấy mật khẩu tạm của tài khoản Quản lý khởi tạo (chỉ in một lần, ở lần khởi động đầu):

```bash
docker compose logs app | grep "Mật khẩu tạm"
```

Mở địa chỉ trong `CORS_ORIGIN`, chọn cổng Quản lý, đăng nhập `admin` + mật khẩu tạm. Hệ thống bắt buộc đổi sang mật khẩu riêng
(8–64 ký tự, có cả chữ và số) trước khi cho dùng bất kỳ chức năng nào. Sau đó nhập hồ sơ giáo viên (MH11): mỗi tài khoản mới
cũng nhận mật khẩu tạm và cũng bị bắt buộc đổi ở lần đăng nhập đầu.

## 4. Bật HTTPS cho tên miền thật (Caddy)

Repo có sẵn `docker-compose.https.yml` và `docker/caddy/Caddyfile`. Caddy đứng trước ứng dụng:
- **Chứng chỉ:** tự xin chứng chỉ Let's Encrypt (dự phòng ZeroSSL) và tự gia hạn trước khi hết hạn.
- **Chuyển hướng:** `http://` được chuyển vĩnh viễn sang `https://`.
- **Giao thức:** bật HTTP/2, HTTP/3; nén gzip / zstd.
- **Header:** thêm HSTS 1 năm, ẩn header `Server`.
- **IP người dùng:** truyền IP thật cho ứng dụng; header `X-Forwarded-For` do trình duyệt tự gửi bị bỏ qua.

Ứng dụng không còn mở cổng 8080 ra Internet (chỉ `127.0.0.1:8080` để kiểm tra trên máy chủ).

**Chuẩn bị (bắt buộc trước khi chạy):**

1. Bản ghi DNS `A` (và `AAAA` nếu máy chủ có IPv6) của tên miền trỏ về IP công khai của máy chủ. Kiểm tra: `dig +short lichday.ten-mien-cua-trung-tam.vn`.
2. Tường lửa / nhà cung cấp mở `80/tcp`, `443/tcp`, `443/udp` từ Internet. Let's Encrypt phải gọi được vào cổng 80 hoặc 443 để xác minh tên miền.
   Máy chủ chỉ chạy trong mạng nội bộ (Internet không vào được) thì **không** xin được chứng chỉ theo cách này.
3. Thêm vào `.env`:

```
COMPOSE_FILE=docker-compose.yml:docker-compose.https.yml
TEN_MIEN=lichday.ten-mien-cua-trung-tam.vn
EMAIL_ACME=email-nhan-canh-bao-chung-chi@ten-mien-cua-trung-tam.vn
CORS_ORIGIN=https://lichday.ten-mien-cua-trung-tam.vn
```

`COMPOSE_FILE` giúp mọi lệnh `docker compose …` tự dùng cả hai tệp. Tệp HTTPS tự đặt `TRUST_PROXY=1` và `CORS_ORIGIN=https://<TEN_MIEN>`
cho ứng dụng.

**Khuyến nghị: thử với máy chủ thử nghiệm của Let's Encrypt trước** (không tốn hạn mức; trình duyệt sẽ báo chứng chỉ không tin cậy –
bình thường ở bước này). Thêm vào `.env`:

```
CADDY_TUY_CHON=acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
```

```bash
docker compose up -d --build
```

```bash
docker compose logs caddy | grep -iE "certificate obtained|error"
```

Thấy `certificate obtained successfully` là tên miền, DNS, tường lửa đều đúng. Xóa dòng `CADDY_TUY_CHON` rồi chạy lại để lấy chứng chỉ thật:

```bash
docker compose up -d
```

Mở `https://<tên miền>`, kiểm tra ổ khóa trên trình duyệt. Kiểm thử tự động (chứng chỉ, chuyển hướng, header bảo mật, IP sau proxy, giao diện):

```bash
cd e2e && npm install && BASE_URL=https://<tên miền> E2E_TEN_DANG_NHAP=<tài khoản Quản lý> E2E_MAT_KHAU='<mật khẩu>' npm run test:https
```

Ghi chú vận hành:
- **Gia hạn:** chứng chỉ được gia hạn tự động.
- **Lưu chứng chỉ:** chứng chỉ và khóa nằm trong volume `caddy-data`. Không xóa volume này (xin lại liên tục dễ chạm hạn mức của Let's Encrypt).
- **Thêm `www.<tên miền>`:** tạo bản ghi DNS cho `www`, rồi thêm vào cuối `docker/caddy/Caddyfile`:

  ```
  www.{$TEN_MIEN} {
  	redir https://{$TEN_MIEN}{uri} permanent
  }
  ```

  Sau đó chạy `docker compose up -d`.
- **Sự cố không xin được chứng chỉ:** xem `docker compose logs caddy`. Thường do DNS chưa trỏ đúng, cổng 80/443 bị chặn, hoặc đã chạm hạn mức (dùng máy chủ thử nghiệm như trên).
- **Chạy thử khi chưa có tên miền:** đặt `TEN_MIEN=lichday.localhost`. Caddy tự cấp chứng chỉ từ CA nội bộ, trình duyệt không tin cậy chứng chỉ này. Chỉ dùng để thử.

## 5. Cập nhật phiên bản mới

Dữ liệu và tệp tải lên nằm trong volume nên được giữ nguyên.

```bash
git pull
docker compose up -d --build
```

**Nâng cấp từ bản chưa bật xác thực MongoDB** (bản trước ngày 11/11/2026): thêm `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD` vào `.env`,
nên sao lưu trước (lệnh cũ, chưa cần đăng nhập), rồi chạy lại hai lệnh trên. CSDL cũ đã có dữ liệu nên image không tự tạo tài khoản
quản trị; bước kiểm tra sức khỏe của `mongo` tự tạo tài khoản quản trị đầu tiên bằng ngoại lệ localhost của MongoDB (chỉ có hiệu lực
khi CSDL chưa có tài khoản nào), sau đó `thiet-lap-csdl` tạo vai trò và tài khoản ứng dụng. Dữ liệu giữ nguyên
(đã thử: 159 buổi dạy, 20 nhật ký, 15 collection trước và sau nâng cấp khớp nhau).

Đổi mật khẩu tài khoản ứng dụng: sửa `MONGO_APP_PASSWORD` trong `.env` rồi `docker compose up -d` (bước thiết lập đặt lại mật khẩu).
Mật khẩu quản trị chỉ đặt được ở lần khởi tạo; muốn đổi sau đó dùng `db.changeUserPassword` bằng tài khoản quản trị rồi sửa `.env` theo.

## 6. Sao lưu và khôi phục

Sao lưu (nên đặt lịch hằng ngày bằng cron):

Dùng tài khoản quản trị (đọc từ biến môi trường trong container, không phải gõ mật khẩu):

```bash
docker compose exec -T mongo sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db BroadwayDB --archive --gzip --quiet' > sao-luu-$(date +%F).archive.gz
```

```bash
docker run --rm -v broadway_uploads:/du-lieu -v "$PWD":/dich alpine tar czf /dich/tep-tai-len-$(date +%F).tgz -C /du-lieu .
```

Khôi phục (ghi đè dữ liệu hiện tại):

```bash
docker compose exec -T mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --drop --archive --gzip --quiet' < sao-luu-YYYY-MM-DD.archive.gz
```

Đã thử trên MongoDB bật xác thực: sao lưu rồi khôi phục sang một CSDL khác, số bản ghi của cả 15 collection khớp nhau.
Lưu giữ tệp sao lưu ở nơi khác máy chủ (tệp chứa toàn bộ dữ liệu, kể cả nhật ký).

## 7. Theo dõi và xử lý sự cố

| Việc cần làm | Lệnh |
| --- | --- |
| Xem nhật ký ứng dụng | `docker compose logs -f app` |
| Kiểm tra sức khỏe | `curl http://localhost:8080/api/suc-khoe` |
| Khởi động lại ứng dụng | `docker compose restart app` |
| Dừng toàn bộ (giữ dữ liệu) | `docker compose down` |
| Xóa sạch và cài lại từ đầu (**mất dữ liệu**) | `docker compose down -v` |
| Bổ sung danh mục gốc / tạo lại Admin khi lỡ xóa hết Quản lý | `docker compose exec app node src/seed/init-master-data.js` |
| Tra một lỗi người dùng báo (thông báo có "Mã tra cứu: xxxxxxxx") | `docker compose logs app \| grep xxxxxxxx` |
| Mở mongosh bằng tài khoản quản trị | `docker compose exec mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin BroadwayDB'` |
| Xem nhật ký thao tác gần nhất (trong mongosh) | `db.audit_logs.find().sort({thoiDiem:-1}).limit(20)` |
| Xem kết quả bước thiết lập CSDL | `docker compose logs thiet-lap-csdl` |
| Xem chứng chỉ / truy cập HTTPS | `docker compose logs caddy` |
| Kiểm tra ứng dụng trực tiếp (bỏ qua Caddy) khi bật HTTPS | `curl http://127.0.0.1:8080/api/suc-khoe` (chạy trên máy chủ) |

Nhật ký thao tác (`audit_logs`) còn tra được qua API chỉ đọc của Quản lý: `GET /api/quan-ly/nhat-ky?hanhDong=PHAN_CONG&tuNgay=2026-11-01&denNgay=2026-11-30&trang=1&soDong=20`.

### Nhật ký được khóa ở tầng CSDL

Ngoài việc ứng dụng chặn mọi lệnh sửa / xóa `audit_logs`, tài khoản MongoDB của ứng dụng (vai trò `broadwayApp`, định nghĩa ở
`backend/src/db/quyenCSDL.js`) chỉ có quyền `find` + `insert` trên `audit_logs`. Kể cả khi ứng dụng bị chiếm quyền, MongoDB vẫn từ chối:
xóa / sửa / thay nhật ký, xóa collection, tạo chỉ mục TTL để tự xóa nhật ký cũ, tắt validator, đổi tên collection, xóa chỉ mục, xóa CSDL,
tạo tài khoản mới hay tự cấp thêm quyền. Chỉ tài khoản quản trị mới làm được – giữ mật khẩu quản trị riêng, không đưa cho ứng dụng.

Khi khởi động, ứng dụng in ra tài khoản CSDL đang dùng và **cảnh báo** nếu tài khoản đó có quyền sửa / xóa nhật ký
(VD: lỡ cấu hình ứng dụng dùng tài khoản quản trị).

## 8. Môi trường thử nghiệm (UAT) và kiểm thử sau triển khai

**Không chạy trên máy chủ thật.** Dựng một bản riêng (CSDL trống), rồi:

```bash
cd backend && npm install && npm test
```

Kiểm thử đầu–cuối phần bảo mật trên bản vừa khởi tạo (chưa có dữ liệu demo), truyền mật khẩu tạm của Admin:

```bash
cd e2e && npm install && BASE_URL=http://<máy chủ>:8080 ADMIN_MAT_KHAU='<mật khẩu tạm>' npm run test:production:bao-cao
```

Nạp dữ liệu demo (chỉ chạy được ở `NODE_ENV=development` / UAT và khi CSDL chưa có dữ liệu nghiệp vụ; trên production lệnh tự từ chối).
Lệnh xóa dữ liệu cũ nên phải chạy bằng tài khoản quản trị (qua dịch vụ `thiet-lap-csdl`) – tài khoản ứng dụng không có quyền xóa:

```bash
docker compose run --rm -e NODE_ENV=development thiet-lap-csdl node src/seed/seed-demo.js
```

```bash
cd e2e && BASE_URL=http://<máy chủ>:8080 npm run test:bao-cao
```

## 9. Triển khai lên dịch vụ đám mây (phương án thay thế)

Image chạy được trên mọi nền tảng hỗ trợ Docker (Render, Railway, Fly.io, Google Cloud Run…), kết hợp MongoDB Atlas (cụm Atlas là replica set nên đáp ứng giao dịch):

1. Tạo cụm MongoDB Atlas, lấy chuỗi kết nối `mongodb+srv://<cụm>/BroadwayDB`.
2. Trong Atlas (Database Access) tạo **vai trò tùy chỉnh** `broadwayApp` với đúng các quyền ở bảng mục 1 (danh sách collection trong
   `backend/src/db/quyenCSDL.js`: nghiệp vụ `find, insert, update`; `audit_logs` chỉ `find, insert`; CSDL `listCollections`) và một
   tài khoản ứng dụng gán vai trò đó. Atlas không cho tạo vai trò bằng lệnh nên không dùng bước `thiet-lap-csdl` để tạo vai trò.
3. Đồng bộ cấu trúc CSDL một lần bằng tài khoản quản trị Atlas (máy có Node.js):
   `cd backend && MONGODB_URI='mongodb+srv://<quản trị>:<mật khẩu>@<cụm>/BroadwayDB' NODE_ENV=development node -e "require('./src/config/db').ketNoiCSDL().then(() => process.exit(0))"`.
4. Tạo dịch vụ web từ `Dockerfile` của repo, đặt biến môi trường `MONGODB_URI` (không kèm tài khoản), `MONGODB_USER` / `MONGODB_PASSWORD` (tài khoản ứng dụng),
   `MONGODB_DONG_BO_CAU_TRUC=0`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_SO_DIEN_THOAI`, `TRUST_PROXY=1` (mẫu: `backend/.env.production.example`).
5. Gắn ổ đĩa lâu dài vào `/data/uploads` (nếu nền tảng không có ổ đĩa lâu dài, ảnh và tệp tải lên sẽ mất sau mỗi lần triển khai).
6. Lần chạy đầu tự tạo danh mục gốc và tài khoản Admin (mật khẩu tạm in trong log của nền tảng) như mục 3.
