/**
 * Collection `phuHuynhHocVien` – nhúng TheoHoc thành mảng tham chiếu `lopTheoHoc` (tài liệu MongoDB mục 3.5).
 * Không kế thừa NguoiDung: đăng nhập bằng Họ tên học viên + Số điện thoại (UC_1 BR04).
 */
const { Schema, model } = require('mongoose');
const { ma, thamChieu, khongTrung, TUY_CHON_SCHEMA } = require('./_chung');

const phuHuynhHocVienSchema = new Schema(
  {
    _id: ma({ required: true }), // maPHHV
    tenHocVien: { type: String, required: true, trim: true, maxlength: 100 },
    soDienThoai: { type: String, required: true, trim: true, maxlength: 15 },
    tokenThuHoi: { type: [String], default: undefined }, // mã (jti) các token đã đăng xuất
    lopTheoHoc: {
      type: [thamChieu('LopHoc')],
      default: [],
      validate: khongTrung((m) => m, 'Lớp theo học bị trùng'),
    },
  },
  { ...TUY_CHON_SCHEMA, collection: 'phuHuynhHocVien' },
);

// UQ_PHHV_DangNhap
phuHuynhHocVienSchema.index({ tenHocVien: 1, soDienThoai: 1 }, { unique: true });
// Chỉ mục đa khóa: học viên của một lớp
phuHuynhHocVienSchema.index({ lopTheoHoc: 1 });
phuHuynhHocVienSchema.index({ soDienThoai: 1 });

module.exports = { PhuHuynhHocVien: model('PhuHuynhHocVien', phuHuynhHocVienSchema) };
