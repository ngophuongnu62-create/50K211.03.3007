/** Collection `thongBao` (tài liệu MongoDB mục 3.12). */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, TUY_CHON_SCHEMA } = require('./_chung');

const thongBaoSchema = new Schema(
  {
    _id: ma({ required: true }), // maThongBao
    maNguoiNhan: thamChieu('NguoiDung'), // người nhận là Quản lý / Giáo viên / Trợ giảng
    maPHHV: thamChieu('PhuHuynhHocVien'), // người nhận là Phụ huynh / Học viên
    loaiThongBao: { type: String, enum: E.LOAI_THONG_BAO, required: true },
    tieuDe: { type: String, required: true, trim: true, maxlength: 200 },
    noiDung: { type: String, required: true, trim: true, maxlength: 500 },
    thoiDiemGui: { type: Date },
    trangThaiGui: { type: String, enum: E.TRANG_THAI_GUI, default: 'ChoGui', required: true },
  },
  { ...TUY_CHON_SCHEMA, collection: 'thongBao' },
);

// CK_ThongBao_NguoiNhan: đúng một người nhận
thongBaoSchema.pre('validate', function kiemTraNguoiNhan(next) {
  if (Boolean(this.maNguoiNhan) === Boolean(this.maPHHV)) {
    this.invalidate('maNguoiNhan', 'Thông báo phải có đúng một người nhận');
  }
  next();
});

thongBaoSchema.index({ maNguoiNhan: 1, thoiDiemGui: -1 });
thongBaoSchema.index({ maPHHV: 1, thoiDiemGui: -1 });
thongBaoSchema.index({ trangThaiGui: 1 });

module.exports = { ThongBao: model('ThongBao', thongBaoSchema) };
