/**
 * Các collection danh mục: `monHoc`, `khoaHoc`, `phongHoc`, `caHoc` (tài liệu MongoDB mục 3.2, 3.3, 3.6, 3.7).
 */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, soNguyen, GIO_REGEX, TUY_CHON_SCHEMA } = require('./_chung');

// monHoc
const monHocSchema = new Schema(
  {
    _id: ma({ required: true }), // maMonHoc
    tenMonHoc: { type: String, required: true, trim: true, maxlength: 100, unique: true },
    moTa: { type: String, trim: true, maxlength: 255 },
  },
  { ...TUY_CHON_SCHEMA, collection: 'monHoc' },
);

// khoaHoc
const khoaHocSchema = new Schema(
  {
    _id: ma({ required: true }), // maKhoaHoc
    tenKhoaHoc: { type: String, required: true, trim: true, maxlength: 100 },
    ngayBatDau: { type: Date, required: true },
    ngayKetThuc: { type: Date, required: true },
  },
  { ...TUY_CHON_SCHEMA, collection: 'khoaHoc' },
);
// CK_KhoaHoc_Ngay
khoaHocSchema.pre('validate', function kiemTraNgay(next) {
  if (this.ngayBatDau && this.ngayKetThuc && this.ngayBatDau > this.ngayKetThuc) {
    this.invalidate('ngayKetThuc', 'ngayBatDau phải nhỏ hơn hoặc bằng ngayKetThuc');
  }
  next();
});

// phongHoc
const phongHocSchema = new Schema(
  {
    _id: ma({ required: true }), // maPhong
    tenPhong: { type: String, required: true, trim: true, maxlength: 50, unique: true },
    sucChua: soNguyen({ min: 0, lonHon: true, required: true }),
    trangThaiPhong: { type: String, enum: E.TRANG_THAI_PHONG, default: 'ChuaSuDung', required: true },
    moTa: { type: String, trim: true, maxlength: 255 },
  },
  { ...TUY_CHON_SCHEMA, collection: 'phongHoc' },
);

// caHoc
const caHocSchema = new Schema(
  {
    _id: ma({ required: true }), // maCa
    tenCa: { type: String, required: true, trim: true, maxlength: 20, unique: true },
    gioBatDau: { type: String, required: true, match: GIO_REGEX },
    gioKetThuc: { type: String, required: true, match: GIO_REGEX },
  },
  { ...TUY_CHON_SCHEMA, collection: 'caHoc' },
);
// CK_CaHoc_Gio
caHocSchema.pre('validate', function kiemTraGio(next) {
  if (this.gioBatDau && this.gioKetThuc && this.gioBatDau >= this.gioKetThuc) {
    this.invalidate('gioKetThuc', 'gioBatDau phải nhỏ hơn gioKetThuc');
  }
  next();
});

module.exports = {
  MonHoc: model('MonHoc', monHocSchema),
  KhoaHoc: model('KhoaHoc', khoaHocSchema),
  PhongHoc: model('PhongHoc', phongHocSchema),
  CaHoc: model('CaHoc', caHocSchema),
};
