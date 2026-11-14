/**
 * Collection `lichRanh` – gom theo tuần: 1 document / nhân sự / tuần, mảng `cacRanh` (tài liệu MongoDB mục 3.9).
 * UC_9: lưu đè cả tuần trong một thao tác; quy tắc ≥ 5 ca kiểm tra ở tầng nghiệp vụ.
 */
const { Schema, model } = require('mongoose');
const { ma, thamChieu, khongTrung, TUY_CHON_SCHEMA, TUY_CHON_CON } = require('./_chung');

const caRanhSchema = new Schema(
  {
    ngayRanh: { type: Date, required: true },
    maCa: thamChieu('CaHoc', { required: true }),
  },
  TUY_CHON_CON,
);

const lichRanhSchema = new Schema(
  {
    _id: ma({ required: true }), // maLichRanh
    maNhanSu: thamChieu('NguoiDung', { required: true }),
    tuanBatDau: { type: Date, required: true }, // ngày Thứ Hai của tuần đăng ký
    cacRanh: {
      type: [caRanhSchema],
      default: [],
      validate: khongTrung((c) => `${c.ngayRanh && c.ngayRanh.toISOString()}|${c.maCa}`, 'Ca rảnh bị trùng'),
    },
    thoiDiemCapNhat: { type: Date, default: Date.now, required: true },
  },
  { ...TUY_CHON_SCHEMA, collection: 'lichRanh' },
);

lichRanhSchema.pre('validate', function kiemTraTuan(next) {
  if (this.tuanBatDau) {
    if (this.tuanBatDau.getUTCDay() !== 1) this.invalidate('tuanBatDau', 'tuanBatDau phải là ngày Thứ Hai');
    const cuoiTuan = new Date(this.tuanBatDau.getTime() + 6 * 24 * 3600 * 1000);
    for (const c of this.cacRanh || []) {
      if (c.ngayRanh < this.tuanBatDau || c.ngayRanh > cuoiTuan) {
        this.invalidate('cacRanh', 'ngayRanh phải thuộc tuần đăng ký');
        break;
      }
    }
  }
  next();
});

// UQ_LichRanh (theo tuần)
lichRanhSchema.index({ maNhanSu: 1, tuanBatDau: 1 }, { unique: true });
lichRanhSchema.index({ 'cacRanh.ngayRanh': 1, 'cacRanh.maCa': 1 });

module.exports = { LichRanh: model('LichRanh', lichRanhSchema) };
