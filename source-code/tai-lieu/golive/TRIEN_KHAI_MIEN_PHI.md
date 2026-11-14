# Triển khai miễn phí (0 đồng) để chạy 24/7

Hướng dẫn đưa hệ thống lên máy chủ đám mây **miễn phí** + tên miền **miễn phí** có HTTPS. Phần cài đặt dùng chung trình cài đặt
một lệnh trong `VAN_HANH_24_7.md`. Các bước cần danh tính của bạn (đăng ký tài khoản, xác minh thẻ, tạo máy) phải do bạn tự làm.

> Hạn mức miễn phí thay đổi thường xuyên (Oracle đã giảm hạn mức trong năm 2026). Kiểm tra lại trang chính thức trước khi tạo máy:
> Oracle: https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm · Google: https://cloud.google.com/free/docs/free-cloud-features

## 1. Chọn nơi chạy

> **Là sinh viên, không có thẻ, không muốn dùng Oracle → dùng Azure for Students (mục 7).** Không cần sửa mã, chạy 24/7,
> 0 đồng trong 12 tháng nhờ tín dụng sinh viên.

| | **Oracle Cloud Always Free** (khuyến nghị) | Google Cloud e2-micro (dự phòng) |
| --- | --- | --- |
| Máy miễn phí | ARM Ampere A1: tổng tối đa **2 OCPU + 12 GB RAM** (đã giảm từ 4 OCPU / 24 GB trong năm 2026) | 1 máy e2-micro: 2 vCPU dùng chung, **1 GB RAM**, 30 GB ổ chuẩn (HDD) |
| Vị trí | Chọn **Singapore** – gần Việt Nam | Chỉ 3 vùng ở Mỹ (us-west1, us-central1, us-east1) |
| Thẻ ngân hàng | Cần để xác minh | Cần để xác minh |
| Chi phí thực tế | 0 đồng trong hạn mức | 90 ngày đầu 0 đồng (trừ vào tín dụng dùng thử); sau đó ước tính ≈ 3,65 USD/tháng cho IPv4 công khai (mục 6) |
| Điểm yếu | Oracle có thể **thu hồi máy "nhàn rỗi"** (mục 5); vùng phổ biến đôi khi hết máy ARM | 1 GB RAM nên build lần đầu chậm (10–20 phút); truy cập từ Việt Nam chậm hơn; dữ liệu ra ngoài vượt 1 GB/tháng bị tính phí |

**Không có thẻ, không có email sinh viên → dùng Render + MongoDB Atlas:** xem `TRIEN_KHAI_RENDER_ATLAS.md`. Ảnh bằng cấp và tệp
minh chứng nay lưu trong MongoDB (GridFS) nên không mất khi Render xóa ổ đĩa. Dịch vụ ngủ sau 15 phút không dùng; giữ thức bằng
dịch vụ ping (mục 4 của hướng dẫn đó).

## 2. Tên miền miễn phí (DuckDNS)

1. Vào https://www.duckdns.org, đăng nhập bằng GitHub hoặc Google.
2. Ô **sub domain** nhập tên muốn dùng, VD `broadway-lichday` → **add domain**. Tên miền của bạn: `broadway-lichday.duckdns.org`.
3. Sau khi tạo máy chủ (mục 3), điền **IP công khai** của máy vào ô **current ip** của tên miền đó → **update ip**.

Caddy tự xin chứng chỉ Let's Encrypt cho tên miền này, với điều kiện cổng 80 và 443 của máy chủ mở ra Internet.

## 3. Tạo máy chủ trên Oracle Cloud

1. **Đăng ký:** https://www.oracle.com/cloud/free → *Start for free*. Ở bước chọn **Home Region**, chọn **Singapore**.
   Vùng này không đổi được về sau, và máy miễn phí chỉ tạo được trong Home Region. Điền thông tin và xác minh thẻ.
2. **Tạo máy:** menu ☰ → *Compute* → *Instances* → *Create instance*:
   - **Image:** *Change image* → *Canonical Ubuntu* → **24.04**.
   - **Shape:** *Change shape* → *Ampere* → **VM.Standard.A1.Flex**, chọn **2 OCPU, 12 GB** (có nhãn *Always Free-eligible*).
   - **Networking:** tạo VCN mới, subnet công khai (*public subnet*), bật **Assign a public IPv4 address**.
   - **Add SSH keys:** *Generate a key pair for me* → **Save private key**. Giữ kỹ tệp này, mất là không vào được máy.
   - **Boot volume:** 50 GB là đủ.
   - Báo *Out of capacity*: thử lại sau ít giờ hoặc chọn *Availability domain* khác.
3. **Mở cổng web:** trang máy vừa tạo → *Subnet* → *Security Lists* → *Default Security List* → *Add Ingress Rules*, thêm 3 luật,
   cùng *Source CIDR* `0.0.0.0/0`:

   | IP Protocol | Destination Port |
   | --- | --- |
   | TCP | 80 |
   | TCP | 443 |
   | UDP | 443 |

   Ảnh Ubuntu của Oracle còn có tường lửa iptables chặn mọi cổng trừ SSH. Trình cài đặt tự phát hiện và mở cổng web, bạn không cần làm tay.
4. Ghi lại **Public IP** của máy, điền vào DuckDNS (mục 2, bước 3).

## 4. Cài hệ thống

Từ máy tính của bạn (Windows: PowerShell; macOS / Linux: Terminal), vào thư mục chứa tệp khóa vừa tải:

```bash
ssh -i ten-tep-khoa.key ubuntu@<Public-IP>
```

Trên Windows, nếu báo *UNPROTECTED PRIVATE KEY FILE*, chạy lệnh dưới (PowerShell) rồi SSH lại:

```powershell
icacls .\ten-tep-khoa.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

Trên máy chủ, chuyển sang quyền root:

```bash
sudo -i
```

Sau đó làm đúng **mục 2 của `VAN_HANH_24_7.md`**:
1. Tạo deploy key, thêm vào GitHub.
2. Clone repo về `/opt/broadway`.
3. Chạy trình cài đặt bằng lệnh dưới. Khi được hỏi tên miền, nhập `broadway-lichday.duckdns.org`.

```bash
cd /opt/broadway && bash trien-khai/cai-dat-may-chu.sh
```

Trình cài đặt chạy khoảng 10–15 phút trên máy ARM, rồi in ra địa chỉ `https://broadway-lichday.duckdns.org` và mật khẩu tạm của `admin`.

## 5. Lưu ý riêng cho gói miễn phí

- **Oracle thu hồi máy nhàn rỗi.**
  - Tài liệu Always Free của Oracle nói máy miễn phí nhàn rỗi có thể bị thu hồi.
  - Theo các nguồn tổng hợp, tiêu chí là trong 7 ngày, mức dùng CPU, mạng (và RAM với máy ARM) đều dưới khoảng 20%.
  - Hệ thống lịch dạy ít người dùng rất dễ chạm ngưỡng này.
  - Cách giảm rủi ro: nâng tài khoản lên **Pay As You Go** (*Billing → Upgrade*). Tài nguyên trong hạn mức Always Free vẫn không tính tiền.
  - Nếu nâng, đặt ngay **Budget** cảnh báo khi chi phí vượt 1 USD.
  - Oracle hay đổi chính sách, nên xác nhận với Oracle trước khi dựa vào điều này.
- **Không tạo máy vượt hạn mức** (VD 4 OCPU): Oracle sẽ tắt hoặc xóa máy vượt hạn mức miễn phí.
- **Sao lưu ra ngoài máy:** gói miễn phí không có bảo đảm dữ liệu, nên mỗi tuần tải bản sao lưu mới nhất về máy tính của bạn:

  ```bash
  ssh -i ten-tep-khoa.key ubuntu@<Public-IP> "sudo sh -c 'cat \$(ls -t /var/backups/broadway/csdl-*.archive.gz | head -1)'" > csdl-moi-nhat.archive.gz
  ```

- **Giám sát từ bên ngoài miễn phí:** đăng ký UptimeRobot (hoặc dịch vụ tương tự) gọi `https://broadway-lichday.duckdns.org/api/suc-khoe`
  mỗi 5 phút, báo qua email khi không truy cập được.

## 6. Google Cloud e2-micro (khi không dùng được Oracle)

**Chi phí thực tế – đọc trước khi làm.** Theo các nguồn năm 2026, máy e2-micro miễn phí nhưng **địa chỉ IPv4 công khai** gắn vào máy bị
tính khoảng **0,005 USD/giờ (≈ 3,65 USD/tháng)** từ khi Google áp giá IPv4 (2/2024). Một trang hướng dẫn cũ của Google lại ghi IP miễn phí.
Chưa đối chiếu được trang giá hiện hành (môi trường phát triển không truy cập được), nên hãy xem mục *Billing → Reports* sau vài ngày.
- 90 ngày đầu: phí này trừ vào **300 USD tín dụng dùng thử** → thực tế 0 đồng.
- Sau 90 ngày: phải **nâng lên tài khoản trả phí** (*Billing → Upgrade*), nếu không Google tắt máy và xóa sau 30 ngày. Phần trong hạn mức
  miễn phí vẫn 0 đồng; dự kiến chỉ trả tiền IPv4 (≈ 3,65 USD/tháng) và lưu lượng ra ngoài vượt 1 GB/tháng (nếu có).
- Ổ đĩa **phải** chọn *Standard persistent disk* – loại mặc định (*Balanced*) bị tính phí (≈ 3 USD/tháng).

**Các bước:**

1. Vào https://console.cloud.google.com → đăng nhập Gmail → **Start free / Dùng thử miễn phí**. Quốc gia: Việt Nam; xác minh bằng thẻ
   Visa/Mastercard có bật thanh toán quốc tế.
2. Ngay sau khi có tài khoản: *Billing → Budgets & alerts → Create budget* đặt **5 USD**, bật email cảnh báo.
3. Menu ☰ → *Compute Engine* → *VM instances* (lần đầu bấm *Enable* để bật Compute Engine API) → **Create instance**:
   - *Name*: `broadway`
   - *Region*: **us-west1 (Oregon)** (gần Việt Nam nhất trong 3 vùng miễn phí); *Zone*: để mặc định
   - *Machine configuration*: series **E2** → machine type **e2-micro**
   - *OS and storage* → *Change*: **Ubuntu**, phiên bản **Ubuntu 24.04 LTS (x86/64)**, *Boot disk type*: **Standard persistent disk**, *Size*: **30 GB**
   - *Networking*: tích **Allow HTTP traffic** và **Allow HTTPS traffic**
   - Bấm **Create**, chờ khoảng 1 phút.
4. Ghi lại **External IP** của máy (cột *External IP* trong danh sách VM) → điền vào DuckDNS (mục 2).
   Khởi động lại máy (*Reset* / `sudo reboot`) không đổi IP; **không bấm Stop** – Stop rồi Start có thể đổi IP, khi đó vào DuckDNS cập nhật lại.
5. Bấm nút **SSH** cạnh tên máy → cửa sổ dòng lệnh mở trên trình duyệt (không cần tệp khóa). Chạy `sudo -i`, rồi làm như **mục 4**
   (deploy key → clone → trình cài đặt, nhập tên miền DuckDNS).
   Máy chỉ có 1 GB RAM: trình cài đặt tự tạo swap 2 GB và đặt `MONGO_CACHE_GB=0.25`; lần build đầu có thể mất 15–25 phút.
6. **Trước ngày thứ 90**: *Billing* → **Upgrade** sang tài khoản trả phí để máy tiếp tục chạy.

## 7. Azure for Students – không cần thẻ (dành cho sinh viên)

Điều kiện: có **email sinh viên** của trường (VD đuôi `.edu.vn` của trường) để Microsoft xác minh. Theo trang Azure for Students:
**100 USD tín dụng dùng trong 12 tháng, không cần thẻ**, kèm **750 giờ/tháng** máy ảo nhỏ miễn phí (B1s, B2ats v2, B2pts v2);
gia hạn hằng năm khi còn là sinh viên. Máy chạy 24/7 cả tháng ≈ 744 giờ < 750 giờ → phần máy ảo miễn phí.
Các phần còn lại (IPv4 công khai, ổ đĩa) trừ vào 100 USD tín dụng – ước tính vài USD/tháng nên đủ dùng hết 12 tháng, không mất tiền thật.
Hết tín dụng / không còn là sinh viên → phải chuyển sang tài khoản trả phí hoặc dời sang máy chủ khác (dùng bản sao lưu).

1. Vào https://azure.microsoft.com/free/students → **Start free** → đăng nhập (tạo tài khoản Microsoft bằng email sinh viên) → xác minh email trường.
2. Cổng quản trị https://portal.azure.com → **Virtual machines** → **Create** → *Azure virtual machine*:
   - *Region*: **(Asia Pacific) Southeast Asia** (Singapore). Nếu báo vùng không được phép với gói sinh viên, chọn vùng khác trong danh sách cho phép.
   - *Image*: **Ubuntu Server 24.04 LTS – x64 Gen2**
   - *Size*: **B2ats v2** (2 vCPU AMD, 1 GiB RAM) hoặc **B1s** – chọn loại có ghi *free services eligible*
   - *Authentication*: **SSH public key** → *Generate new key pair* → tải tệp `.pem` khi tạo xong (giữ kỹ)
   - *Inbound ports*: chọn **SSH (22), HTTP (80), HTTPS (443)**
   - Thẻ *Disks*: *OS disk type* chọn **Standard SSD** (tiết kiệm tín dụng hơn Premium)
   - **Review + create** → **Create** → **Download private key**.
3. Tên miền miễn phí có sẵn của Azure (không cần DuckDNS): mở máy vừa tạo → **Public IP address** → *Configuration* →
   ô **DNS name label** nhập VD `broadway-lichday` → *Save*. Tên miền của bạn: `broadway-lichday.southeastasia.cloudapp.azure.com`
   (phần giữa theo vùng đã chọn – xem đúng tên ở trang Overview của máy).
4. SSH vào máy (PowerShell / Terminal, trong thư mục chứa tệp `.pem`; Windows báo *UNPROTECTED PRIVATE KEY FILE* thì xử lý như mục 4):

   ```bash
   ssh -i ten-tep-khoa.pem azureuser@<Public-IP>
   ```

5. `sudo -i` rồi làm như **mục 4** (deploy key → clone → trình cài đặt), nhập tên miền ở bước 3.
   Máy 1 GiB RAM: trình cài đặt tự tạo swap và giới hạn bộ nhớ đệm MongoDB; lần build đầu có thể mất 15–25 phút.
6. *Cost Management → Budgets*: đặt cảnh báo khi đã dùng **80 USD** tín dụng.

Chưa xác nhận được (cần xem lại khi tạo máy): danh sách vùng được phép của gói sinh viên, và IPv4 công khai có nằm trong phần miễn phí
hay trừ vào tín dụng.

## 8. Phạm vi đã kiểm thử

| Hạng mục | Đã kiểm thử | Chưa kiểm thử |
| --- | --- | --- |
| Trình cài đặt | Logic mở cổng iptables kiểu Oracle trên tệp luật mẫu: chèn trước luật chặn, không trùng khi chạy lại, tệp hợp lệ | Chạy trên máy Oracle / Google thật |
| Giới hạn bộ nhớ đệm MongoDB | Có hiệu lực: 256 MB khi đặt, mặc định khi không đặt | – |
| Ứng dụng | Toàn bộ hệ thống chạy trên Ubuntu 24.04 x86. Với ARM: đã xác nhận `mongo:7.0`, `node:22-alpine`, `caddy:2.11` có bản `linux/arm64`; lockfile giao diện có sẵn gói biên dịch ARM64 (Rolldown, LightningCSS); backend không có gói native | Chưa build và chạy thử trên máy ARM thật |
