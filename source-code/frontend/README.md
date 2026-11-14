# Frontend – Hệ thống quản lý lịch dạy Broadway

React 19 + Vite. Giao diện dựng theo Figma (font Inter, bảng màu Broadway trong `src/styles/tokens.css`).

## Chạy khi phát triển

Cần backend đang chạy ở `http://localhost:4000` (xem `../backend/README.md`).

```bash
npm install
npm run dev        # http://localhost:5173 – proxy /api và /uploads sang backend
```

Đổi địa chỉ backend cho proxy: `VITE_BACKEND=http://host:port npm run dev`.
Khi triển khai tách miền, đặt `VITE_API_URL` (xem `.env.example`) rồi `npm run build`.

## Tài khoản mẫu (sau `npm run seed` ở backend)

| Vai trò | Đăng nhập |
| --- | --- |
| Quản lý | `quanly` / `Broadway@2026` |
| Giáo viên | `gvnguyenlan` / `Broadway@2026` (các tài khoản `gv…`, `tg…` khác cùng mật khẩu) |
| Phụ huynh / Học viên | Họ tên `Nguyễn Minh An`, SĐT `0905000456` (3 lớp) · `Đỗ Thị Hằng`, `0905667889` (1 lớp) |

## Bản đồ màn hình

| Màn hình | Đường dẫn |
| --- | --- |
| MH01–MH03 Chọn đối tượng, đăng nhập | `/`, `/dang-nhap/quan-ly`, `/dang-nhap/giao-vien`, `/phu-huynh/dang-nhap` |
| MH04 Trang chủ Quản lý | `/quan-ly` |
| MH05–MH08 Phòng học | `/quan-ly/phong-hoc?tab=trong\|dang-ky\|da-dang-ky` |
| MH09–MH12 Hồ sơ giáo viên | `/quan-ly/ho-so-giao-vien`, `/them`, `/:ma`, `/:ma/sua` |
| MH13–MH16 Phản hồi & yêu cầu | `/quan-ly/phan-hoi`, `/quan-ly/phan-hoi/:ma` |
| MH17–MH18 Tra cứu lịch dạy | `/quan-ly/tra-cuu-lich-day` |
| MH19 Quản lý lịch dạy | `/quan-ly/quan-ly-lich` |
| MH20–MH21 Tạo lịch dạy | `/quan-ly/quan-ly-lich/tao` |
| MH22 Lịch tuần tới | `/quan-ly/quan-ly-lich/tuan-toi` |
| MH23 Phân công | `/quan-ly/quan-ly-lich/:maLop/phan-cong` |
| MH24 Phê duyệt và phát hành | `/quan-ly/quan-ly-lich/:maLop/phe-duyet` |
| MH25 Trang chủ Giáo viên | `/giao-vien` |
| MH26–MH27 Lịch dạy cá nhân | `/giao-vien/lich-day` |
| MH28–MH29 Phản hồi lịch dạy | `/giao-vien/phan-hoi-lich-day`, `/:maLichDay` |
| MH30 Cập nhật lịch rảnh | `/giao-vien/lich-ranh` |
| MH31 Phản hồi / yêu cầu | `/giao-vien/yeu-cau` |
| MH32–MH34, MH37 Thời khóa biểu, chi tiết ca, xin nghỉ | `/phu-huynh/lich-hoc?lop=…` |
| MH33 Chọn lớp | `/phu-huynh/chon-lop` |
| MH35–MH36 Xác nhận ca học | `/phu-huynh/xac-nhan-ca-hoc` |
| MH38 Gửi ý kiến | `/phu-huynh/gui-y-kien` |
| MH39 Tra cứu phiếu | `/phu-huynh/tra-cuu-phieu?ma=…` |
| MH40 Lịch sử phản hồi | `/phu-huynh/lich-su-phan-hoi` |
