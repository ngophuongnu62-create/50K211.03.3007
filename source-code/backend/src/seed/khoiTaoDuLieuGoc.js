/**
 * Khởi tạo dữ liệu gốc – AN TOÀN để chạy lại bất kỳ lúc nào, trên mọi môi trường:
 * - Chỉ THÊM bản ghi còn thiếu ($setOnInsert): không xóa, không ghi đè dữ liệu trung tâm đã chỉnh sửa.
 * - Tài khoản Quản lý khởi tạo chỉ được tạo khi hệ thống CHƯA có Quản lý nào, luôn ở trạng thái
 *   mustChangePassword = true (bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên).
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { CA, PHONG, MON } = require('./duLieuGoc');
const { sinhMa } = require('../utils/sinhMa');
const { CaHoc, PhongHoc, MonHoc, QuanLy } = require('../models');

async function themNeuChuaCo(Model, ds) {
  if (!ds.length) return { them: 0, giuNguyen: 0 };
  const kq = await Model.bulkWrite(
    ds.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $setOnInsert: d }, upsert: true } })),
    { ordered: false },
  );
  return { them: kq.upsertedCount, giuNguyen: ds.length - kq.upsertedCount };
}

/** Mật khẩu tạm ngẫu nhiên đủ mạnh: chữ hoa, chữ thường, số, ký tự đặc biệt */
function sinhMatKhauTam() {
  const ngauNhien = crypto.randomBytes(9).toString('base64url');
  return `Bw!${ngauNhien}9a`;
}

async function khoiTaoDuLieuGoc({ log = () => {} } = {}) {
  const ketQua = {
    caHoc: await themNeuChuaCo(CaHoc, CA),
    phongHoc: await themNeuChuaCo(PhongHoc, PHONG),
    monHoc: await themNeuChuaCo(MonHoc, MON),
    quanTri: null,
  };
  log(`Ca học: thêm ${ketQua.caHoc.them}, giữ nguyên ${ketQua.caHoc.giuNguyen}`);
  log(`Phòng học: thêm ${ketQua.phongHoc.them}, giữ nguyên ${ketQua.phongHoc.giuNguyen}`);
  log(`Môn học: thêm ${ketQua.monHoc.them}, giữ nguyên ${ketQua.monHoc.giuNguyen}`);

  if (await QuanLy.exists({})) {
    log('Tài khoản Quản lý: đã có – không tạo thêm, không đổi mật khẩu.');
    return ketQua;
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_SO_DIEN_THOAI) {
    throw new Error('Chưa có Quản lý nào: cần đặt ADMIN_EMAIL và ADMIN_SO_DIEN_THOAI để tạo tài khoản Quản lý khởi tạo.');
  }
  const matKhauTam = env.ADMIN_MAT_KHAU_TAM || sinhMatKhauTam();
  await QuanLy.create({
    _id: await sinhMa('QL'),
    hoTen: env.ADMIN_HO_TEN,
    soDienThoai: env.ADMIN_SO_DIEN_THOAI,
    email: env.ADMIN_EMAIL,
    tenDangNhap: env.ADMIN_TEN_DANG_NHAP,
    matKhau: await bcrypt.hash(matKhauTam, env.BCRYPT_ROUNDS),
    mustChangePassword: true,
  });
  ketQua.quanTri = { tenDangNhap: env.ADMIN_TEN_DANG_NHAP, matKhauTam: env.ADMIN_MAT_KHAU_TAM ? '(theo ADMIN_MAT_KHAU_TAM)' : matKhauTam };
  log(`Đã tạo tài khoản Quản lý khởi tạo "${env.ADMIN_TEN_DANG_NHAP}". Mật khẩu tạm: ${ketQua.quanTri.matKhauTam}`);
  log('→ Hệ thống bắt buộc đổi mật khẩu này ở lần đăng nhập đầu tiên.');
  return ketQua;
}

module.exports = { khoiTaoDuLieuGoc, sinhMatKhauTam };
