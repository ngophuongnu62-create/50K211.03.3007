/**
 * Collection `phanHoiGopY` – phiếu phản hồi / yêu cầu (UC_10) và ý kiến (UC_14); _id = Mã phiếu (Ticket ID).
 * Nhúng TepDinhKem và LichSuXuLy (tài liệu MongoDB mục 3.11).
 */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, TUY_CHON_SCHEMA, TUY_CHON_CON } = require('./_chung');

const tepDinhKemSchema = new Schema(
  {
    maTep: ma({ required: true }),
    tenTep: { type: String, required: true, trim: true, maxlength: 150 },
    loaiTep: { type: String, enum: E.LOAI_TEP, required: true },
    duongDan: { type: String, required: true, maxlength: 255 },
  },
  TUY_CHON_CON,
);

const lichSuXuLySchema = new Schema(
  {
    maLichSu: ma({ required: true }),
    maQuanLy: thamChieu('NguoiDung', { required: true }),
    loaiThaoTac: { type: String, enum: E.LOAI_THAO_TAC, required: true },
    trangThaiTruoc: { type: String, enum: E.TRANG_THAI_XU_LY },
    trangThaiSau: { type: String, enum: E.TRANG_THAI_XU_LY },
    ghiChuXuLy: { type: String, trim: true, maxlength: 500 },
    noiDungPhanHoi: { type: String, trim: true, maxlength: 500 }, // câu trả lời chính thức
    thoiGianXuLy: { type: Date, default: Date.now, required: true },
  },
  TUY_CHON_CON,
);
// CK_LichSuXuLy_TuChoi: từ chối thì phải có ghi chú (UC_4.2 BR03)
lichSuXuLySchema.pre('validate', function kiemTraTuChoi(next) {
  if (this.trangThaiSau === 'TuChoi' && !this.ghiChuXuLy) this.invalidate('ghiChuXuLy', 'Từ chối thì phải có ghi chú');
  next();
});

const phanHoiGopYSchema = new Schema(
  {
    _id: ma({ required: true }), // maPhanHoi = Mã phiếu (Ticket ID)
    maNhanSu: thamChieu('NguoiDung'), // người gửi là Giáo viên / Trợ giảng
    maPHHV: thamChieu('PhuHuynhHocVien'), // người gửi là Phụ huynh / Học viên
    maQuanLy: thamChieu('NguoiDung'), // Quản lý phụ trách; trống khi chưa tiếp nhận
    loaiPhanHoi: { type: String, enum: E.LOAI_PHAN_HOI, required: true },
    tieuDe: { type: String, required: true, trim: true, maxlength: 200 },
    noiDung: { type: String, required: true, trim: true, maxlength: 500 },
    thoiGianGui: { type: Date, default: Date.now, required: true },
    trangThaiXuLy: { type: String, enum: E.TRANG_THAI_XU_LY, default: 'ChoXuLy', required: true },
    tepDinhKem: { type: [tepDinhKemSchema], default: [] },
    lichSuXuLy: { type: [lichSuXuLySchema], default: [] },
  },
  { ...TUY_CHON_SCHEMA, collection: 'phanHoiGopY' },
);

// CK_PhanHoiGopY_NguoiGui: đúng một người gửi
phanHoiGopYSchema.pre('validate', function kiemTraNguoiGui(next) {
  if (Boolean(this.maNhanSu) === Boolean(this.maPHHV)) {
    this.invalidate('maNhanSu', 'Phiếu phải có đúng một người gửi: nhân sự hoặc phụ huynh / học viên');
  }
  next();
});

phanHoiGopYSchema.index({ trangThaiXuLy: 1, thoiGianGui: -1 });
phanHoiGopYSchema.index({ maNhanSu: 1, thoiGianGui: -1 });
phanHoiGopYSchema.index({ maPHHV: 1, thoiGianGui: -1 });

module.exports = { PhanHoiGopY: model('PhanHoiGopY', phanHoiGopYSchema) };
