/**
 * DỮ LIỆU GỐC (master data) của trung tâm – dùng cho init-master-data.js trên mọi môi trường.
 * Ca học, phòng học (gồm cơ sở 76 Phạm Tứ: P1, P2, P3) và môn học theo tài liệu đặc tả / bảng lịch AS-IS.
 * Trung tâm có thể sửa tệp này trước lần khởi tạo đầu tiên; các lần chạy sau KHÔNG ghi đè dữ liệu đã có.
 */
const CA = [
  { _id: 'CA1', tenCa: 'Ca 1', gioBatDau: '07:30', gioKetThuc: '11:30' },
  { _id: 'CA2', tenCa: 'Ca 2', gioBatDau: '13:30', gioKetThuc: '16:30' },
  { _id: 'CA3', tenCa: 'Ca 3', gioBatDau: '17:30', gioKetThuc: '21:00' },
];

const PHONG = [
  ['P101', 'P.101', 20, 'Tầng 1 · 20 chỗ'], ['P102', 'P.102', 16, 'Tầng 1 · 16 chỗ'],
  ['P201', 'P.201', 24, 'Tầng 2 · 24 chỗ'], ['P202', 'P.202', 24, 'Tầng 2 · 24 chỗ'],
  ['P301', 'P.301', 30, 'Lab · 30 chỗ'], ['P302', 'P.302', 20, 'Tầng 3 · 20 chỗ'],
  ['P303', 'P.303', 20, 'Tầng 3 · 20 chỗ'], ['P401', 'P.401', 25, 'Tầng 4 · 25 chỗ'],
  ['P402', 'P.402', 25, 'Tầng 4 · 25 chỗ'], ['P1', 'P1', 18, '76 Phạm Tứ · 18 chỗ'],
  ['P2', 'P2', 18, '76 Phạm Tứ · 18 chỗ'], ['P3', 'P3', 15, '76 Phạm Tứ · 15 chỗ'],
].map(([_id, tenPhong, sucChua, moTa]) => ({ _id, tenPhong, sucChua, moTa, trangThaiPhong: 'ChuaSuDung' }));

const MON = [
  { _id: 'MH-IELTS', tenMonHoc: 'IELTS', moTa: 'Luyện thi IELTS' },
  { _id: 'MH-TOEIC', tenMonHoc: 'TOEIC', moTa: 'Luyện thi TOEIC' },
  { _id: 'MH-GT', tenMonHoc: 'Tiếng Anh giao tiếp' },
  { _id: 'MH-KIDS', tenMonHoc: 'Tiếng Anh thiếu nhi' },
];

module.exports = { CA, PHONG, MON };
