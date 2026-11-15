/**
 * Phụ huynh / Học viên: UC_11 Xác nhận ca học, UC_12 Theo dõi lịch học, UC_13 Xin nghỉ học, UC_14 Gửi phản hồi, ý kiến.
 * Thông tin học viên được giữ trong phiên làm việc sau UC_1 (BR04); chỉ truy cập lớp học viên đang theo học.
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { sinhMa } = require('../utils/sinhMa');
const { trongGiaoDich } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');
const { catChuoi } = require('../utils/kiemTra');
const { LichDay, LopHoc, PhuHuynhHocVien, PhanHoiGopY, MonHoc } = require('../models');
const { layBanDo, layTenNguoiDung, tomTatBuoi, nhanCa, moTaLichHoc } = require('./danhMuc.service');
const { thongBaoQuanLy } = require('./thongBao.service');
const { taoPhieu, tienDoCongKhai } = require('./phanHoi.service');

const HAN_XAC_NHAN_GIO = 24;
const XIN_NGHI_TRUOC_GIO = 2;
const TRANG_THAI_DU_KIEN = ['ChoGVXacNhan', 'DaDuyet'];

async function lopCuaHocVien(maPHHV) {
  const hv = await PhuHuynhHocVien.findById(maPHHV).lean();
  return hv ? hv.lopTheoHoc : [];
}

/** MH33 – danh sách lớp đang theo học (UC_12 luồng 2a) */
async function danhSachLop(maPHHV) {
  const dsMa = await lopCuaHocVien(maPHHV);
  const [dsLop, tenMon, banDo] = await Promise.all([
    LopHoc.find({ _id: { $in: dsMa } }).lean(),
    MonHoc.find().lean().then((ds) => new Map(ds.map((m) => [m._id, m.tenMonHoc]))),
    layBanDo(),
  ]);
  const ketQua = [];
  for (const l of dsLop) {
    const buoi = await LichDay.find({ maLop: l._id, trangThaiLich: 'DaPhatHanh', ngayDay: { $gte: clock.homNay() } }).sort({ ngayDay: 1 }).limit(20).lean();
    const maGV = [...new Set(buoi.flatMap((b) => b.phanCong.filter((p) => p.vaiTro === 'GiaoVien').map((p) => p.maNhanSu)))];
    const ten = await layTenNguoiDung(maGV);
    ketQua.push({
      maLop: l._id,
      tenLop: l.tenLop,
      monHoc: tenMon.get(l.maMonHoc),
      loaiLop: l.loaiLop,
      lichHoc: buoi.length ? moTaLichHoc(buoi, banDo) : null,
      giaoVien: maGV.map((m) => ten.get(m)?.hoTen).filter(Boolean).join(', ') || null,
    });
  }
  return ketQua;
}

/** UC_12 bước 2 (MH32): thời khóa biểu tuần của một lớp; ngoại lệ 2b, 2c; BR02 */
async function thoiKhoaBieu(maPHHV, { maLop, tuan }) {
  const dsMa = await lopCuaHocVien(maPHHV);
  const lopXem = maLop || dsMa[0];
  if (!lopXem || !dsMa.includes(lopXem)) throw new AppError(403, M.TKB_KHONG_PHAI_LOP);
  const ngayTrongTuan = tuan ? clock.parseNgay(tuan) : clock.homNay();
  if (!ngayTrongTuan) throw new AppError(400, M.HS_KHONG_HOP_LE);
  const tuNgay = clock.dauTuan(ngayTrongTuan);
  const denNgay = clock.congNgay(tuNgay, 6);
  const [banDo, buoi] = await Promise.all([
    layBanDo(),
    LichDay.find({ maLop: lopXem, ngayDay: { $gte: tuNgay, $lte: denNgay }, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } }).sort({ ngayDay: 1, maCa: 1 }).lean(),
  ]);
  const daPhatHanh = buoi.filter((b) => b.trangThaiLich === 'DaPhatHanh');
  // 2c: lịch của lớp đang được điều chỉnh, chưa phát hành lại → không hiển thị lịch chưa phát hành
  const dangCapNhat = !daPhatHanh.length && buoi.length > 0;
  return {
    lop: { maLop: lopXem, tenLop: banDo.lop.get(lopXem)?.tenLop },
    nhieuLop: dsMa.length > 1,
    tuan: { tuNgay: clock.dinhDangNgay(tuNgay), denNgay: clock.dinhDangNgay(denNgay) },
    cot: Array.from({ length: 7 }, (_, i) => {
      const d = clock.congNgay(tuNgay, i);
      return { ngay: clock.dinhDangNgay(d), thu: clock.tenThu(d), nhanNgay: clock.nhanNgayNgan(d) };
    }),
    dong: banDo.dsCa.map((ca) => ({ maCa: ca._id, tenCa: ca.tenCa, gio: `${ca.gioBatDau} – ${ca.gioKetThuc}` })),
    caHoc: daPhatHanh.map((b) => ({
      ...tomTatBuoi(b, banDo),
      baoVang: b.yeuCauNghiHoc.some((y) => y.maPHHV === maPHHV),
      buoiBu: (b.lichSu || []).some((l) => l.ghiChu === 'Buổi bù'), // ghi chú trên thẻ ca học (MH32)
    })),
    thongBao: dangCapNhat ? M.TKB_DANG_CAP_NHAT : undefined,
  };
}

async function layCaHocCuaToi(maPHHV, maLichDay, dsTrangThai) {
  const dsMa = await lopCuaHocVien(maPHHV);
  const ld = await LichDay.findOne({ _id: maLichDay, maLop: { $in: dsMa }, trangThaiLich: { $in: dsTrangThai } }).lean();
  return ld;
}

function trangThaiXinNghi(ld, ca) {
  const batDau = clock.thoiDiem(ld.ngayDay, ca.gioBatDau);
  const bayGio = clock.now();
  if (batDau <= bayGio) return { coThe: false, lyDo: M.NGHI_DA_DIEN_RA }; // 1a
  if (batDau.getTime() - bayGio.getTime() < XIN_NGHI_TRUOC_GIO * clock.MOT_GIO) return { coThe: false, lyDo: M.NGHI_CHUA_DU_2_TIENG }; // 5a
  return { coThe: true };
}

/** UC_12 bước 4 (MH34): chi tiết ca học; ngoại lệ 4a */
async function chiTietCaHoc(maPHHV, maLichDay) {
  const ld = await layCaHocCuaToi(maPHHV, maLichDay, ['DaPhatHanh']);
  if (!ld) throw new AppError(404, M.TKB_KHONG_TAI_DUOC_CHI_TIET);
  const banDo = await layBanDo();
  const ca = banDo.ca.get(ld.maCa);
  const lop = banDo.lop.get(ld.maLop);
  const ten = await layTenNguoiDung(ld.phanCong.map((p) => p.maNhanSu));
  const theoVaiTro = (vt) => ld.phanCong.filter((p) => p.vaiTro === vt).map((p) => ten.get(p.maNhanSu)?.hoTen).join(', ') || null;
  const xinNghi = trangThaiXinNghi(ld, ca);
  const daBaoVang = ld.yeuCauNghiHoc.some((y) => y.maPHHV === maPHHV);
  return {
    maLichDay: ld._id,
    tenLop: lop?.tenLop,
    monHoc: banDo.mon.get(lop?.maMonHoc)?.tenMonHoc,
    ngayGioHoc: `${clock.tenThu(ld.ngayDay)} ${clock.dinhDangNgay(ld.ngayDay).split('-').reverse().join('/')} · ${ca.gioBatDau} – ${ca.gioKetThuc}`,
    soPhong: banDo.phong.get(ld.maPhong)?.tenPhong,
    giaoVien: theoVaiTro('GiaoVien'),
    troGiang: theoVaiTro('TroGiang'),
    daBaoVang,
    coTheXinNghi: xinNghi.coThe && !daBaoVang,
    lyDoKhongTheXinNghi: xinNghi.coThe ? undefined : xinNghi.lyDo,
  };
}

/* ------------------------------------------------------------------ UC_11 */

const hanXacNhan = (ld) => ld.thoiDiemGuiDuKien && new Date(ld.thoiDiemGuiDuKien.getTime() + HAN_XAC_NHAN_GIO * clock.MOT_GIO);

/** UC_11 bước 2 (MH35): lịch học dự kiến cần xác nhận */
async function lichDuKien(maPHHV) {
  const dsMa = await lopCuaHocVien(maPHHV);
  const [banDo, ds] = await Promise.all([
    layBanDo(),
    LichDay.find({ maLop: { $in: dsMa }, trangThaiLich: { $in: TRANG_THAI_DU_KIEN }, thoiDiemGuiDuKien: { $exists: true } }).sort({ ngayDay: 1, maCa: 1 }).lean(),
  ]);
  const ten = await layTenNguoiDung(ds.flatMap((l) => l.phanCong.map((p) => p.maNhanSu)));
  const bayGio = clock.now();
  const caHoc = ds.map((ld) => {
    const xn = ld.xacNhanCaHoc.find((x) => x.maPHHV === maPHHV);
    const han = hanXacNhan(ld);
    return {
      ...tomTatBuoi(ld, banDo),
      tenGiaoVien: ld.phanCong.filter((p) => p.vaiTro === 'GiaoVien').map((p) => ten.get(p.maNhanSu)?.hoTen).join(', '),
      gioHoc: nhanCa(banDo.ca.get(ld.maCa)),
      hanChot: han,
      daKhoa: han <= bayGio,
      ketQua: xn ? xn.ketQua : null, // null: chưa phản hồi
      lyDoTuChoi: xn?.lyDoTuChoi,
    };
  });
  const chuaPhanHoi = caHoc.filter((c) => !c.ketQua && !c.daKhoa);
  const hanGanNhat = chuaPhanHoi.length ? new Date(Math.min(...chuaPhanHoi.map((c) => c.hanChot.getTime()))) : null;
  const daKhoaTatCa = caHoc.length > 0 && caHoc.filter((c) => !c.ketQua).every((c) => c.daKhoa) && caHoc.some((c) => !c.ketQua);
  return {
    caHoc,
    soCaChuaPhanHoi: chuaPhanHoi.length,
    hanChot: hanGanNhat,
    conLaiGio: hanGanNhat ? Math.max(0, Math.ceil((hanGanNhat - bayGio) / clock.MOT_GIO)) /* làm tròn lên: còn 40 phút hiển thị "Còn 1 giờ", không hiện "Còn 0 giờ" */ : null,
    // 5a: quá hạn 24 giờ → khóa phản hồi
    thongBao: daKhoaTatCa ? M.XN_QUA_HAN : undefined,
    chiTiet: daKhoaTatCa ? M.XN_QUA_HAN_CHI_TIET : undefined,
  };
}

function locChoXacNhan(maPHHV, dsLop, them = {}) {
  const moc = new Date(clock.now().getTime() - HAN_XAC_NHAN_GIO * clock.MOT_GIO);
  return {
    maLop: { $in: dsLop },
    trangThaiLich: { $in: TRANG_THAI_DU_KIEN },
    thoiDiemGuiDuKien: { $gt: moc }, // bước 6: còn trong hạn 24 giờ
    'xacNhanCaHoc.maPHHV': { $ne: maPHHV }, // BR01: mỗi ca chỉ xử lý một lần
    ...them,
  };
}

async function lyDoKhongXacNhanDuoc(maPHHV, maLichDay) {
  const ld = await layCaHocCuaToi(maPHHV, maLichDay, TRANG_THAI_DU_KIEN);
  if (!ld || !ld.thoiDiemGuiDuKien) return new AppError(404, M.KHONG_TIM_THAY_LICH);
  if (ld.xacNhanCaHoc.some((x) => x.maPHHV === maPHHV)) return new AppError(409, M.XN_DA_PHAN_HOI);
  if (hanXacNhan(ld) <= clock.now()) return new AppError(403, M.XN_QUA_HAN, { data: { chiTiet: M.XN_QUA_HAN_CHI_TIET } });
  return new AppError(409, M.XN_DA_PHAN_HOI);
}

/** UC_11 bước 3–9: xác nhận tham gia một ca học */
async function xacNhanCaHoc(user, maLichDay) {
  const dsLop = await lopCuaHocVien(user.ma);
  return trongGiaoDich(async (session) => {
    const ma = await sinhMa('XN', session);
    // Cập nhật nguyên tử: chỉ ghi khi còn hạn 24 giờ và học viên chưa phản hồi ca này (BR01, BR03)
    const kq = await LichDay.updateOne(
      locChoXacNhan(user.ma, dsLop, { _id: maLichDay }),
      { $push: { xacNhanCaHoc: { maXacNhan: ma, maPHHV: user.ma, ketQua: 'XacNhan', thoiGianXacNhan: clock.now() } } },
      { session },
    );
    if (kq.modifiedCount !== 1) throw await lyDoKhongXacNhanDuoc(user.ma, maLichDay);
    await ghiNhatKy({ hanhDong: 'XAC_NHAN_CA_HOC.XAC_NHAN', doiTuong: { loai: 'LichDay', ma: maLichDay }, sau: { maPHHV: user.ma, ketQua: 'XacNhan' } }, session);
    return { maLichDay, ketQua: 'XacNhan' };
  });
}

/** UC_11 luồng 3a: từ chối ca học kèm lý do; ngoại lệ 3a.5a */
async function tuChoiCaHoc(user, maLichDay, { lyDoTuChoi }) {
  const lyDo = catChuoi(lyDoTuChoi);
  if (!lyDo) throw new AppError(400, M.XN_TRONG_LY_DO, { fieldErrors: { lyDoTuChoi: M.XN_TRONG_LY_DO } });
  if (lyDo.length > 500) throw new AppError(400, M.XN_LY_DO_VUOT_500, { fieldErrors: { lyDoTuChoi: M.XN_LY_DO_VUOT_500 } });
  const dsLop = await lopCuaHocVien(user.ma);
  const banDo = await layBanDo();
  return trongGiaoDich(async (session) => {
    const ma = await sinhMa('XN', session);
    const kq = await LichDay.updateOne(
      locChoXacNhan(user.ma, dsLop, { _id: maLichDay }),
      { $push: { xacNhanCaHoc: { maXacNhan: ma, maPHHV: user.ma, ketQua: 'TuChoi', lyDoTuChoi: lyDo, thoiGianXacNhan: clock.now() } } },
      { session },
    );
    if (kq.modifiedCount !== 1) throw await lyDoKhongXacNhanDuoc(user.ma, maLichDay);
    await ghiNhatKy({ hanhDong: 'XAC_NHAN_CA_HOC.TU_CHOI', doiTuong: { loai: 'LichDay', ma: maLichDay }, sau: { maPHHV: user.ma, ketQua: 'TuChoi', lyDoTuChoi: lyDo } }, session);
    const ld = await LichDay.findById(maLichDay).session(session).lean();
    // 3a.8: chuyển tiếp về Quản lý để điều chỉnh lịch
    await thongBaoQuanLy({
      loaiThongBao: 'PhanHoiMoi',
      tieuDe: `Học viên ${user.hoTen} từ chối ca học`,
      noiDung: `Lớp ${banDo.lop.get(ld.maLop)?.tenLop} · ${clock.nhanNgayDayDu(ld.ngayDay)}: ${lyDo}`,
    }, session);
    return { maLichDay, ketQua: 'TuChoi' };
  });
}

/** UC_11 luồng 3b: xác nhận tất cả các ca chưa phản hồi */
async function xacNhanTatCa(user) {
  const dsLop = await lopCuaHocVien(user.ma);
  const dsCa = await LichDay.find(locChoXacNhan(user.ma, dsLop), { _id: 1 }).lean();
  if (!dsCa.length) {
    const dk = await lichDuKien(user.ma);
    if (dk.thongBao) throw new AppError(403, M.XN_QUA_HAN, { data: { chiTiet: M.XN_QUA_HAN_CHI_TIET } });
    throw new AppError(409, M.XN_KHONG_CON_CA);
  }
  const soCa = await trongGiaoDich(async (session) => {
    const daXacNhan = [];
    for (const { _id } of dsCa) {
      const ma = await sinhMa('XN', session);
      const kq = await LichDay.updateOne(
        locChoXacNhan(user.ma, dsLop, { _id }),
        { $push: { xacNhanCaHoc: { maXacNhan: ma, maPHHV: user.ma, ketQua: 'XacNhan', thoiGianXacNhan: clock.now() } } },
        { session },
      );
      if (kq.modifiedCount) daXacNhan.push(_id);
    }
    if (daXacNhan.length) {
      await ghiNhatKy({ hanhDong: 'XAC_NHAN_CA_HOC.XAC_NHAN_TAT_CA', doiTuong: { loai: 'PhuHuynhHocVien', ma: user.ma }, sau: { ketQua: 'XacNhan', dsMaLichDay: daXacNhan } }, session);
    }
    return daXacNhan.length;
  });
  return { soCa, message: M.XN_TAT_CA_THANH_CONG(soCa) };
}

/* ------------------------------------------------------------------ UC_13 */

/** UC_13 bước 2: biểu mẫu xin nghỉ điền sẵn thông tin ca học */
async function thongTinXinNghi(maPHHV, maLichDay) {
  const ct = await chiTietCaHoc(maPHHV, maLichDay);
  return {
    maLichDay: ct.maLichDay,
    tenLop: ct.tenLop,
    ngayHoc: ct.ngayGioHoc,
    giaoVien: ct.giaoVien,
    dsLyDo: E.LY_DO_XIN_NGHI,
    coTheXinNghi: ct.coTheXinNghi,
    lyDoKhongTheXinNghi: ct.daBaoVang ? M.NGHI_DA_GUI : ct.lyDoKhongTheXinNghi,
  };
}

/** UC_13 bước 3–7; ngoại lệ 1a, 5a; BR01, BR02 */
async function xinNghi(user, maLichDay, body) {
  const lyDoXinNghi = catChuoi(body.lyDoXinNghi);
  const ghiChu = catChuoi(body.ghiChu);
  if (!lyDoXinNghi || !E.LY_DO_XIN_NGHI.includes(lyDoXinNghi)) {
    throw new AppError(400, M.NGHI_CHUA_CHON_LY_DO, { fieldErrors: { lyDoXinNghi: M.NGHI_CHUA_CHON_LY_DO } });
  }
  if (ghiChu && ghiChu.length > 500) throw new AppError(400, M.VUOT_500, { fieldErrors: { ghiChu: M.VUOT_500 } });
  const ld = await layCaHocCuaToi(user.ma, maLichDay, ['DaPhatHanh']);
  if (!ld) throw new AppError(404, M.TKB_KHONG_TAI_DUOC_CHI_TIET);
  const banDo = await layBanDo();
  const ca = banDo.ca.get(ld.maCa);
  const kiem = trangThaiXinNghi(ld, ca);
  if (!kiem.coThe) throw new AppError(422, kiem.lyDo);
  if (ld.yeuCauNghiHoc.some((y) => y.maPHHV === user.ma)) throw new AppError(409, M.NGHI_DA_GUI);
  return trongGiaoDich(async (session) => {
    // Kiểm tra lại thời hạn 2 tiếng ngay tại thời điểm ghi (BR01)
    const kiemLai = trangThaiXinNghi(ld, ca);
    if (!kiemLai.coThe) throw new AppError(422, kiemLai.lyDo);
    const yc = { maYeuCauNghi: await sinhMa('NH', session), maPHHV: user.ma, lyDoXinNghi, thoiGianGui: clock.now(), trangThaiNghi: 'BaoVang' };
    if (ghiChu) yc.ghiChu = ghiChu;
    const kq = await LichDay.updateOne(
      { _id: maLichDay, trangThaiLich: 'DaPhatHanh', 'yeuCauNghiHoc.maPHHV': { $ne: user.ma } },
      { $push: { yeuCauNghiHoc: yc } },
      { session },
    );
    if (kq.modifiedCount !== 1) throw new AppError(409, M.NGHI_DA_GUI);
    await ghiNhatKy({ hanhDong: 'XIN_NGHI.TAO', doiTuong: { loai: 'LichDay', ma: maLichDay }, sau: { ...yc } }, session);
    // Bước 6: thông báo ngay đến Quản lý
    await thongBaoQuanLy({
      loaiThongBao: 'BaoVang',
      tieuDe: `Báo vắng: ${user.hoTen}`,
      noiDung: `Lớp ${banDo.lop.get(ld.maLop)?.tenLop} · ${clock.nhanNgayDayDu(ld.ngayDay)} · ${nhanCa(ca)}.`,
    }, session);
    return { maLichDay, trangThaiNghi: 'BaoVang', maYeuCauNghi: yc.maYeuCauNghi };
  });
}

/* ------------------------------------------------------------------ UC_14 */

/** UC_14 bước 3–7; ngoại lệ 5a; BR01 */
async function guiGopY(user, body, tepDinhKem = []) {
  const loaiPhanHoi = catChuoi(body.loaiPhanHoi);
  const tieuDe = catChuoi(body.tieuDe);
  const noiDung = catChuoi(body.noiDung);
  if (!tieuDe || !noiDung) {
    throw new AppError(400, M.GY_THIEU, { fieldErrors: { ...(tieuDe ? {} : { tieuDe: M.GY_THIEU }), ...(noiDung ? {} : { noiDung: M.GY_THIEU }) } });
  }
  if (!loaiPhanHoi || !E.LOAI_PHAN_HOI_PHU_HUYNH.includes(loaiPhanHoi)) {
    throw new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors: { loaiPhanHoi: M.HS_KHONG_HOP_LE } });
  }
  if (noiDung.length > 500) throw new AppError(400, M.VUOT_500, { fieldErrors: { noiDung: M.VUOT_500 } }); // BR03
  if (tieuDe.length > 200) throw new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors: { tieuDe: M.HS_KHONG_HOP_LE } });
  const phieu = await taoPhieu({ maPHHV: user.ma, loaiPhanHoi, tieuDe, noiDung, tepDinhKem });
  return { maPhieu: phieu._id, ...tienDoCongKhai(phieu), huongDan: 'Dùng Mã phiếu tại mục “Tra cứu phiếu” để theo dõi tiến độ xử lý.' };
}

/** UC_14 luồng 1a: tra cứu tiến độ theo mã phiếu (BR02: chỉ trạng thái công khai và câu trả lời chính thức) */
async function traCuuPhieu(maPHHV, maPhieu) {
  const p = await PhanHoiGopY.findOne({ _id: String(maPhieu || '').trim().toUpperCase(), maPHHV }).lean();
  if (!p) throw new AppError(404, M.GY_KHONG_TIM_THAY_PHIEU);
  return tienDoCongKhai(p);
}

/** MH40: lịch sử phản hồi của học viên trong phiên */
async function lichSuPhieu(maPHHV) {
  const ds = await PhanHoiGopY.find({ maPHHV }).sort({ thoiGianGui: -1 }).lean();
  return ds.map(tienDoCongKhai);
}

module.exports = {
  danhSachLop,
  thoiKhoaBieu,
  chiTietCaHoc,
  lichDuKien,
  xacNhanCaHoc,
  tuChoiCaHoc,
  xacNhanTatCa,
  thongTinXinNghi,
  xinNghi,
  guiGopY,
  traCuuPhieu,
  lichSuPhieu,
};
