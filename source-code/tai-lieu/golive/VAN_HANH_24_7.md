# Vận hành 24/7 trên máy chủ riêng

Mục tiêu: hệ thống luôn truy cập được, kể cả khi máy tính của bạn tắt. Muốn vậy hệ thống phải chạy trên một **máy chủ luôn bật,
luôn có Internet**, không chạy trên máy tính cá nhân. Tài liệu này hướng dẫn thuê máy chủ, cài đặt bằng một lệnh, và các việc
hệ thống tự làm để chạy liên tục.

## 1. Chọn máy chủ

> Muốn **0 đồng**: dùng máy chủ miễn phí Oracle Cloud Always Free (hoặc Google Cloud e2-micro) + tên miền miễn phí DuckDNS –
> xem `TRIEN_KHAI_MIEN_PHI.md`, sau đó quay lại mục 2 bên dưới.

| Phương án | Khi nào nên dùng | Ghi chú |
| --- | --- | --- |
| **Thuê VPS (khuyến nghị)** | Hầu hết trường hợp | Trung tâm dữ liệu có điện và mạng dự phòng. Chọn nhà cung cấp đặt máy tại Việt Nam (Viettel IDC, VNPT, FPT Cloud, BizFly Cloud…) để truy cập nhanh từ Đà Nẵng, hoặc nhà cung cấp quốc tế (DigitalOcean, Vultr, Linode…) |
| Máy chủ đặt tại trung tâm | Đã có sẵn máy + IP tĩnh | Cần UPS, mạng ổn định, mở cổng trên router; mất điện / mất mạng tại trung tâm là hệ thống ngừng |
| Dịch vụ miễn phí kiểu "ngủ khi không dùng" | Không dùng | Tự tắt khi vắng truy cập, không đạt 24/7 |

Cấu hình VPS: **Ubuntu 24.04 (hoặc 22.04)**, tối thiểu **2 GB RAM, 1–2 vCPU, 20 GB SSD** (khuyến nghị 40 GB để giữ bản sao lưu),
có **IPv4 công khai**. MongoDB 7 cần CPU hỗ trợ AVX – trình cài đặt tự kiểm tra và báo nếu không đạt.

Tên miền (khuyến nghị, để có HTTPS): tạo bản ghi DNS **A** trỏ tên miền (VD `lichday.broadway.edu.vn`) về IP của VPS.
Chưa có tên miền thì vẫn chạy được bằng `http://<IP>:8080` (không mã hóa – chỉ nên dùng tạm).

## 2. Cài đặt (làm một lần, khoảng 15–20 phút)

Mọi lệnh dưới đây gõ trong cửa sổ SSH tới máy chủ (Windows: mở PowerShell; macOS / Linux: mở Terminal):

```bash
ssh root@<IP-máy-chủ>
```

**Bước 1 – Cho máy chủ đọc được repo riêng tư** bằng khóa chỉ-đọc (deploy key), không cần đưa mật khẩu GitHub lên máy chủ:

```bash
apt-get update && apt-get install -y git
```

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/broadway_deploy -C "may-chu-broadway"
```

```bash
cat ~/.ssh/broadway_deploy.pub
```

Sao chép dòng vừa in → GitHub, repo `broadways` → **Settings → Deploy keys → Add deploy key** → dán vào, **không** chọn
"Allow write access" → Add key. Sau đó:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/broadway_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

```bash
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

```bash
git clone git@github.com:nanguyen250226-art/broadways.git /opt/broadway
```

**Bước 2 – Chạy trình cài đặt:**

```bash
cd /opt/broadway && sudo bash trien-khai/cai-dat-may-chu.sh
```

Trình cài đặt hỏi 3–4 câu (tên miền, email nhận thông báo chứng chỉ, email và số điện thoại tài khoản Quản lý), rồi tự:
kiểm tra máy, đặt múi giờ Việt Nam, tạo swap nếu RAM ít, cài Docker, bật tường lửa (chỉ mở SSH + cổng web), tạo `.env` với
mật khẩu / khóa bí mật ngẫu nhiên, build và khởi động hệ thống, cài lịch sao lưu + tự giám sát, bật tự cập nhật bản vá bảo mật,
chạy thử sao lưu lần đầu. Cuối cùng in ra địa chỉ truy cập và **mật khẩu tạm của tài khoản `admin`** (chỉ hiện một lần – đăng nhập
ngay, hệ thống bắt buộc đổi mật khẩu).

Nếu nhà cung cấp VPS có tường lửa riêng (Security Group / Firewall trên trang quản trị), mở thêm ở đó: `22/tcp`, `80/tcp`,
`443/tcp`, `443/udp` (có tên miền) hoặc `8080/tcp` (chưa có tên miền).

Chạy lại trình cài đặt bất cứ lúc nào cũng an toàn: không ghi đè `.env`, không xóa dữ liệu.

## 3. Hệ thống tự làm gì để chạy liên tục

| Tình huống | Cơ chế tự xử lý | Đã kiểm chứng |
| --- | --- | --- |
| Ứng dụng / CSDL bị lỗi và thoát | Docker tự khởi động lại (`restart: unless-stopped`) | Có |
| Máy chủ khởi động lại (bảo trì, cập nhật, mất điện rồi có lại) | Dịch vụ Docker bật cùng máy, tự chạy lại toàn bộ; không cần đăng nhập làm gì | Có – tắt hẳn Docker rồi bật lại: HTTPS trả lời sau 3 giây, dữ liệu còn nguyên, 24/24 kiểm thử nghiệp vụ đạt |
| Dịch vụ bị dừng / không có container | `giam-sat.sh` (mỗi 2 phút) chạy lại `docker compose up -d` | Có (dừng ứng dụng; dừng CSDL) |
| Ứng dụng còn chạy nhưng treo / mất kết nối CSDL (Docker không tự xử lý) | `giam-sat.sh` khởi động lại dịch vụ "unhealthy" đã chạy quá 5 phút | Có |
| Container bị tạm dừng | `giam-sat.sh` cho chạy tiếp | Có |
| Log phình to sau nhiều tháng | Mỗi dịch vụ tối đa 5 × 10 MB; log của các kịch bản xoay vòng hằng tuần | Cấu hình |
| Mất dữ liệu | Sao lưu CSDL + tệp tải lên lúc 02:30 hằng ngày vào `/var/backups/broadway`, giữ 14 ngày, kiểm tra toàn vẹn trước khi lưu | Có – khôi phục thử sang CSDL khác: 15/15 collection, 257/257 bản ghi khớp |
| Chứng chỉ HTTPS hết hạn | Caddy tự gia hạn | Cấu hình (mục 4 `HUONG_DAN_TRIEN_KHAI.md`) |
| Lỗ hổng bảo mật hệ điều hành | Tự cài bản vá bảo mật (unattended-upgrades) | Cấu hình |
| Ổ đĩa gần đầy | `giam-sat.sh` ghi cảnh báo khi dùng trên 90% | Cấu hình |
| Cập nhật phiên bản lỗi giữa chừng | `cap-nhat.sh` sao lưu trước; build lỗi thì bản đang chạy vẫn giữ nguyên | Có – build lỗi, hệ thống vẫn trả lời bình thường |

## 4. Việc của người vận hành

| Tần suất | Việc | Lệnh |
| --- | --- | --- |
| Một lần | Đăng ký dịch vụ giám sát từ bên ngoài miễn phí (VD UptimeRobot, Better Stack) gọi `https://<tên miền>/api/suc-khoe` mỗi 5 phút, báo qua email / Telegram khi không truy cập được. Giám sát bên trong không báo được khi cả máy chủ ngừng | – |
| Một lần | Bật sao lưu / snapshot tự động của nhà cung cấp VPS (bản sao nằm ngoài máy chủ) | Trang quản trị VPS |
| Hằng tuần | Xem nhật ký giám sát (trống là tốt) và bản sao lưu mới nhất | `tail /var/log/broadway-giam-sat.log` · `ls -lh /var/backups/broadway` |
| Hằng tháng | Tải một bản sao lưu về máy khác | `scp root@<IP>:/var/backups/broadway/csdl-*.archive.gz .` |
| Khi có bản vá nhân hệ điều hành (có tệp `/var/run/reboot-required`) | Khởi động lại máy chủ vào giờ vắng người dùng – hệ thống tự chạy lại | `sudo reboot` |
| Khi có phiên bản mới trên GitHub | Cập nhật (tự sao lưu trước, giữ nguyên dữ liệu) | `sudo /opt/broadway/trien-khai/cap-nhat.sh` |

Xem trạng thái nhanh:

```bash
cd /opt/broadway && docker compose ps
```

Khôi phục từ một bản sao lưu (ghi đè dữ liệu hiện tại):

```bash
cd /opt/broadway && docker compose exec -T mongo sh -c 'mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --drop --archive --gzip --quiet' < /var/backups/broadway/csdl-YYYY-MM-DD-HHMM.archive.gz
```

```bash
cd /opt/broadway && docker compose exec -T app tar xzf - -C /data/uploads < /var/backups/broadway/tep-tai-len-YYYY-MM-DD-HHMM.tgz
```

## 5. Tệp liên quan

| Tệp | Vai trò |
| --- | --- |
| `trien-khai/cai-dat-may-chu.sh` | Trình cài đặt một lệnh cho máy chủ Ubuntu / Debian |
| `trien-khai/sao-luu.sh` | Sao lưu CSDL + tệp tải lên, xóa bản cũ hơn 14 ngày (`GIU_NGAY`, `THU_MUC_SAO_LUU` để đổi) |
| `trien-khai/giam-sat.sh` | Tự phát hiện và khởi động lại dịch vụ dừng / treo; cảnh báo ổ đĩa |
| `trien-khai/cap-nhat.sh` | Sao lưu → lấy mã mới → build → khởi động lại → kiểm tra sức khỏe |
| `/etc/cron.d/broadway` | Lịch chạy sao lưu (02:30) và giám sát (mỗi 2 phút) – do trình cài đặt tạo |

## 6. Phạm vi đã kiểm thử

Trong môi trường phát triển (Ubuntu 24.04, Docker 29, Compose 5) đã chạy thật:
- `sao-luu.sh`, kèm khôi phục thử bản sao lưu;
- `giam-sat.sh` với 5 tình huống: dừng ứng dụng, dừng CSDL, ứng dụng treo do mất kết nối CSDL, container bị tạm dừng, hệ thống bình thường (không làm gì);
- giả lập khởi động lại máy chủ;
- `cap-nhat.sh`. Riêng bước build trong lần thử này dùng image build sẵn, vì môi trường phát triển phải đi qua proxy.

Riêng **trình cài đặt `cai-dat-may-chu.sh` chưa được chạy trọn trên một VPS thật**. Phần này thay đổi cấu hình hệ thống:
- cài Docker từ kho chính thức;
- bật ufw;
- tạo lịch cron;
- bật tự cập nhật bản vá.

Môi trường phát triển không cho phép các thay đổi đó, nên mới chỉ kiểm tra cú pháp và từng thành phần. Lần chạy đầu trên máy chủ
thật nên có người theo dõi màn hình. Nếu có bước báo lỗi, chạy lại sau khi sửa vẫn an toàn.
