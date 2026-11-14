/** Collection `dangKyPhong` (tài liệu MongoDB mục 3.8) – UC_2.2, UC_2.3. */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, TUY_CHON_SCHEMA } = require('./_chung');

const dangKyPhongSchema = new Schema(
  {
    _id: ma({ required: true }), // maDangKy
    maPhong: thamChieu('PhongHoc', { required: true }),
    maCa: thamChieu('CaHoc', { required: true }),
    maQuanLy: thamChieu('NguoiDung', { required: true }),
    ngaySuDung: { type: Date, required: true },
    trangThaiDangKy: { type: String, enum: E.TRANG_THAI_DANG_KY, default: 'DaDangKy', required: true },
    thoiDiemDangKy: { type: Date, default: Date.now, required: true },
    thoiDiemHuy: { type: Date }, // lưu lịch sử hủy (UC_2.3 BR04)
  },
  { ...TUY_CHON_SCHEMA, collection: 'dangKyPhong' },
);

// UX_DangKyPhong: một phòng chỉ có một đăng ký còn hiệu lực cho mỗi ngày, ca
dangKyPhongSchema.index(
  { maPhong: 1, ngaySuDung: 1, maCa: 1 },
  { unique: true, partialFilterExpression: { trangThaiDangKy: 'DaDangKy' }, name: 'UX_DangKyPhong' },
);
dangKyPhongSchema.index({ ngaySuDung: 1, maCa: 1 });
dangKyPhongSchema.index({ maQuanLy: 1 });

module.exports = { DangKyPhong: model('DangKyPhong', dangKyPhongSchema) };
