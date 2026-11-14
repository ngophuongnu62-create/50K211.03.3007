/**
 * Collection `lichDay` – một buổi dạy của lớp tại một phòng, một ca, một ngày (tài liệu MongoDB mục 3.10).
 * Nhúng: PhanCong (→ PhanHoiLichDay), LichSuLichDay, XacNhanCaHoc, YeuCauNghiHoc
 * (đều là quan hệ hợp thành / ON DELETE CASCADE trong bản SQL).
 */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, soNguyen, khongTrung, TUY_CHON_SCHEMA, TUY_CHON_CON } = require('./_chung');

// PhanHoiLichDay – đề xuất thay đổi của giáo viên (UC_8), nhúng trong PhanCong
const phanHoiLichDaySchema = new Schema(
  {
    maPhanHoiLichDay: ma({ required: true }),
    maCaDeXuat: thamChieu('CaHoc'), // không bắt buộc
    ngayDeXuat: { type: Date },
    lyDoThayDoi: { type: String, required: true, trim: true, maxlength: 500 },
    thoiGianPhanHoi: { type: Date, default: Date.now, required: true },
    trangThaiXuLy: { type: String, enum: E.TRANG_THAI_XU_LY_PHAN_HOI_LICH, default: 'ChoXuLy', required: true },
  },
  TUY_CHON_CON,
);

// PhanCong – phân công giáo viên / trợ giảng cho buổi dạy (UC_6.3, UC_8)
const phanCongSchema = new Schema(
  {
    maPhanCong: ma({ required: true }),
    maNhanSu: thamChieu('NguoiDung', { required: true }),
    vaiTro: { type: String, enum: E.VAI_TRO_PHAN_CONG, required: true },
    trangThaiPhanCong: { type: String, enum: E.TRANG_THAI_PHAN_CONG, default: 'ChoXacNhan', required: true },
    thoiDiemGuiThongBao: { type: Date }, // thời điểm bấm "Gửi thông báo cho giáo viên"
    thoiDiemPhanHoi: { type: Date },
    phanHoiLichDay: { type: [phanHoiLichDaySchema], default: [] },
  },
  TUY_CHON_CON,
);

// LichSuLichDay
const lichSuSchema = new Schema(
  {
    maLichSuLich: ma({ required: true }),
    maQuanLy: thamChieu('NguoiDung', { required: true }),
    hanhDong: { type: String, enum: E.HANH_DONG_LICH, required: true },
    thoiDiem: { type: Date, default: Date.now, required: true },
    ghiChu: { type: String, trim: true, maxlength: 255 },
  },
  TUY_CHON_CON,
);

// XacNhanCaHoc – phụ huynh / học viên xác nhận hoặc từ chối ca học dự kiến (UC_11)
const xacNhanCaHocSchema = new Schema(
  {
    maXacNhan: ma({ required: true }),
    maPHHV: thamChieu('PhuHuynhHocVien', { required: true }),
    ketQua: { type: String, enum: E.KET_QUA_XAC_NHAN, required: true },
    lyDoTuChoi: { type: String, trim: true, maxlength: 500 },
    thoiGianXacNhan: { type: Date, default: Date.now, required: true },
  },
  TUY_CHON_CON,
);
// CK_XacNhan_LyDo: từ chối thì phải có lý do
xacNhanCaHocSchema.pre('validate', function kiemTraLyDo(next) {
  if (this.ketQua === 'TuChoi' && !this.lyDoTuChoi) this.invalidate('lyDoTuChoi', 'Từ chối thì phải có lý do');
  next();
});

// YeuCauNghiHoc – đơn xin nghỉ / báo vắng (UC_13)
const yeuCauNghiHocSchema = new Schema(
  {
    maYeuCauNghi: ma({ required: true }),
    maPHHV: thamChieu('PhuHuynhHocVien', { required: true }),
    lyDoXinNghi: { type: String, enum: E.LY_DO_XIN_NGHI, required: true },
    ghiChu: { type: String, trim: true, maxlength: 500 },
    thoiGianGui: { type: Date, default: Date.now, required: true },
    trangThaiNghi: { type: String, enum: E.TRANG_THAI_NGHI, default: 'BaoVang', required: true },
  },
  TUY_CHON_CON,
);

// LichDay
const lichDaySchema = new Schema(
  {
    _id: ma({ required: true }), // maLichDay
    maLop: thamChieu('LopHoc', { required: true }),
    maPhong: thamChieu('PhongHoc', { required: true }),
    maCa: thamChieu('CaHoc', { required: true }),
    maQuanLy: thamChieu('NguoiDung', { required: true }),
    ngayDay: { type: Date, required: true }, // tuần dạy suy ra từ ngày
    soTiet: soNguyen({ min: 0, lonHon: true, required: true }),
    trangThaiLich: { type: String, enum: E.TRANG_THAI_LICH, default: 'Nhap', required: true },
    thoiDiemTao: { type: Date, default: Date.now, required: true },
    thoiDiemCapNhat: { type: Date },
    thoiDiemGuiDuKien: { type: Date }, // mốc tính hạn 24 giờ (UC_8 BR03, UC_11 BR03)
    phanCong: {
      type: [phanCongSchema],
      default: [],
      validate: khongTrung((p) => p.maNhanSu, 'Một nhân sự chỉ được phân công một lần cho một buổi'), // UQ_PhanCong
    },
    lichSu: { type: [lichSuSchema], default: [] },
    xacNhanCaHoc: {
      type: [xacNhanCaHocSchema],
      default: [],
      validate: khongTrung((x) => x.maPHHV, 'Mỗi ca chỉ được xác nhận một lần'), // UQ_XacNhanCaHoc
    },
    yeuCauNghiHoc: {
      type: [yeuCauNghiHocSchema],
      default: [],
      validate: khongTrung((y) => y.maPHHV, 'Mỗi học viên chỉ báo vắng một ca một lần'), // UQ_YeuCauNghiHoc
    },
  },
  { ...TUY_CHON_SCHEMA, collection: 'lichDay' },
);

const LOC_CON_HIEU_LUC = { trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } };
// UX_LichDay_Phong: một phòng không có hai buổi (chưa hủy) cùng ngày, cùng ca
lichDaySchema.index(
  { maPhong: 1, ngayDay: 1, maCa: 1 },
  { unique: true, partialFilterExpression: LOC_CON_HIEU_LUC, name: 'UX_LichDay_Phong' },
);
// UX_LichDay_Lop: một lớp không có hai buổi (chưa hủy) cùng ngày, cùng ca
lichDaySchema.index(
  { maLop: 1, ngayDay: 1, maCa: 1 },
  { unique: true, partialFilterExpression: LOC_CON_HIEU_LUC, name: 'UX_LichDay_Lop' },
);
// Chỉ mục tra cứu (tài liệu MongoDB mục 4.3)
// UX_LichDay_NhanSu: một giáo viên / trợ giảng không có hai buổi (chưa hủy) cùng ngày, cùng ca.
// Chỉ mục đa khóa trên mảng phanCong; bỏ qua buổi chưa phân công (mảng rỗng).
lichDaySchema.index(
  { 'phanCong.maNhanSu': 1, ngayDay: 1, maCa: 1 },
  { unique: true, partialFilterExpression: { ...LOC_CON_HIEU_LUC, 'phanCong.maNhanSu': { $exists: true } }, name: 'UX_LichDay_NhanSu' },
);
// Mỗi buổi tối đa một Giáo viên và một Trợ giảng, không lặp nhân sự (áp dụng cho mọi thao tác lưu document)
lichDaySchema.pre('validate', function motNguoiMotVaiTro(next) {
  const ds = this.phanCong || [];
  for (const vt of ['GiaoVien', 'TroGiang']) {
    if (ds.filter((p) => p.vaiTro === vt).length > 1) this.invalidate('phanCong', `Mỗi buổi chỉ có một ${vt === 'GiaoVien' ? 'giáo viên' : 'trợ giảng'}`);
  }
  if (new Set(ds.map((p) => p.maNhanSu)).size !== ds.length) this.invalidate('phanCong', 'Một nhân sự không được phân công hai lần trong cùng buổi');
  next();
});
lichDaySchema.index({ maLop: 1, ngayDay: 1 });
lichDaySchema.index({ ngayDay: 1, maCa: 1 });
lichDaySchema.index({ 'phanCong.maNhanSu': 1, ngayDay: 1 });
lichDaySchema.index({ trangThaiLich: 1, ngayDay: 1 });

module.exports = { LichDay: model('LichDay', lichDaySchema) };
