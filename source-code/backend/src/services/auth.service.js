/** UC_1 – Đăng nhập */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const { VAI_TRO } = require('../constants/enums');
const { NguoiDung, PhuHuynhHocVien, LopHoc } = require('../models');
const { kyToken } = require('../middlewares/auth');
const { laChuoiRong, chuanHoaSdt, chuanHoaTen } = require('../utils/kiemTra');
const { trongGiaoDich } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');
const clock = require('../utils/clock');

/** Băm giả: so khớp cả khi tài khoản không tồn tại để thời gian phản hồi như nhau (chống dò tên đăng nhập) */
let bamGia;
const layBamGia = async () => {
  bamGia = bamGia || (await bcrypt.hash('tai-khoan-khong-ton-tai', env.BCRYPT_ROUNDS));
  return bamGia;
};

const trangChuTheoVaiTro = (vaiTro) => (vaiTro === VAI_TRO.QUAN_LY ? 'QL-00' : 'GV-00');
const thongTinNhanSu = (nd, vaiTro) => ({
  ma: nd._id,
  hoTen: nd.hoTen,
  vaiTro,
  hinhThucLamViec: nd.hinhThucLamViec,
  email: nd.email,
  mustChangePassword: !!nd.mustChangePassword,
});

/** Đăng nhập nhân sự (Quản lý / Giáo viên / Trợ giảng) – bước 2–8, ngoại lệ 3.a, 5.a */
async function dangNhapNhanSu({ tenDangNhap, matKhau } = {}) {
  if (laChuoiRong(tenDangNhap) || laChuoiRong(matKhau)) throw new AppError(400, M.DN_THIEU_THONG_TIN);
  const nd = await NguoiDung.findOne({ tenDangNhap: String(tenDangNhap).trim() }).select('+matKhau').lean();
  const dung = await bcrypt.compare(String(matKhau), nd ? nd.matKhau : await layBamGia());
  if (!nd || !dung) throw new AppError(401, M.DN_SAI_THONG_TIN);
  if (nd.trangThaiTaiKhoan !== 'HoatDong') throw new AppError(403, M.DN_TAI_KHOAN_KHOA);
  // Bước 7: xác định vai trò
  const vaiTro = nd.loaiNguoiDung === 'QuanLy' ? VAI_TRO.QUAN_LY : nd.loaiNhanSu;
  const token = kyToken({ sub: nd._id, vaiTro, pv: nd.phienBanToken || 0 }, env.JWT_EXPIRES_NHAN_SU);
  await ghiNhatKy({
    hanhDong: 'TAI_KHOAN.DANG_NHAP',
    doiTuong: { loai: 'NguoiDung', ma: nd._id },
    nguoiThucHien: { ma: nd._id, vaiTro, hoTen: nd.hoTen },
  });
  return {
    token,
    nguoiDung: thongTinNhanSu(nd, vaiTro),
    // Bước 8: giao diện theo vai trò (mật khẩu tạm → giao diện chuyển sang màn hình đổi mật khẩu trước)
    trangChu: trangChuTheoVaiTro(vaiTro),
  };
}

const MAT_KHAU_DU_MANH = (mk, tenDangNhap) => mk.length >= 8 && mk.length <= 64
  && /\p{L}/u.test(mk) && /\d/.test(mk) && mk.toLowerCase() !== String(tenDangNhap || '').toLowerCase();

/** Đổi mật khẩu (bắt buộc ở lần đăng nhập đầu với mật khẩu tạm; dùng được bất cứ lúc nào) */
async function doiMatKhau(user, { matKhauHienTai, matKhauMoi, xacNhanMatKhau } = {}) {
  if (user.vaiTro === VAI_TRO.PHU_HUYNH) throw new AppError(403, M.KHONG_CO_QUYEN);
  if ([matKhauHienTai, matKhauMoi, xacNhanMatKhau].some((x) => laChuoiRong(x) || typeof x !== 'string')) {
    throw new AppError(400, M.DMK_THIEU_THONG_TIN);
  }
  if (matKhauMoi !== xacNhanMatKhau) {
    throw new AppError(400, M.DMK_XAC_NHAN_KHONG_KHOP, { fieldErrors: { xacNhanMatKhau: M.DMK_XAC_NHAN_KHONG_KHOP } });
  }
  const nd = await NguoiDung.findById(user.ma).select('+matKhau').lean();
  if (!nd) throw new AppError(401, M.CHUA_DANG_NHAP);
  if (!(await bcrypt.compare(matKhauHienTai, nd.matKhau))) {
    throw new AppError(400, M.DMK_SAI_MAT_KHAU_HIEN_TAI, { fieldErrors: { matKhauHienTai: M.DMK_SAI_MAT_KHAU_HIEN_TAI } });
  }
  if (!MAT_KHAU_DU_MANH(matKhauMoi, nd.tenDangNhap)) {
    throw new AppError(400, M.DMK_KHONG_DU_MANH, { fieldErrors: { matKhauMoi: M.DMK_KHONG_DU_MANH } });
  }
  if (await bcrypt.compare(matKhauMoi, nd.matKhau)) {
    throw new AppError(400, M.DMK_TRUNG_MAT_KHAU_CU, { fieldErrors: { matKhauMoi: M.DMK_TRUNG_MAT_KHAU_CU } });
  }
  const matKhauBam = await bcrypt.hash(matKhauMoi, env.BCRYPT_ROUNDS);
  const pvMoi = (nd.phienBanToken || 0) + 1;
  await trongGiaoDich(async (session) => {
    // Điều kiện nguyên tử: mật khẩu chưa bị đổi bởi một yêu cầu khác trong lúc xử lý
    const kq = await NguoiDung.updateOne(
      { _id: nd._id, matKhau: nd.matKhau },
      { $set: { matKhau: matKhauBam, mustChangePassword: false, matKhauDoiLuc: clock.now(), phienBanToken: pvMoi } },
      { session },
    );
    if (kq.modifiedCount !== 1) throw new AppError(409, M.DU_LIEU_DA_THAY_DOI);
    await ghiNhatKy({
      hanhDong: 'TAI_KHOAN.DOI_MAT_KHAU',
      doiTuong: { loai: 'NguoiDung', ma: nd._id },
      moTa: nd.mustChangePassword ? 'Đổi mật khẩu tạm ở lần đăng nhập đầu tiên' : 'Người dùng tự đổi mật khẩu',
      truoc: { mustChangePassword: !!nd.mustChangePassword },
      sau: { mustChangePassword: false },
    }, session);
  });
  // Mọi token cũ hết hiệu lực (pv tăng); cấp token mới cho phiên hiện tại
  const token = kyToken({ sub: nd._id, vaiTro: user.vaiTro, pv: pvMoi }, env.JWT_EXPIRES_NHAN_SU);
  return {
    token,
    nguoiDung: thongTinNhanSu({ ...nd, mustChangePassword: false }, user.vaiTro),
    trangChu: trangChuTheoVaiTro(user.vaiTro),
    message: M.DMK_THANH_CONG,
  };
}

/** Đăng nhập Phụ huynh / Học viên – luồng 1.a, ngoại lệ 1.a.2a, 1.a.3a (BR04: không cần mật khẩu) */
async function dangNhapPhuHuynh({ hoTen, soDienThoai }) {
  if (laChuoiRong(hoTen) || laChuoiRong(soDienThoai)) throw new AppError(400, M.DN_PH_THIEU_THONG_TIN);
  const sdt = chuanHoaSdt(soDienThoai);
  const ten = chuanHoaTen(hoTen);
  const ungVien = await PhuHuynhHocVien.find({ soDienThoai: sdt }).lean();
  const hv = ungVien.find((x) => chuanHoaTen(x.tenHocVien) === ten);
  if (!hv) throw new AppError(401, M.DN_PH_SAI_THONG_TIN);
  const lop = await LopHoc.find({ _id: { $in: hv.lopTheoHoc } }, { tenLop: 1, loaiLop: 1, trangThaiLop: 1 }).lean();
  const token = kyToken({ sub: hv._id, vaiTro: VAI_TRO.PHU_HUYNH }, env.JWT_EXPIRES_PHU_HUYNH);
  return {
    token,
    hocVien: {
      ma: hv._id,
      tenHocVien: hv.tenHocVien,
      soDienThoaiAn: `${sdt.slice(0, 4)} ••• ${sdt.slice(-3)}`,
      soDienThoai: hv.soDienThoai, // MH38: ô chỉ đọc điền tự động
      dsLop: lop.map((l) => ({ maLop: l._id, tenLop: l.tenLop, loaiLop: l.loaiLop, trangThaiLop: l.trangThaiLop })),
    },
    // Học nhiều lớp → Chọn lớp (MH33), ngược lại → Thời khóa biểu (MH32)
    trangChu: lop.length > 1 ? 'PH-12-c' : 'PH-12-a',
  };
}

async function thongTinToi(user) {
  if (user.vaiTro === VAI_TRO.PHU_HUYNH) {
    const hv = await PhuHuynhHocVien.findById(user.ma).lean();
    const lop = await LopHoc.find({ _id: { $in: hv.lopTheoHoc } }, { tenLop: 1 }).lean();
    return { ma: hv._id, vaiTro: user.vaiTro, tenHocVien: hv.tenHocVien, dsLop: lop.map((l) => ({ maLop: l._id, tenLop: l.tenLop })) };
  }
  const nd = await NguoiDung.findById(user.ma).lean();
  return {
    ma: nd._id, vaiTro: user.vaiTro, hoTen: nd.hoTen, email: nd.email, soDienThoai: nd.soDienThoai,
    hinhThucLamViec: nd.hinhThucLamViec, loaiNhanSu: nd.loaiNhanSu, mustChangePassword: !!nd.mustChangePassword,
  };
}

/** Đăng xuất: thu hồi riêng token đang dùng (giữ 50 mã gần nhất – token tự hết hạn sau 8 giờ / 4 giờ) */
async function dangXuat(user, phien) {
  if (!phien?.jti) return;
  const capNhat = { $push: { tokenThuHoi: { $each: [phien.jti], $slice: -50 } } };
  if (user.vaiTro === VAI_TRO.PHU_HUYNH) await PhuHuynhHocVien.updateOne({ _id: user.ma }, capNhat);
  else await NguoiDung.updateOne({ _id: user.ma }, capNhat);
}

module.exports = { dangNhapNhanSu, dangNhapPhuHuynh, thongTinToi, doiMatKhau, dangXuat };
