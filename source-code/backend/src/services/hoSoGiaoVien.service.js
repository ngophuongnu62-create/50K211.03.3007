/** UC_3 – Quản lý hồ sơ giáo viên: 3.1 Xem, 3.2 Thêm, 3.3 Chỉnh sửa */
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const { sinhMa } = require('../utils/sinhMa');
const { laChuoiRong, laEmail, laSoDienThoai, chuanHoaSdt, catChuoi } = require('../utils/kiemTra');
const { NguoiDung, NhanSuGiangDay, MonHoc } = require('../models');
const { thongTinTep, xoaTepDaLuu } = require('../middlewares/upload');
const { trongGiaoDich } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');

/** Ảnh hồ sơ ghi vào nhật ký (không bao giờ chứa mật khẩu) */
const anhHoSo = (ns) => (ns ? {
  hoTen: ns.hoTen, soDienThoai: ns.soDienThoai, email: ns.email, tenDangNhap: ns.tenDangNhap, diaChi: ns.diaChi,
  loaiNhanSu: ns.loaiNhanSu, hinhThucLamViec: ns.hinhThucLamViec, kinhNghiem: ns.kinhNghiem,
  chuyenMon: ns.chuyenMon, bangCap: (ns.bangCap || []).map((b) => b.maBangCap),
  trangThaiTaiKhoan: ns.trangThaiTaiKhoan,
} : null);

const docMang = (v) => {
  if (v === undefined || v === null || v === '') return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j.map(String).filter(Boolean);
  } catch { /* chuỗi phân tách bằng dấu phẩy */ }
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
};

async function tenMonHocMap() {
  return new Map((await MonHoc.find().lean()).map((m) => [m._id, m.tenMonHoc]));
}

function hienThiHoSo(ns, tenMon) {
  return {
    maNhanSu: ns._id,
    hoTen: ns.hoTen,
    soDienThoai: ns.soDienThoai,
    email: ns.email,
    diaChi: ns.diaChi,
    loaiNhanSu: ns.loaiNhanSu,
    hinhThucLamViec: ns.hinhThucLamViec,
    kinhNghiem: ns.kinhNghiem,
    chuyenMon: (ns.chuyenMon || []).map((m) => ({ maMonHoc: m, tenMonHoc: tenMon.get(m) })),
    bangCap: ns.bangCap || [],
    tenDangNhap: ns.tenDangNhap,
    trangThaiTaiKhoan: ns.trangThaiTaiKhoan,
  };
}

/** UC_3.1 bước 2: danh sách hồ sơ (họ tên, mã, loại nhân sự, chuyên môn, số điện thoại) */
async function danhSach({ q, loaiNhanSu }) {
  const loc = {};
  if (loaiNhanSu && E.LOAI_NHAN_SU.includes(loaiNhanSu)) loc.loaiNhanSu = loaiNhanSu;
  if (!laChuoiRong(q)) {
    const tu = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    loc.$or = [{ hoTen: new RegExp(tu, 'i') }, { _id: new RegExp(tu, 'i') }, { soDienThoai: new RegExp(tu.replace(/\s+/g, '')) }, { email: new RegExp(tu, 'i') }];
  }
  const [ds, tenMon] = await Promise.all([NhanSuGiangDay.find(loc).sort({ _id: 1 }).lean(), tenMonHocMap()]);
  return ds.map((ns) => ({
    maNhanSu: ns._id,
    hoTen: ns.hoTen,
    loaiNhanSu: ns.loaiNhanSu,
    chuyenMon: (ns.chuyenMon || []).map((m) => tenMon.get(m) || m),
    soDienThoai: ns.soDienThoai,
  }));
}

/** UC_3.1 bước 5–6, ngoại lệ 5a */
async function chiTiet(maNhanSu) {
  const ns = await NhanSuGiangDay.findById(maNhanSu).lean();
  if (!ns) throw new AppError(404, M.HS_KHONG_CO_THONG_TIN);
  return hienThiHoSo(ns, await tenMonHocMap());
}

/** Kiểm tra dữ liệu biểu mẫu; trả về dữ liệu đã chuẩn hóa */
async function kiemTraBieuMau(body, { soBangCapSauCung, laSua, maNhanSu }) {
  const thieu = {};
  const sai = {};
  const d = {
    hoTen: catChuoi(body.hoTen),
    soDienThoai: body.soDienThoai ? chuanHoaSdt(body.soDienThoai) : undefined,
    email: catChuoi(body.email)?.toLowerCase(),
    diaChi: catChuoi(body.diaChi),
    loaiNhanSu: catChuoi(body.loaiNhanSu),
    hinhThucLamViec: catChuoi(body.hinhThucLamViec),
    kinhNghiem: body.kinhNghiem === undefined || body.kinhNghiem === '' ? undefined : Number(body.kinhNghiem),
    chuyenMon: body.chuyenMon === undefined ? undefined : docMang(body.chuyenMon),
  };
  // BR02: các trường bắt buộc (biểu mẫu MH11/MH12: Họ và tên *, SĐT *, Email *, Địa chỉ *, Trình độ học vấn *)
  for (const k of ['hoTen', 'soDienThoai', 'email', 'diaChi', 'loaiNhanSu']) if (!d[k]) thieu[k] = M.HS_THIEU_BAT_BUOC;
  if (soBangCapSauCung < 1) thieu.bangCap = M.HS_THIEU_BAT_BUOC;
  if (Object.keys(thieu).length) {
    throw new AppError(400, laSua ? M.HS_SUA_KHONG_HOP_LE : M.HS_THIEU_BAT_BUOC, { fieldErrors: thieu });
  }
  // BR03: định dạng email và số điện thoại
  if (!laEmail(d.email)) sai.email = M.HS_EMAIL_SAI;
  if (!laSoDienThoai(d.soDienThoai)) sai.soDienThoai = M.HS_SDT_SAI;
  if (!E.LOAI_NHAN_SU.includes(d.loaiNhanSu)) sai.loaiNhanSu = M.HS_KHONG_HOP_LE;
  if (d.hinhThucLamViec && !E.HINH_THUC_LAM_VIEC.includes(d.hinhThucLamViec)) sai.hinhThucLamViec = M.HS_KHONG_HOP_LE;
  if (d.kinhNghiem !== undefined && !(Number.isInteger(d.kinhNghiem) && d.kinhNghiem >= 0)) sai.kinhNghiem = M.HS_KHONG_HOP_LE;
  if (d.hoTen.length > 100) sai.hoTen = M.HS_KHONG_HOP_LE;
  if (d.diaChi.length > 200) sai.diaChi = M.HS_KHONG_HOP_LE;
  if (d.chuyenMon && d.chuyenMon.length) {
    const coSan = await MonHoc.countDocuments({ _id: { $in: d.chuyenMon } });
    if (coSan !== new Set(d.chuyenMon).size) sai.chuyenMon = M.HS_KHONG_HOP_LE;
  }
  if (Object.keys(sai).length) {
    throw new AppError(400, laSua ? M.HS_SUA_KHONG_HOP_LE : M.HS_KHONG_HOP_LE, { fieldErrors: sai });
  }
  // Ngoại lệ 7c: SĐT hoặc email đã dùng ở hồ sơ khác
  const trung = await NguoiDung.find({
    _id: { $ne: maNhanSu || null },
    $or: [{ soDienThoai: d.soDienThoai }, { email: d.email }],
  }).lean();
  if (trung.length) {
    const fieldErrors = {};
    if (trung.some((t) => t.soDienThoai === d.soDienThoai)) fieldErrors.soDienThoai = M.HS_TRUNG_SDT_EMAIL;
    if (trung.some((t) => t.email === d.email)) fieldErrors.email = M.HS_TRUNG_SDT_EMAIL;
    throw new AppError(409, M.HS_TRUNG_SDT_EMAIL, { fieldErrors });
  }
  return d;
}

async function taoBangCap(files, tenBangCap) {
  const dsTen = docMang(tenBangCap);
  const ds = [];
  for (let i = 0; i < files.length; i += 1) {
    const tep = thongTinTep(files[i]);
    ds.push({
      maBangCap: await sinhMa('BC'),
      tenBangCap: (dsTen[i] || path.parse(files[i].originalname).name).slice(0, 150),
      hinhAnh: tep.duongDan,
    });
  }
  return ds;
}

/** Tên đăng nhập duy nhất sinh từ email (khi biểu mẫu không có trường tên đăng nhập) */
async function sinhTenDangNhap(email) {
  const goc = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 40) || 'nhansu';
  let ten = goc;
  for (let i = 1; await NguoiDung.exists({ tenDangNhap: ten }); i += 1) ten = `${goc}${i}`;
  return ten;
}

/** UC_3.2 – Thêm hồ sơ giáo viên (bước 5–10, ngoại lệ 7a, 7b, 7c) */
async function them(body, files = []) {
  try {
    const d = await kiemTraBieuMau(body, { soBangCapSauCung: files.length, laSua: false });
    const tenDangNhap = catChuoi(body.tenDangNhap) || (await sinhTenDangNhap(d.email));
    if (await NguoiDung.exists({ tenDangNhap })) {
      throw new AppError(409, M.HS_KHONG_HOP_LE, { fieldErrors: { tenDangNhap: 'Tên đăng nhập đã tồn tại' } });
    }
    const matKhauCap = catChuoi(body.matKhau);
    if (matKhauCap && matKhauCap.length < 8) {
      throw new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors: { matKhau: 'Mật khẩu phải dài ít nhất 8 ký tự' } });
    }
    const matKhauTam = matKhauCap || crypto.randomBytes(6).toString('base64url');
    const tienTo = d.loaiNhanSu === 'TroGiang' ? 'TG' : 'GV';
    const matKhauBam = await bcrypt.hash(matKhauTam, env.BCRYPT_ROUNDS);
    const bangCap = await taoBangCap(files, body.tenBangCap);
    const ns = await trongGiaoDich(async (session) => {
      const [moi] = await NhanSuGiangDay.create([{
        _id: await sinhMa(tienTo, session),
        hoTen: d.hoTen,
        soDienThoai: d.soDienThoai,
        email: d.email,
        tenDangNhap,
        matKhau: matKhauBam,
        // Mật khẩu do Quản lý cấp là mật khẩu tạm: bắt buộc đổi ở lần đăng nhập đầu tiên
        mustChangePassword: true,
        diaChi: d.diaChi,
        loaiNhanSu: d.loaiNhanSu,
        hinhThucLamViec: d.hinhThucLamViec || 'ToanThoiGian',
        kinhNghiem: d.kinhNghiem ?? 0,
        chuyenMon: d.chuyenMon || [],
        bangCap,
      }], { session });
      await ghiNhatKy({ hanhDong: 'HO_SO_NHAN_SU.TAO', doiTuong: { loai: 'NhanSuGiangDay', ma: moi._id }, truoc: null, sau: anhHoSo(moi) }, session);
      return moi;
    });
    const hoSo = hienThiHoSo(ns.toObject(), await tenMonHocMap());
    return { hoSo, taiKhoan: { tenDangNhap, matKhauTam: matKhauCap ? undefined : matKhauTam } };
  } catch (err) {
    xoaTepDaLuu(files);
    if (err && err.code === 11000) throw new AppError(409, M.HS_TRUNG_SDT_EMAIL);
    throw err;
  }
}

/** UC_3.3 – Chỉnh sửa hồ sơ giáo viên (bước 5–10, ngoại lệ 7a, 8a) */
async function sua(maNhanSu, body, files = []) {
  try {
    const ns = await NhanSuGiangDay.findById(maNhanSu);
    if (!ns) throw new AppError(404, M.HS_KHONG_CO_THONG_TIN);
    const giuLai = body.giuBangCap === undefined ? ns.bangCap.map((b) => b.maBangCap) : docMang(body.giuBangCap);
    const bangCapGiu = ns.bangCap.filter((b) => giuLai.includes(b.maBangCap));
    const d = await kiemTraBieuMau(body, { soBangCapSauCung: bangCapGiu.length + files.length, laSua: true, maNhanSu });
    const bangCapMoi = await taoBangCap(files, body.tenBangCap);
    const truoc = anhHoSo(ns.toObject());
    try {
      ns.set({
        hoTen: d.hoTen,
        soDienThoai: d.soDienThoai,
        email: d.email,
        diaChi: d.diaChi,
        loaiNhanSu: d.loaiNhanSu,
        ...(d.hinhThucLamViec ? { hinhThucLamViec: d.hinhThucLamViec } : {}),
        ...(d.kinhNghiem !== undefined ? { kinhNghiem: d.kinhNghiem } : {}),
        ...(d.chuyenMon !== undefined ? { chuyenMon: d.chuyenMon } : {}),
        bangCap: [...bangCapGiu.map((b) => b.toObject()), ...bangCapMoi],
      });
      await trongGiaoDich(async (session) => {
        await ns.save({ session });
        await ghiNhatKy({ hanhDong: 'HO_SO_NHAN_SU.CAP_NHAT', doiTuong: { loai: 'NhanSuGiangDay', ma: ns._id }, truoc, sau: anhHoSo(ns.toObject()) }, session);
      });
    } catch (err) {
      if (err && err.code === 11000) throw new AppError(409, M.HS_TRUNG_SDT_EMAIL);
      throw new AppError(500, M.HS_SUA_THAT_BAI); // BR05: không ghi nhận thay đổi khi lưu lỗi
    }
    return hienThiHoSo(ns.toObject(), await tenMonHocMap());
  } catch (err) {
    xoaTepDaLuu(files);
    throw err;
  }
}

module.exports = { danhSach, chiTiet, them, sua, UPLOAD_DIR: env.UPLOAD_DIR };
