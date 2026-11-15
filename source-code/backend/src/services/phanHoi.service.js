/**
 * Phiếu phản hồi (collection `phanHoiGopY`):
 * - UC_4 Tiếp nhận và xử lý phản hồi (Quản lý): 4.1 Xem, 4.2 Cập nhật trạng thái, 4.3 Phản hồi người gửi
 * - Tạo phiếu: UC_10 (Giáo viên / Trợ giảng), UC_14 (Phụ huynh / Học viên)
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { sinhMa, sinhMaPhieu } = require('../utils/sinhMa');
const { trongGiaoDich } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');
const { laChuoiRong, catChuoi } = require('../utils/kiemTra');
const { PhanHoiGopY, PhuHuynhHocVien } = require('../models');
const { layTenNguoiDung } = require('./danhMuc.service');
const { guiThongBao, thongBaoQuanLy } = require('./thongBao.service');

/** Trạng thái hiển thị phía Phụ huynh / Học viên (UC_14 luồng 1a) */
const NHAN_TRANG_THAI_CONG_KHAI = {
  ChoXuLy: 'Đã tiếp nhận',
  DangXuLy: 'Đang xử lý',
  DaXuLy: 'Đã hoàn thành',
  TuChoi: 'Từ chối',
};

async function thongTinNguoiGui(dsPhieu) {
  const ten = await layTenNguoiDung(dsPhieu.map((p) => p.maNhanSu).filter(Boolean));
  const dsHV = await PhuHuynhHocVien.find({ _id: { $in: dsPhieu.map((p) => p.maPHHV).filter(Boolean) } }).lean();
  const hv = new Map(dsHV.map((h) => [h._id, h]));
  return (p) => (p.maNhanSu
    ? { loai: 'NhanSu', ma: p.maNhanSu, hoTen: ten.get(p.maNhanSu)?.hoTen, vaiTro: ten.get(p.maNhanSu)?.loaiNhanSu }
    : { loai: 'PhuHuynhHocVien', ma: p.maPHHV, hoTen: hv.get(p.maPHHV)?.tenHocVien, soDienThoai: hv.get(p.maPHHV)?.soDienThoai });
}

/** UC_4.1 bước 2: danh sách phản hồi, yêu cầu (mã, tiêu đề, người gửi, thời gian gửi, trạng thái) */
async function danhSach({ trangThai, loai, q, nguoiGui }) {
  const loc = {};
  if (trangThai && E.TRANG_THAI_XU_LY.includes(trangThai)) loc.trangThaiXuLy = trangThai;
  if (loai && E.LOAI_PHAN_HOI.includes(loai)) loc.loaiPhanHoi = loai;
  if (nguoiGui === 'NhanSu') loc.maNhanSu = { $exists: true };
  if (nguoiGui === 'PhuHuynhHocVien') loc.maPHHV = { $exists: true };
  if (!laChuoiRong(q)) {
    const tu = String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    loc.$or = [{ _id: new RegExp(tu, 'i') }, { tieuDe: new RegExp(tu, 'i') }];
  }
  const [ds, demTheoTrangThai] = await Promise.all([
    PhanHoiGopY.find(loc, { tepDinhKem: 0, lichSuXuLy: 0 }).sort({ thoiGianGui: -1 }).lean(),
    PhanHoiGopY.aggregate([{ $group: { _id: '$trangThaiXuLy', soLuong: { $sum: 1 } } }]),
  ]);
  const nguoi = await thongTinNguoiGui(ds);
  return {
    dem: Object.fromEntries(demTheoTrangThai.map((d) => [d._id, d.soLuong])),
    ds: ds.map((p) => ({
      maPhanHoi: p._id,
      tieuDe: p.tieuDe,
      loaiPhanHoi: p.loaiPhanHoi,
      nguoiGui: nguoi(p),
      thoiGianGui: p.thoiGianGui,
      trangThaiXuLy: p.trangThaiXuLy,
    })),
  };
}

/** UC_4.1 bước 4–6, ngoại lệ 3a */
async function chiTiet(maPhanHoi) {
  const p = await PhanHoiGopY.findById(maPhanHoi).lean();
  if (!p) throw new AppError(404, M.PH_KHONG_TIM_THAY);
  const nguoi = await thongTinNguoiGui([p]);
  const tenQL = await layTenNguoiDung([p.maQuanLy, ...p.lichSuXuLy.map((l) => l.maQuanLy)].filter(Boolean));
  return {
    maPhanHoi: p._id,
    tieuDe: p.tieuDe,
    loaiPhanHoi: p.loaiPhanHoi,
    noiDung: p.noiDung,
    nguoiGui: nguoi(p),
    thoiGianGui: p.thoiGianGui,
    trangThaiXuLy: p.trangThaiXuLy,
    quanLyPhuTrach: p.maQuanLy ? { ma: p.maQuanLy, hoTen: tenQL.get(p.maQuanLy)?.hoTen } : null,
    tepDinhKem: p.tepDinhKem,
    lichSuXuLy: p.lichSuXuLy.map((l) => ({ ...l, hoTenQuanLy: tenQL.get(l.maQuanLy)?.hoTen })),
  };
}

function nguoiNhanCuaPhieu(p) {
  return p.maNhanSu ? { maNguoiNhan: p.maNhanSu } : { maPHHV: p.maPHHV };
}

/** UC_4.2 – Cập nhật trạng thái xử lý (BR01–BR06) */
async function capNhatTrangThai(maPhanHoi, { trangThaiMoi, ghiChu }, maQuanLy) {
  const ghiChuXuLy = catChuoi(ghiChu);
  if (!trangThaiMoi) throw new AppError(400, M.PH_CHUA_CHON_TRANG_THAI, { fieldErrors: { trangThaiMoi: M.PH_CHUA_CHON_TRANG_THAI } }); // 7a
  if (!['DangXuLy', 'DaXuLy', 'TuChoi'].includes(trangThaiMoi)) {
    throw new AppError(400, M.PH_CHUA_CHON_TRANG_THAI, { fieldErrors: { trangThaiMoi: M.PH_CHUA_CHON_TRANG_THAI } });
  }
  if (trangThaiMoi === 'TuChoi' && !ghiChuXuLy) {
    throw new AppError(400, M.PH_TRONG_LY_DO_TU_CHOI, { fieldErrors: { ghiChu: M.PH_TRONG_LY_DO_TU_CHOI } }); // 7b
  }
  if (ghiChuXuLy && ghiChuXuLy.length > 500) throw new AppError(400, M.VUOT_500, { fieldErrors: { ghiChu: M.VUOT_500 } }); // BR06
  const p = await PhanHoiGopY.findById(maPhanHoi).lean();
  if (!p) throw new AppError(404, M.PH_KHONG_TIM_THAY);
  if (!['ChoXuLy', 'DangXuLy'].includes(p.trangThaiXuLy)) throw new AppError(409, M.PH_CHI_CAP_NHAT_KHI); // BR01

  return trongGiaoDich(async (session) => {
    const lichSu = {
      maLichSu: await sinhMa('XL', session),
      maQuanLy,
      loaiThaoTac: 'CapNhatTrangThai',
      trangThaiTruoc: p.trangThaiXuLy,
      trangThaiSau: trangThaiMoi,
      thoiGianXuLy: clock.now(),
    };
    if (ghiChuXuLy) lichSu.ghiChuXuLy = ghiChuXuLy;
    // Một lệnh nguyên tử: chỉ cập nhật khi vẫn đang Chờ xử lý / Đang xử lý; mỗi lần đều ghi lịch sử (BR04)
    const kq = await PhanHoiGopY.updateOne(
      { _id: maPhanHoi, trangThaiXuLy: { $in: ['ChoXuLy', 'DangXuLy'] } },
      { $set: { trangThaiXuLy: trangThaiMoi, maQuanLy: p.maQuanLy || maQuanLy }, $push: { lichSuXuLy: lichSu } },
      { session, runValidators: true },
    );
    if (kq.modifiedCount !== 1) throw new AppError(409, M.PH_CHI_CAP_NHAT_KHI);
    await ghiNhatKy({
      hanhDong: trangThaiMoi === 'TuChoi' ? 'PHAN_HOI.TU_CHOI' : 'PHAN_HOI.CAP_NHAT_TRANG_THAI',
      doiTuong: { loai: 'PhanHoiGopY', ma: maPhanHoi },
      truoc: { trangThaiXuLy: p.trangThaiXuLy },
      sau: { trangThaiXuLy: trangThaiMoi, ghiChuXuLy: ghiChuXuLy || null },
    }, session);
    // BR05: đồng bộ trạng thái sang giao diện người gửi
    await guiThongBao([{
      ...nguoiNhanCuaPhieu(p),
      loaiThongBao: 'KetQuaXuLy',
      tieuDe: `Phiếu ${p._id}: ${NHAN_TRANG_THAI_CONG_KHAI[trangThaiMoi]}`,
      noiDung: `Phiếu “${p.tieuDe}” được cập nhật trạng thái “${NHAN_TRANG_THAI_CONG_KHAI[trangThaiMoi]}”.${ghiChuXuLy && trangThaiMoi === 'TuChoi' ? ` Lý do: ${ghiChuXuLy}` : ''}`,
    }], session);
    return { maPhanHoi, trangThaiTruoc: p.trangThaiXuLy, trangThaiXuLy: trangThaiMoi, lichSu };
  });
}

/** UC_4.3 – Phản hồi lại người gửi (BR01–BR04) */
async function traLoiNguoiGui(maPhanHoi, { noiDung }, maQuanLy) {
  const noiDungPhanHoi = catChuoi(noiDung);
  if (!noiDungPhanHoi) throw new AppError(400, M.PH_KHONG_DUOC_DE_TRONG, { fieldErrors: { noiDung: M.PH_KHONG_DUOC_DE_TRONG } }); // 7a
  if (noiDungPhanHoi.length > 500) throw new AppError(400, M.VUOT_500, { fieldErrors: { noiDung: M.VUOT_500 } }); // BR04
  const p = await PhanHoiGopY.findById(String(maPhanHoi)).lean();
  if (!p) throw new AppError(404, M.PH_KHONG_TIM_THAY);
  try {
    return await trongGiaoDich(async (session) => {
      const lichSu = {
        maLichSu: await sinhMa('XL', session),
        maQuanLy,
        loaiThaoTac: 'PhanHoiNguoiGui',
        noiDungPhanHoi,
        thoiGianXuLy: clock.now(),
      };
      await PhanHoiGopY.updateOne(
        { _id: maPhanHoi },
        { $push: { lichSuXuLy: lichSu }, $set: { maQuanLy: p.maQuanLy || maQuanLy } },
        { session, runValidators: true },
      );
      await ghiNhatKy({
        hanhDong: 'PHAN_HOI.TRA_LOI',
        doiTuong: { loai: 'PhanHoiGopY', ma: p._id },
        sau: { noiDungPhanHoi },
      }, session);
      // BR02: chỉ gửi đến người gửi phản hồi gốc
      await guiThongBao([{
        ...nguoiNhanCuaPhieu(p),
        loaiThongBao: 'KetQuaXuLy',
        tieuDe: `Trung tâm đã trả lời phiếu ${p._id}`,
        noiDung: noiDungPhanHoi,
      }], session);
      return { maPhanHoi, lichSu };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.PH_GUI_THAT_BAI); // 9a
  }
}

/** Tạo phiếu – dùng chung cho UC_10 và UC_14 */
async function taoPhieu({ maNhanSu, maPHHV, loaiPhanHoi, tieuDe, noiDung, tepDinhKem = [] }) {
  return trongGiaoDich(async (session) => {
    // Figma GV-10: yêu cầu của giáo viên mang mã YC-NNNN; phiếu của phụ huynh giữ PH-YYMM-NNNN (PH-14)
    const ma = maNhanSu ? await sinhMa('YC', session) : await sinhMaPhieu(session);
    const dsTep = [];
    for (const t of tepDinhKem) dsTep.push({ maTep: await sinhMa('TP', session), ...t });
    const doc = { _id: ma, loaiPhanHoi, tieuDe, noiDung, thoiGianGui: clock.now(), trangThaiXuLy: 'ChoXuLy', tepDinhKem: dsTep };
    if (maNhanSu) doc.maNhanSu = maNhanSu;
    else doc.maPHHV = maPHHV;
    const [phieu] = await PhanHoiGopY.create([doc], { session });
    await ghiNhatKy({
      hanhDong: maNhanSu ? 'YEU_CAU.TAO' : 'GOP_Y.TAO',
      doiTuong: { loai: 'PhanHoiGopY', ma },
      sau: { loaiPhanHoi, tieuDe, noiDung, trangThaiXuLy: 'ChoXuLy', soTep: dsTep.length },
    }, session);
    // Gửi ngay đến Quản lý (UC_10 BR02, UC_14 hậu điều kiện 3)
    await thongBaoQuanLy({ loaiThongBao: 'PhanHoiMoi', tieuDe: `Phản hồi mới ${ma}`, noiDung: tieuDe }, session);
    return phieu.toObject();
  });
}

/** Tiến độ công khai của một phiếu (UC_10 bước 9, UC_14 luồng 1a, BR02) */
function tienDoCongKhai(p) {
  const moc = (tt) => p.lichSuXuLy.find((l) => l.loaiThaoTac === 'CapNhatTrangThai' && l.trangThaiSau === tt)?.thoiGianXuLy;
  const traLoi = [...p.lichSuXuLy].reverse().find((l) => l.loaiThaoTac === 'PhanHoiNguoiGui');
  return {
    maPhieu: p._id,
    tieuDe: p.tieuDe,
    noiDung: p.noiDung,
    loaiPhanHoi: p.loaiPhanHoi,
    thoiGianGui: p.thoiGianGui,
    trangThaiXuLy: p.trangThaiXuLy,
    nhanTrangThai: NHAN_TRANG_THAI_CONG_KHAI[p.trangThaiXuLy],
    tienDo: [
      { buoc: 'Đã tiếp nhận', thoiGian: p.thoiGianGui, daQua: true },
      { buoc: 'Đang xử lý', thoiGian: moc('DangXuLy') || null, daQua: ['DangXuLy', 'DaXuLy', 'TuChoi'].includes(p.trangThaiXuLy) },
      { buoc: 'Đã hoàn thành', thoiGian: moc('DaXuLy') || moc('TuChoi') || null, daQua: ['DaXuLy', 'TuChoi'].includes(p.trangThaiXuLy) },
    ],
    cauTraLoiChinhThuc: traLoi ? { noiDung: traLoi.noiDungPhanHoi, thoiGian: traLoi.thoiGianXuLy } : null,
  };
}

module.exports = { danhSach, chiTiet, capNhatTrangThai, traLoiNguoiGui, taoPhieu, tienDoCongKhai, NHAN_TRANG_THAI_CONG_KHAI };
