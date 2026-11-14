# Báo cáo kiểm thử nghiệp vụ – Ưu tiên 3

Hệ thống quản lý lịch dạy và phân công giáo viên – Trung tâm Ngoại ngữ Broadway (nhóm 50K211.03.3007)

## 1. Phạm vi

Kiểm thử tự động các quy tắc nghiệp vụ trong đặc tả use case (UC_1 – UC_14), theo 4 nhóm do nhóm yêu cầu:

| Nhóm | Nội dung | Số ca |
| --- | --- | --- |
| Sai quyền | Token thiếu / giả mạo / hết hạn, tài khoản bị khóa, ma trận vai trò × chức năng, cách ly dữ liệu giữa giáo viên, giữa phụ huynh | 26 |
| Nhập sai dữ liệu | Trường bắt buộc, định dạng email / SĐT / ngày, giới hạn 500 ký tự, trùng SĐT / email, tệp sai loại / giả mạo / quá lớn, JSON hỏng, chèn toán tử NoSQL | 41 |
| Trùng lịch | Trùng phòng, trùng giáo viên, sai lịch rảnh, sai chuyên môn, thiếu sức chứa, lịch tuần bị xung đột (10a), gửi đồng thời, chỉ mục duy nhất ở tầng CSDL | 30 |
| Thời hạn và xin nghỉ trễ | Xin nghỉ trước giờ học tối thiểu 02 tiếng (đúng ranh giới từng phút), ca đã / đang diễn ra, hạn 24 giờ của giáo viên và phụ huynh, cổng lịch rảnh 08:00 Thứ Hai – 23:59 Thứ Năm, hủy đăng ký phòng | 27 |
| **Tổng** | | **124** |

Chi tiết từng ca (mã, kịch bản, kết quả mong đợi, kết quả thực tế): [`KET_QUA_KIEM_THU.md`](KET_QUA_KIEM_THU.md) – tệp này được sinh tự động mỗi lần chạy.

## 2. Môi trường và cách chạy

- Node.js 22, bộ kiểm thử có sẵn `node:test` (không thêm thư viện)
- MongoDB 7.0.14 dạng replica set chạy trong bộ nhớ (`mongodb-memory-server`) – giống môi trường thật: có giao dịch và chỉ mục duy nhất
- Đồng hồ hệ thống cố định ở **09:00 Thứ Tư 11/11/2026 (giờ Việt Nam)**; từng ca kiểm thử dời đồng hồ đến đúng thời điểm cần thử (VD: 11:30 và 11:31 cho ranh giới 2 tiếng) nên kết quả lặp lại được bất kể chạy ngày nào
- Dữ liệu mẫu (`backend/src/seed/duLieuMau.js`) nạp lại trước mỗi nhóm kịch bản

```bash
cd backend
npm install
npm test               # chạy 124 ca
npm run test:bao-cao   # chạy và ghi lại tai-lieu/kiem-thu/KET_QUA_KIEM_THU.md
```

## 3. Kết quả

**124 / 124 ca đạt** sau khi sửa 5 lỗi phát hiện trong quá trình kiểm thử. Bộ kiểm tra khói toàn luồng trước đó (123 bước) vẫn đạt 100% sau khi sửa.

## 4. Lỗi phát hiện và đã sửa

| # | Ca phát hiện | Mô tả lỗi | Mức độ | Cách sửa |
| --- | --- | --- | --- | --- |
| 1 | TC-DL-06 | Tham số truy vấn dạng `?maLop[$ne]=…` được chuyển thẳng thành điều kiện truy vấn MongoDB (chèn toán tử NoSQL) | Cao | Thêm middleware `chanToanTu` từ chối mọi khóa bắt đầu bằng `$` trong query, body, params → 400 |
| 2 | TC-DL-07 | Thân yêu cầu `{"maNhanSu": {"$ne": null}}` lọt xuống truy vấn CSDL | Cao | Cùng middleware trên |
| 3 | TC-DL-18 | Tệp văn bản đổi đuôi `.png` (khai báo `image/png`) vẫn được nhận và lưu làm ảnh bằng cấp | Trung bình | Kiểm tra chữ ký đầu tệp (PNG / JPG / PDF) sau khi nhận; sai thì xóa tệp và trả 400 |
| 4 | TC-DL-29 | Gửi ý kiến thiếu nội dung kèm tệp minh chứng: yêu cầu bị từ chối nhưng tệp vẫn nằm lại trên máy chủ | Thấp | Bộ xử lý lỗi chung xóa các tệp vừa tải lên của mọi yêu cầu bị từ chối |
| 5 | TC-TH-14 | Sau khi hệ thống tự đánh dấu phân công quá 24 giờ là "Hết hạn", màn hình MH29 không còn báo "Đã quá thời hạn gửi phản hồi" (giao diện hiểu nhầm thành "Bạn đã phản hồi ca dạy này") | Trung bình | Backend trả thêm `quaHan` và thông báo quá hạn cho cả trạng thái "Hết hạn"; MH29 dùng cờ này để khóa phản hồi đúng như khung GV-8-g |

## 5. Ghi chú

- Kiểm thử ở tầng API là nơi các quy tắc nghiệp vụ được thực thi; giao diện chỉ hiển thị kết quả. Các màn hình lỗi / thành công tương ứng đã được kiểm tra trực quan với Figma ở Ưu tiên 2. Kiểm thử đầu – cuối trên trình duyệt thuộc Ưu tiên 4.
- Một số quy tắc được kiểm thử theo cách hiểu đã báo cáo trước đó, chờ nhóm duyệt: thông báo `[BO SUNG]`, phòng bận gồm cả buổi học của lịch Nháp, câu "chọn ít nhất 1 ca rảnh" theo Figma (tài liệu ghi 5 ca).
