/** Collection `lopHoc` (tài liệu MongoDB mục 3.4). */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, soNguyen, TUY_CHON_SCHEMA } = require('./_chung');

const lopHocSchema = new Schema(
  {
    _id: ma({ required: true }), // maLop
    maMonHoc: thamChieu('MonHoc', { required: true }),
    maKhoaHoc: thamChieu('KhoaHoc', { required: true }),
    tenLop: { type: String, required: true, trim: true, maxlength: 100 },
    loaiLop: { type: String, required: true, trim: true, maxlength: 50 },
    soLuongHocVien: soNguyen({ min: 0, default: 0, required: true }),
    tongSoTiet: soNguyen({ min: 0, lonHon: true, required: true }),
    trangThaiLop: { type: String, enum: E.TRANG_THAI_LOP, default: 'ChuaMo', required: true },
  },
  { ...TUY_CHON_SCHEMA, collection: 'lopHoc' },
);

lopHocSchema.index({ maMonHoc: 1 });
lopHocSchema.index({ maKhoaHoc: 1 });

module.exports = { LopHoc: model('LopHoc', lopHocSchema) };
