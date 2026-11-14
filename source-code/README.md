# Hệ thống quản lý lịch dạy và phân công giáo viên – Trung tâm Ngoại ngữ Broadway

Nhóm 50K211.03.3007 · Lớp 50K21.1 · Trường Đại học Kinh tế – Đại học Đà Nẵng

| Thư mục | Nội dung |
| --- | --- |
| `backend/` | API Node.js/Express + MongoDB (Ưu tiên 1) – xem `backend/README.md` |
| `frontend/` | Giao diện React theo Figma, 40 màn hình MH01–MH40 (Ưu tiên 2) – xem `frontend/README.md` |
| `e2e/` | Kiểm thử đầu–cuối trên trình duyệt cho bản triển khai (Ưu tiên 4) |
| `Dockerfile`, `docker-compose.yml`, `docker-compose.https.yml`, `docker/` | Đóng gói và triển khai (MongoDB bật xác thực; HTTPS bằng Caddy) |
| `trien-khai/` | Cài đặt máy chủ một lệnh, sao lưu, tự giám sát, cập nhật – vận hành 24/7 |
| `tai-lieu/` | Tài liệu đặc tả; `kiem-thu/` báo cáo kiểm thử nghiệp vụ; `golive/` hướng dẫn triển khai, tài khoản, báo cáo golive, **báo cáo gia cố production** (`BAO_CAO_GIA_CO_PRODUCTION.md`) |

- Thiết kế giao diện (Figma): https://www.figma.com/design/4kKR2Ge38eCIiIhiSUxqqZ/50K211.03.3007
- Video và ghi âm phỏng vấn lần 1: https://drive.google.com/drive/folders/13VgoKit0KocQUGtXLrcOW5SBqMOBXVni

## Triển khai nhanh (Docker)

```bash
cp .env.example .env      # đặt JWT_SECRET, CORS_ORIGIN, ADMIN_EMAIL, ADMIN_SO_DIEN_THOAI, MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD
docker compose up -d --build
docker compose logs app | grep "Mật khẩu tạm"
```

Mở địa chỉ đã khai báo ở `CORS_ORIGIN`, đăng nhập Quản lý `admin` bằng mật khẩu tạm vừa in ra – hệ thống bắt buộc đổi mật khẩu
ở lần đầu. MongoDB bật xác thực: ứng dụng dùng tài khoản riêng không xóa được dữ liệu và chỉ đọc / thêm được nhật ký hệ thống.
Bản production chỉ chứa danh mục gốc (ca học, phòng học, môn học) và tài khoản Admin, **không** có dữ liệu demo.
**Chạy 24/7 trên máy chủ (VPS)** – máy tính cá nhân tắt vẫn hoạt động: `sudo bash trien-khai/cai-dat-may-chu.sh` trên máy chủ Ubuntu,
xem `tai-lieu/golive/VAN_HANH_24_7.md` (thuê máy chủ, cài một lệnh, tự sao lưu, tự giám sát, tự chạy lại sau khởi động lại).
Phương án **miễn phí** (Oracle Cloud Always Free + tên miền DuckDNS): `tai-lieu/golive/TRIEN_KHAI_MIEN_PHI.md`.

HTTPS cho tên miền thật (Caddy tự xin và gia hạn chứng chỉ): đặt `COMPOSE_FILE`, `TEN_MIEN`, `EMAIL_ACME` trong `.env` –
xem mục 4 của hướng dẫn triển khai. Tài khoản: `tai-lieu/golive/TAI_KHOAN_MAU.md`. Hướng dẫn đầy đủ (HTTPS, sao lưu, cập nhật, UAT): `tai-lieu/golive/HUONG_DAN_TRIEN_KHAI.md`.

## Chạy backend khi lập trình

```bash
cd backend
npm install
npm run db:dev            # MongoDB cục bộ (replica set)
npm run init-master-data  # danh mục gốc + Admin (chỉ thêm, không xóa)
npm run seed:demo         # dữ liệu demo – chỉ development, chỉ khi CSDL chưa có dữ liệu nghiệp vụ
npm run nap-du-lieu-thu   # hoặc: bộ dữ liệu thử đầy đủ, đúng logic – xem tai-lieu/du-lieu-thu/README.md
npm run dev               # http://localhost:4000/api (NODE_ENV=development, cấu hình .env.development)
```

## Chạy frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173
```
