# Triển khai miễn phí: Render + MongoDB Atlas (không cần thẻ)

Ứng dụng (API + giao diện) chạy trên **Render** gói Free; dữ liệu nằm trên **MongoDB Atlas** gói Free (trước đây gọi là M0).
Không cần thẻ ngân hàng, không cần máy chủ riêng, có sẵn HTTPS và tên miền `*.onrender.com`.

> Hạn mức miễn phí thay đổi thường xuyên. Kiểm tra lại trang chính thức trước khi làm:
> Render: https://render.com/docs/free · Atlas: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/

## 1. Những thay đổi mã để chạy được trên Render

Render bản miễn phí **xóa ổ đĩa mỗi lần khởi động lại** (mỗi lần cập nhật, mỗi lần dịch vụ "ngủ" rồi thức). Vì vậy:

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Ảnh bằng cấp (UC_3.2, 3.3), tệp minh chứng (UC_14) | Ghi vào thư mục `UPLOAD_DIR` trên ổ đĩa | Ghi vào MongoDB, bucket GridFS `tepTaiLen` (collection `tepTaiLen.files`, `tepTaiLen.chunks`) |
| Đường dẫn lưu trong CSDL | `/uploads/bangcap/<tên>`, `/uploads/phanhoi/<tên>` | **Không đổi** – giao diện không phải sửa |
| Phục vụ tệp | Đọc từ ổ đĩa | Đọc từ GridFS; không có thì đọc thư mục `UPLOAD_DIR` (tệp của bản cũ, nếu có) |
| Kiểm tra tệp | Loại tệp, ≤ 5 MB, ≤ 5 tệp, chữ ký nội dung (chặn tệp đổi đuôi) | **Giữ nguyên** |
| Yêu cầu bị từ chối (dữ liệu sai, trùng SĐT/email…) | Xóa tệp vừa nhận trên ổ đĩa | Xóa tệp vừa nhận khỏi GridFS |
| Cấu hình Render | – | `render.yaml` ở thư mục gốc repo |

Điểm bổ sung ngoài tài liệu thiết kế CSDL (mục 5.3.3 ghi "tệp lưu trên thư mục, CSDL giữ đường dẫn"): nội dung tệp nay nằm trong
MongoDB. Bản Docker Compose cũng dùng cách lưu mới. Bản sao lưu `mongodump` đã gồm luôn tệp; volume `uploads` chỉ còn giữ tệp cũ.

Quyền của tài khoản ứng dụng (bản Docker Compose, vai trò `broadwayApp`) trên 2 collection GridFS: `find`, `insert`, `remove`,
`listIndexes`. Không sửa được tệp đã lưu. Quyền `remove` chỉ dùng để dọn tệp của yêu cầu bị từ chối. Nhật ký `audit_logs`
vẫn chỉ được đọc và thêm.

## 2. Tạo CSDL trên MongoDB Atlas

1. Vào https://www.mongodb.com/cloud/atlas/register và đăng ký bằng email hoặc Google. Không cần thẻ.
2. **Tạo cụm:** *Create* → chọn **Free**, *Provider*: AWS, *Region*: **Singapore (ap-southeast-1)**. Đặt tên, VD `broadway` → *Create Deployment*.
3. **Tạo tài khoản CSDL** (*Security → Database Access → Add New Database User*):
   - *Authentication Method*: Password. Tên VD `broadway_app`. Bấm *Autogenerate Secure Password* rồi **chép lại mật khẩu**.
   - *Database User Privileges* → *Add Specific Privilege*, thêm 2 dòng, cùng *Database* là `BroadwayDB`:
     - `readWrite`
     - `dbAdmin` (để ứng dụng tự áp validator và tạo chỉ mục khi khởi động)
   - *Add User*.
4. **Cho phép kết nối** (*Security → Network Access → Add IP Address*): chọn **Allow access from anywhere** (`0.0.0.0/0`).
   Render gói Free không có địa chỉ IP cố định nên phải mở. Tài khoản và mật khẩu mạnh ở bước 3 là lớp bảo vệ chính.
5. **Lấy địa chỉ cụm:** *Database → Clusters → Connect → Drivers*. Chép phần tên máy trong chuỗi kết nối, VD
   `cluster0.abcde.mongodb.net`. Chuỗi dùng cho Render (**không** ghi tài khoản vào đây):

   ```
   mongodb+srv://cluster0.abcde.mongodb.net/BroadwayDB?retryWrites=true&w=majority
   ```

**Khác với bản Docker Compose:** Atlas không cho tạo vai trò bằng lệnh. Vì vậy bước `thiet-lap-csdl.js` không chạy được ở đây, và
tài khoản ở bước 3 có quyền xóa, kể cả trên `audit_logs`. Khi khởi động, ứng dụng sẽ in một dòng CẢNH BÁO về điều này; đó là
chủ ý, không phải lỗi. Muốn nhật ký không xóa được như bản Docker thì phải tạo *Custom Role* trong Atlas theo danh sách quyền
ở `backend/src/db/quyenCSDL.js` và dùng thêm một tài khoản quản trị riêng. Hướng dẫn này chưa làm bước đó.

## 3. Tạo dịch vụ trên Render

1. Vào https://dashboard.render.com và đăng ký **bằng GitHub** (tài khoản có quyền đọc repo `nanguyen250226-art/broadways`). Không cần thẻ.
2. **New → Blueprint** → chọn repo `broadways` → Render đọc `render.yaml` và đề xuất dịch vụ `broadway-lich-day`.
3. Điền các biến được hỏi:

   | Biến | Giá trị |
   | --- | --- |
   | `MONGODB_URI` | Chuỗi ở mục 2, bước 5 |
   | `MONGODB_USER` / `MONGODB_PASSWORD` | Tài khoản và mật khẩu ở mục 2, bước 3 |
   | `CORS_ORIGIN` | `https://broadway-lich-day.onrender.com`. Nếu tên đã có người dùng, Render thêm hậu tố; khi đó sửa lại cho đúng địa chỉ hiện ở trang dịch vụ rồi *Save, rebuild and deploy* |
   | `ADMIN_EMAIL`, `ADMIN_SO_DIEN_THOAI` | Email và số điện thoại của tài khoản Quản lý `admin` |

   `JWT_SECRET` do Render tự sinh. Các biến còn lại đã có sẵn trong `render.yaml`.
4. *Apply*. Lần build đầu mất khoảng 5–10 phút.
5. **Lấy mật khẩu tạm của Admin:** trang dịch vụ → *Logs*, tìm dòng `Mật khẩu tạm`. Mở `https://<tên-dịch-vụ>.onrender.com`,
   đăng nhập `admin` bằng mật khẩu đó. Hệ thống bắt đổi mật khẩu ở lần đầu.

Mỗi lần đẩy mã lên nhánh `main`, Render tự build và triển khai lại.

## 4. Giữ dịch vụ luôn thức (bản đang chạy: UptimeRobot, mỗi 5 phút)

Render gói Free **cho dịch vụ ngủ sau 15 phút không có truy cập**. Lần truy cập sau phải chờ khoảng 1 phút để dịch vụ thức dậy.
Tác vụ định kỳ duy nhất (khóa phản hồi phân công quá hạn 24 giờ – UC_8 BR03) chạy lại ngay khi dịch vụ thức dậy. Cách giữ thức:

1. Đăng ký https://uptimerobot.com (miễn phí).
2. *Add New Monitor*: loại **HTTP(s)**, URL `https://<tên-dịch-vụ>.onrender.com/api/suc-khoe`, chu kỳ **5 phút**.
   Kèm theo đó là cảnh báo qua email khi hệ thống không truy cập được.

Một dịch vụ chạy cả tháng ≈ 744 giờ, nằm trong hạn mức 750 giờ/tháng của Render gói Free. **Chỉ chạy một dịch vụ Free** trong
tài khoản; dịch vụ thứ hai sẽ làm vượt hạn mức.

## 5. Giới hạn cần biết

- **Dung lượng Atlas Free: 512 MB** cho cả dữ liệu lẫn tệp. Mỗi tệp tối đa 5 MB, nên cỡ vài chục hồ sơ có nhiều ảnh lớn là đã
  đáng kể. Theo dõi ở *Atlas → Database → Clusters → Metrics*.
- **Render Free: 512 MB RAM, CPU yếu.** Đăng nhập có thể mất 1–3 giây vì băm mật khẩu (`BCRYPT_ROUNDS=12`).
- **Không có sao lưu tự động trên Atlas Free.** Định kỳ sao lưu về máy bằng
  [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools):

  ```bash
  mongodump --uri "mongodb+srv://<tai-khoan>:<mat-khau>@cluster0.abcde.mongodb.net/BroadwayDB" --archive=broadway.archive.gz --gzip
  ```

  Bản sao lưu gồm cả ảnh bằng cấp và tệp minh chứng (collection `tepTaiLen.*`).
- Nhật ký (*Logs*) của Render Free chỉ giữ thời gian ngắn.

## 6. Phạm vi đã kiểm thử

| Hạng mục | Đã kiểm thử | Chưa kiểm thử |
| --- | --- | --- |
| Lưu tệp GridFS | Bộ kiểm thử backend (MongoDB 7 replica set trong bộ nhớ): tải lên rồi tải về đúng nội dung, đúng loại; 304 khi đã lưu đệm; dọn tệp khi yêu cầu bị từ chối; chặn dò đường dẫn; chạy bằng tài khoản ứng dụng quyền hạn chế | – |
| Render + Atlas | – | Chưa triển khai thật lên Render và Atlas |
