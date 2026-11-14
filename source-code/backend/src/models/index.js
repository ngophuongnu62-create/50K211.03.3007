/** Nạp tất cả model – 12 collection nghiệp vụ + 3 collection kỹ thuật (boDem, audit_logs, khoaTaiNguyen). */
require('../config/mongoose');
const { NguoiDung, QuanLy, NhanSuGiangDay } = require('./NguoiDung');
const { MonHoc, KhoaHoc, PhongHoc, CaHoc } = require('./DanhMuc');
const { LopHoc } = require('./LopHoc');
const { PhuHuynhHocVien } = require('./PhuHuynhHocVien');
const { DangKyPhong } = require('./DangKyPhong');
const { LichRanh } = require('./LichRanh');
const { LichDay } = require('./LichDay');
const { PhanHoiGopY } = require('./PhanHoiGopY');
const { ThongBao } = require('./ThongBao');
const { BoDem } = require('./BoDem');
const { AuditLog } = require('./AuditLog');
const { KhoaTaiNguyen } = require('./KhoaTaiNguyen');

// Chỉ trả các model gốc (discriminator dùng chung collection nguoiDung)
module.exports = {
  NguoiDung,
  MonHoc,
  KhoaHoc,
  LopHoc,
  PhuHuynhHocVien,
  PhongHoc,
  CaHoc,
  DangKyPhong,
  LichRanh,
  LichDay,
  PhanHoiGopY,
  ThongBao,
  BoDem,
  AuditLog,
  KhoaTaiNguyen,
};

// Discriminator dùng khi tạo / truy vấn theo loại người dùng
module.exports.QuanLy = QuanLy;
module.exports.NhanSuGiangDay = NhanSuGiangDay;
Object.defineProperty(module.exports, 'QuanLy', { enumerable: false });
Object.defineProperty(module.exports, 'NhanSuGiangDay', { enumerable: false });
