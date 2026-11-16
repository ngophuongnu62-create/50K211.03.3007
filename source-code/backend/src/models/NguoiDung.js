/**
 * Collection `nguoiDung` – gộp NguoiDung, QuanLy, NhanSuGiangDay (kế thừa, discriminator `loaiNguoiDung`)
 * và nhúng BangCap, ChuyenMon (tài liệu MongoDB mục 3.1).
 */
const { Schema, model } = require('mongoose');
const E = require('../constants/enums');
const { ma, thamChieu, soNguyen, khongTrung, TUY_CHON_SCHEMA, TUY_CHON_CON } = require('./_chung');

// BangCap – nhúng (hợp thành, ON DELETE CASCADE)
const bangCapSchema = new Schema(
  {
    maBangCap: ma({ required: true }),
    tenBangCap: { type: String, required: true, trim: true, maxlength: 150 },
    hinhAnh: { type: String, required: true, maxlength: 255 }, // đường dẫn ảnh
  },
  TUY_CHON_CON,
);

// NguoiDung – lớp cha
const nguoiDungSchema = new Schema(
  {
    _id: ma({ required: true }), // maNguoiDung
    hoTen: { type: String, required: true, trim: true, maxlength: 100 },
    soDienThoai: { type: String, required: true, trim: true, maxlength: 15, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 100, unique: true },
    tenDangNhap: { type: String, required: true, trim: true, maxlength: 50, unique: true }, // UC_1 BR01
    matKhau: { type: String, required: true, maxlength: 255, select: false }, // chỉ lưu giá trị băm
    trangThaiTaiKhoan: { type: String, enum: E.TRANG_THAI_TAI_KHOAN, default: 'HoatDong', required: true },
    // Bảo mật production: bắt buộc đổi mật khẩu mặc định / mật khẩu tạm ở lần đăng nhập đầu tiên
    mustChangePassword: { type: Boolean, default: false },
    // Tăng mỗi lần đổi mật khẩu → mọi phiên đăng nhập (token) cũ mất hiệu lực
    phienBanToken: { type: Number, default: 0, min: 0 },
    tokenThuHoi: { type: [String], default: undefined }, // mã (jti) các token đã đăng xuất – chỉ phiên đó hết hiệu lực
    matKhauDoiLuc: { type: Date },
  },
  { ...TUY_CHON_SCHEMA, collection: 'nguoiDung', discriminatorKey: 'loaiNguoiDung' },
);

nguoiDungSchema.index({ loaiNguoiDung: 1, loaiNhanSu: 1 });

const NguoiDung = model('NguoiDung', nguoiDungSchema);

// QuanLy – bảng con 1–1, không có cột riêng
const QuanLy = NguoiDung.discriminator('QuanLy', new Schema({}, TUY_CHON_SCHEMA));

// NhanSuGiangDay – bảng con 1–1, các cột riêng ở cấp gốc của document
const nhanSuSchema = new Schema(
  {
    diaChi: { type: String, trim: true, maxlength: 200 },
    loaiNhanSu: { type: String, enum: E.LOAI_NHAN_SU, required: true },
    hinhThucLamViec: { type: String, enum: E.HINH_THUC_LAM_VIEC, required: true },
    kinhNghiem: soNguyen({ min: 0, default: 0, required: true }), // số năm kinh nghiệm (UC_6.3 BR02)
    bangCap: {
      type: [bangCapSchema],
      default: [],
      validate: khongTrung((b) => b.maBangCap, 'Mã bằng cấp bị trùng'),
    },
    // ChuyenMon – quan hệ n–n với MonHoc, nhúng mảng tham chiếu
    chuyenMon: {
      type: [thamChieu('MonHoc')],
      default: [],
      validate: khongTrung((m) => m, 'Chuyên môn bị trùng'),
    },
  },
  TUY_CHON_SCHEMA,
);
nhanSuSchema.index({ chuyenMon: 1 });

const NhanSuGiangDay = NguoiDung.discriminator('NhanSuGiangDay', nhanSuSchema);

module.exports = { NguoiDung, QuanLy, NhanSuGiangDay };
