# Broadway – Hệ thống quản lý lịch dạy và phân công giáo viên (nhóm 50K211.03.3007)

Tệp bàn giao cho Claude Code: đọc trước khi làm việc trong repo này.

## Quy tắc của chủ dự án (bắt buộc)

- **Tuân thủ tài liệu 100%**: nghiệp vụ theo đặc tả use case trong `tai-lieu/` (tệp `.docx`, `Thu thập yêu cầu/`); phân quyền theo
  use case; màn hình theo thiết kế Figma (đúng màu, đúng font). Không tự bịa luồng nghiệp vụ.
- **Không tự ý code** ngoài việc được yêu cầu. Điểm nào bắt buộc phải bổ sung ngoài tài liệu thì ghi rõ trong báo cáo / commit.
- Chỉ dùng repo `nanguyen250226-art/broadways`. Giao tiếp và tài liệu bằng tiếng Việt.
- Không đưa `.env`, mật khẩu, khóa bí mật lên Git.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `backend/` | Node.js 22, Express 4, Mongoose 8, MongoDB 7 replica set (cần cho giao dịch). Xem `backend/README.md` |
| `frontend/` | React 19 + Vite, 40 màn hình MH01–MH40 theo Figma |
| `e2e/` | Kiểm thử trình duyệt (Playwright) trên bản triển khai |
| `docker-compose.yml`, `docker-compose.https.yml`, `docker/` | Triển khai: MongoDB bật xác thực (keyfile, tài khoản ứng dụng chỉ đọc/thêm `audit_logs`), HTTPS bằng Caddy |
| `trien-khai/` | Cài máy chủ một lệnh, sao lưu, tự giám sát, cập nhật (vận hành 24/7) |
| `tai-lieu/golive/` | Hướng dẫn triển khai, vận hành 24/7, triển khai miễn phí, báo cáo gia cố production, kết quả kiểm thử |

## Lệnh thường dùng

```bash
cd backend && npm install && npm test          # 160 ca kiểm thử (MongoDB trong bộ nhớ, đồng hồ cố định 09:00 11/11/2026)
cd backend && npm run db:dev                   # MongoDB replica set cục bộ để lập trình
cd backend && npm run init-master-data && npm run seed:demo && npm run dev   # API http://localhost:4000/api
cd frontend && npm install && npm run dev      # giao diện http://localhost:5173
cd backend && npm run sinh-du-lieu-thu         # bộ dữ liệu thử đúng logic → tai-lieu/du-lieu-thu (tự kiểm tra 21 quy tắc + API)
cd backend && npm run nap-du-lieu-thu          # nạp bộ dữ liệu thử vào CSDL trong MONGODB_URI (thêm -- --xac-nhan nếu CSDL đã có dữ liệu)
```

Chạy toàn bộ bằng Docker trên máy cá nhân (cần Docker Desktop): tạo `.env` theo `.env.example` (bắt buộc `JWT_SECRET`, `CORS_ORIGIN=http://localhost:8080`,
`ADMIN_EMAIL`, `ADMIN_SO_DIEN_THOAI`, `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD`), rồi:

```bash
docker compose up -d --build
docker compose run --rm -e NODE_ENV=development thiet-lap-csdl node src/seed/seed-demo.js   # dữ liệu demo
```

Mở http://localhost:8080 – tài khoản demo: Quản lý `quanly` / Giáo viên `gvnguyenlan` (mật khẩu `Broadway@2026`);
Phụ huynh: Nguyễn Minh An – 0905000456.

## Trạng thái và việc tiếp theo

- Bộ dữ liệu thử đúng logic (`tai-lieu/du-lieu-thu/`, sinh bằng `backend/scripts/sinh-du-lieu-thu.js`): gắn với một thời điểm
  (Thứ Sáu–Chủ Nhật); nạp vào ngày khác thì sinh lại với `--luc`. `backend/src/seed/duLieuMau.js` (demo cũ) giữ nguyên vì test dùng.
- Đã xong: backend + CSDL, 40 màn hình, 160 ca kiểm thử backend, E2E (24 nghiệp vụ, 9 bảo mật, 5 HTTPS), gia cố production
  (xem `tai-lieu/golive/BAO_CAO_GIA_CO_PRODUCTION.md`), Docker + HTTPS + vận hành 24/7.
- **Đã triển khai thật trên Render + Atlas.** Các phương án miễn phí (`tai-lieu/golive/TRIEN_KHAI_MIEN_PHI.md`):
  - Azure for Students (không cần thẻ, cần email sinh viên) – dùng nguyên trình cài đặt `trien-khai/cai-dat-may-chu.sh`.
  - **Đã chọn: Render + MongoDB Atlas** (không cần thẻ). Đã sửa mã: ảnh bằng cấp / tệp minh chứng lưu trong MongoDB (GridFS,
    `backend/src/utils/luuTep.js`), đường dẫn `/uploads/...` trong CSDL không đổi; cấu hình `render.yaml`; hướng dẫn
    `tai-lieu/golive/TRIEN_KHAI_RENDER_ATLAS.md`. Đã triển khai 11/11/2026: https://broadway-lich-day.onrender.com (Render Free, Singapore; Atlas Free cụm `broadway`). Giữ thức bằng UptimeRobot gọi /api/suc-khoe mỗi 5 phút.
