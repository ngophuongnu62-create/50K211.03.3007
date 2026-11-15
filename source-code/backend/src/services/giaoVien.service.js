/**
 * Giáo viên / Trợ giảng: UC_7 Tra cứu lịch dạy cá nhân, UC_8 Phản hồi lịch dạy được phân công,
 * UC_9 Cập nhật lịch rảnh, UC_10 Gửi phản hồi, yêu cầu; Trang chủ GV (MH25).
 * Giáo viên chỉ thấy dữ liệu thuộc phân công của chính mình (UC_7 BR01, UC_8 BR01, UC_9 BR04).
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { sinhMa } = require('../utils/sinhMa');
const { trongGiaoDich } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');
const { laChuoiRong, catChuoi } = require('../utils/kiemTra');
const { LichDay, LichRanh, PhanHoiGopY, MonHoc } = require('../models');
const { layBanDo, layTenNguoiDung, tomTatBuoi, nhanCa } = require('./danhMuc.service');
const { thongBaoQuanLy } = require('./thongBao.service');
const { taoPhieu, tienDoCongKhai } = require('./phanHoi.service');

const HAN_PHAN_HOI_GIO = 24;
const SO_CA_RANH_TOI_THIEU = 5;

const hanPhanHoi = (pc) => pc.thoiDiemGuiThongBao && new Date(pc.thoiDiemGuiThongBao.getTime() + HAN_PHAN_HOI_GIO * clock.MOT_GIO);

/** Đánh dấu "HetHan" cho phân công quá 24 giờ chưa phản hồi (UC_8 BR03) */
async function capNhatPhanCongHetHan() {
  const moc = new Date(clock.now().getTime() - HAN_PHAN_HOI_GIO * clock.MOT_GIO);
  const loc = { phanCong: { $elemMatch: { trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: { $lte: moc } } } };
  // Đa số lần gọi không có gì quá hạn → kiểm tra nhanh, không mở giao dịch
  if (!(await LichDay.exists(loc))) return 0;
  return trongGiaoDich(async (session) => {
    const ds = await LichDay.find(loc, { _id: 1 }).session(session).lean();
    if (!ds.length) return 0;
    const kq = await LichDay.updateMany(
      { _id: { $in: ds.map((d) => d._id) }, ...loc },
      { $set: { 'phanCong.$[pc].trangThaiPhanCong': 'HetHan' } },
      { arrayFilters: [{ 'pc.trangThaiPhanCong': 'ChoXacNhan', 'pc.thoiDiemGuiThongBao': { $lte: moc } }], session },
    );
    if (kq.modifiedCount) {
      await ghiNhatKy({
        hanhDong: 'PHAN_CONG.HET_HAN',
        doiTuong: { loai: 'LichDay', ma: ds.length === 1 ? ds[0]._id : `${ds.length} buổi` },
        moTa: 'Tự động khóa phản hồi phân công quá hạn 24 giờ (UC_8 BR03)',
        truoc: { trangThaiPhanCong: 'ChoXacNhan' },
        sau: { trangThaiPhanCong: 'HetHan', dsMaLichDay: ds.map((d) => d._id) },
        nguoiThucHien: { ma: 'HE_THONG', vaiTro: 'HeThong', hoTen: 'Tác vụ tự động' },
      }, session);
    }
    return kq.modifiedCount;
  });
}

/** Điều kiện lịch hiển thị cho giáo viên: lịch dự kiến đã gửi + lịch chính thức (UC_7 BR02) */
function locLichCuaToi(maNhanSu) {
  return {
    $or: [
      { trangThaiLich: 'DaPhatHanh', 'phanCong.maNhanSu': maNhanSu },
      {
        trangThaiLich: { $in: ['ChoGVXacNhan', 'DaDuyet'] },
        phanCong: { $elemMatch: { maNhanSu, thoiDiemGuiThongBao: { $exists: true } } },
      },
    ],
  };
}

function hienThiLich(ld, maNhanSu, banDo, tenMon, bayGio) {
  const pc = ld.phanCong.find((p) => p.maNhanSu === maNhanSu);
  const lop = banDo.lop.get(ld.maLop);
  const han = hanPhanHoi(pc);
  const choPhanHoi = ld.trangThaiLich === 'ChoGVXacNhan' && pc.trangThaiPhanCong === 'ChoXacNhan' && han > bayGio;
  return {
    ...tomTatBuoi(ld, banDo),
    monHoc: tenMon.get(lop?.maMonHoc),
    vaiTro: pc.vaiTro,
    // Trạng thái lịch hiển thị cho giáo viên: Dự kiến / Chính thức
    loaiLich: ld.trangThaiLich === 'DaPhatHanh' ? 'ChinhThuc' : 'DuKien',
    trangThaiPhanCong: pc.trangThaiPhanCong,
    hanPhanHoi: han || null,
    conLaiGio: choPhanHoi ? Math.max(0, Math.ceil((han - bayGio) / clock.MOT_GIO)) /* làm tròn lên: còn 40 phút hiển thị "Còn 1 giờ", không hiện "Còn 0 giờ" */ : null,
    coThePhanHoi: choPhanHoi,
  };
}

async function tenMonMap() {
  return new Map((await MonHoc.find().lean()).map((m) => [m._id, m.tenMonHoc]));
}

/** UC_7 bước 2–3; luồng 2.a */
async function lichDayCaNhan(maNhanSu, { tuNgay, denNgay } = {}) {
  await capNhatPhanCongHetHan();
  const loc = locLichCuaToi(maNhanSu);
  const tu = tuNgay ? clock.parseNgay(tuNgay) : null;
  const den = denNgay ? clock.parseNgay(denNgay) : null;
  if (tu || den) loc.ngayDay = { ...(tu ? { $gte: tu } : {}), ...(den ? { $lte: den } : {}) };
  const [ds, banDo, tenMon] = await Promise.all([
    LichDay.find(loc, { xacNhanCaHoc: 0, yeuCauNghiHoc: 0, lichSu: 0 }).sort({ ngayDay: 1, maCa: 1 }).lean(),
    layBanDo(),
    tenMonMap(),
  ]);
  const bayGio = clock.now();
  return {
    ds: ds.map((ld) => hienThiLich(ld, maNhanSu, banDo, tenMon, bayGio)),
    thongBao: ds.length ? undefined : M.GV_CHUA_CO_LICH,
  };
}

/** UC_7 bước 5–6; luồng 6.a; ngoại lệ 5.a */
async function chiTietLichDay(maNhanSu, maLichDay) {
  const ld = await LichDay.findOne({ _id: maLichDay, ...locLichCuaToi(maNhanSu) }).lean();
  if (!ld) throw new AppError(404, M.GV_LICH_KHONG_KHA_DUNG);
  const [banDo, tenMon] = await Promise.all([layBanDo(), tenMonMap()]);
  const ten = await layTenNguoiDung(ld.phanCong.map((p) => p.maNhanSu));
  return {
    ...hienThiLich(ld, maNhanSu, banDo, tenMon, clock.now()),
    gioHoc: nhanCa(banDo.ca.get(ld.maCa)),
    nguoiCungDay: ld.phanCong.filter((p) => p.maNhanSu !== maNhanSu).map((p) => ({ hoTen: ten.get(p.maNhanSu)?.hoTen, vaiTro: p.vaiTro })),
  };
}

/** UC_8 bước 2: danh sách ca dạy dự kiến chờ phản hồi (còn trong hạn 24 giờ) */
async function caDuKien(maNhanSu) {
  await capNhatPhanCongHetHan();
  const bayGio = clock.now();
  const moc = new Date(bayGio.getTime() - HAN_PHAN_HOI_GIO * clock.MOT_GIO);
  const [ds, banDo, tenMon] = await Promise.all([
    LichDay.find({
      trangThaiLich: 'ChoGVXacNhan',
      phanCong: { $elemMatch: { maNhanSu, trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: { $gt: moc } } },
    }).sort({ ngayDay: 1, maCa: 1 }).lean(),
    layBanDo(),
    tenMonMap(),
  ]);
  return ds.map((ld) => hienThiLich(ld, maNhanSu, banDo, tenMon, bayGio));
}

/** Các ca còn trống của lớp trong cùng tuần – gợi ý cho trường "Ca dạy đề xuất thay thế" (UC_8 BR02) */
async function caTrongCuaLop(ld, banDo) {
  const dau = clock.dauTuan(ld.ngayDay);
  const cuoi = clock.congNgay(dau, 6);
  const daCo = new Set((await LichDay.find({
    maLop: ld.maLop, ngayDay: { $gte: dau, $lte: cuoi }, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC },
  }, { ngayDay: 1, maCa: 1 }).lean()).map((b) => `${clock.dinhDangNgay(b.ngayDay)}|${b.maCa}`));
  const bayGio = clock.now();
  const ds = [];
  for (let d = dau; d <= cuoi; d = clock.congNgay(d, 1)) {
    for (const ca of banDo.dsCa) {
      if (daCo.has(`${clock.dinhDangNgay(d)}|${ca._id}`)) continue;
      if (clock.thoiDiem(d, ca.gioBatDau) <= bayGio) continue;
      ds.push({ ngayDeXuat: clock.dinhDangNgay(d), maCaDeXuat: ca._id, nhan: `${clock.tenThu(d)} ${clock.nhanNgayNgan(d)} · ${nhanCa(ca)}` });
    }
  }
  return ds;
}

/** UC_8 bước 4 (MH29): chi tiết ca dạy và gửi phản hồi */
async function chiTietCaDuKien(maNhanSu, maLichDay) {
  const ld = await LichDay.findOne({ _id: maLichDay, 'phanCong.maNhanSu': maNhanSu, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } }).lean();
  if (!ld) throw new AppError(404, M.GV_LICH_KHONG_KHA_DUNG);
  const [banDo, tenMon] = await Promise.all([layBanDo(), tenMonMap()]);
  const ct = hienThiLich(ld, maNhanSu, banDo, tenMon, clock.now());
  return {
    ...ct,
    nhanNgay: `${clock.nhanNgayDayDu(ld.ngayDay)} · Tuần ${clock.tuanISO(ld.ngayDay)}`,
    gioHoc: nhanCa(banDo.ca.get(ld.maCa)),
    caThayThe: ct.coThePhanHoi ? await caTrongCuaLop(ld, banDo) : [],
    // BR03: quá 24 giờ (kể cả khi hệ thống đã đánh dấu "HetHan") → khóa phản hồi, báo quá hạn
    quaHan: ct.trangThaiPhanCong === 'HetHan' || (ct.trangThaiPhanCong === 'ChoXacNhan' && !ct.coThePhanHoi),
    thongBao: ct.trangThaiPhanCong === 'HetHan' || (ct.trangThaiPhanCong === 'ChoXacNhan' && !ct.coThePhanHoi) ? M.GV_QUA_HAN : undefined,
  };
}

/** Lý do không phản hồi được (sau khi cập nhật nguyên tử không khớp) */
async function lyDoKhongPhanHoiDuoc(maNhanSu, maLichDay) {
  const ld = await LichDay.findOne({ _id: maLichDay, 'phanCong.maNhanSu': maNhanSu }).lean();
  if (!ld || ld.trangThaiLich === 'DaHuy') return new AppError(404, M.GV_LICH_KHONG_KHA_DUNG);
  const pc = ld.phanCong.find((p) => p.maNhanSu === maNhanSu);
  if (pc.trangThaiPhanCong === 'HetHan' || (pc.trangThaiPhanCong === 'ChoXacNhan' && hanPhanHoi(pc) <= clock.now())) {
    return new AppError(403, M.GV_QUA_HAN); // BR03
  }
  return new AppError(409, 'Ca dạy này đã được phản hồi.'); // [BO SUNG]
}

function locChoPhanHoi(maNhanSu, maLichDay) {
  const moc = new Date(clock.now().getTime() - HAN_PHAN_HOI_GIO * clock.MOT_GIO);
  return {
    _id: maLichDay,
    trangThaiLich: 'ChoGVXacNhan',
    phanCong: { $elemMatch: { maNhanSu, trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: { $gt: moc } } },
  };
}

/** UC_8 bước 5–6: xác nhận duyệt lịch dạy */
async function xacNhanCaDay(user, maLichDay) {
  const banDo = await layBanDo();
  return trongGiaoDich(async (session) => {
    const luc = clock.now();
    const kq = await LichDay.updateOne(
      locChoPhanHoi(user.ma, maLichDay),
      { $set: { 'phanCong.$[pc].trangThaiPhanCong': 'DaXacNhan', 'phanCong.$[pc].thoiDiemPhanHoi': luc } },
      { arrayFilters: [{ 'pc.maNhanSu': user.ma }], session },
    );
    if (kq.modifiedCount !== 1) throw await lyDoKhongPhanHoiDuoc(user.ma, maLichDay);
    const ld = await LichDay.findById(maLichDay).session(session).lean();
    await ghiNhatKy({
      hanhDong: 'PHAN_CONG.GV_XAC_NHAN',
      doiTuong: { loai: 'LichDay', ma: maLichDay },
      truoc: { maNhanSu: user.ma, trangThaiPhanCong: 'ChoXacNhan' },
      sau: { maNhanSu: user.ma, trangThaiPhanCong: 'DaXacNhan' },
    }, session);
    await thongBaoQuanLy({
      loaiThongBao: 'PhanHoiMoi',
      tieuDe: `${user.hoTen} đã xác nhận lịch dạy`,
      noiDung: `${user.hoTen} xác nhận ca dạy lớp ${banDo.lop.get(ld.maLop)?.tenLop} · ${clock.nhanNgayDayDu(ld.ngayDay)} · ${nhanCa(banDo.ca.get(ld.maCa))}.`,
    }, session);
    return { maLichDay, trangThaiPhanCong: 'DaXacNhan' };
  });
}

/** UC_8 luồng 5a: đề xuất thay đổi; ngoại lệ 5a.1.A, 5a.1.B, 5a.1.C, BR02, BR03 */
async function deXuatThayDoi(user, maLichDay, body) {
  const lyDoThayDoi = catChuoi(body.lyDoThayDoi);
  if (!lyDoThayDoi) throw new AppError(400, M.GV_TRONG_LY_DO, { fieldErrors: { lyDoThayDoi: M.GV_TRONG_LY_DO } });
  if (lyDoThayDoi.length > 500) throw new AppError(400, M.GV_LY_DO_VUOT_500, { fieldErrors: { lyDoThayDoi: M.GV_LY_DO_VUOT_500 } });
  const ld = await LichDay.findOne({ _id: maLichDay, 'phanCong.maNhanSu': user.ma }).lean();
  if (!ld || ld.trangThaiLich === 'DaHuy') throw new AppError(404, M.GV_LICH_KHONG_KHA_DUNG);
  const banDo = await layBanDo();
  const phanHoi = { lyDoThayDoi, thoiGianPhanHoi: clock.now(), trangThaiXuLy: 'ChoXuLy' };
  if (!laChuoiRong(body.maCaDeXuat)) {
    const ngayDeXuat = body.ngayDeXuat ? clock.parseNgay(body.ngayDeXuat) : ld.ngayDay;
    if (!banDo.ca.get(body.maCaDeXuat) || !ngayDeXuat) {
      throw new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors: { maCaDeXuat: M.HS_KHONG_HOP_LE } });
    }
    if (ngayDeXuat.getTime() === ld.ngayDay.getTime() && body.maCaDeXuat === ld.maCa) {
      throw new AppError(400, M.GV_TRUNG_CA_HIEN_TAI, { fieldErrors: { maCaDeXuat: M.GV_TRUNG_CA_HIEN_TAI } });
    }
    phanHoi.maCaDeXuat = body.maCaDeXuat;
    phanHoi.ngayDeXuat = ngayDeXuat;
  }
  // Nếu không chọn ca đề xuất: chỉ lưu lý do, Quản lý tự tìm ca thay thế sau (BR02)
  return trongGiaoDich(async (session) => {
    phanHoi.maPhanHoiLichDay = await sinhMa('PL', session);
    const kq = await LichDay.updateOne(
      locChoPhanHoi(user.ma, maLichDay),
      {
        $set: { 'phanCong.$[pc].trangThaiPhanCong': 'DeXuatThayDoi', 'phanCong.$[pc].thoiDiemPhanHoi': phanHoi.thoiGianPhanHoi },
        $push: { 'phanCong.$[pc].phanHoiLichDay': phanHoi },
      },
      { arrayFilters: [{ 'pc.maNhanSu': user.ma }], session },
    );
    if (kq.modifiedCount !== 1) throw await lyDoKhongPhanHoiDuoc(user.ma, maLichDay);
    // UC_8 5a.2: tạo phiếu "Chờ xử lý" trong Phản hồi & yêu cầu của Quản lý (UC_4)
    // Tiêu đề = ca dạy đề xuất thay thế (nhãn giống ô chọn của giáo viên); nội dung chi tiết = lý do thay đổi
    const caDeXuat = phanHoi.maCaDeXuat ? banDo.ca.get(phanHoi.maCaDeXuat) : null;
    const tieuDePhieu = caDeXuat
      ? `${clock.tenThu(phanHoi.ngayDeXuat)} ${clock.nhanNgayNgan(phanHoi.ngayDeXuat)} · ${nhanCa(caDeXuat)}`
      : `Đổi ca dạy ${clock.tenThu(ld.ngayDay)} ${clock.nhanNgayNgan(ld.ngayDay)} · ${banDo.ca.get(ld.maCa)?.tenCa || ''}`.trim(); // không chọn ca thay thế
    const maPhieu = await sinhMa('YC', session);
    await PhanHoiGopY.create([{
      _id: maPhieu, maNhanSu: user.ma, loaiPhanHoi: 'DoiLich', tieuDe: tieuDePhieu, noiDung: lyDoThayDoi,
      maLichDay, maPhanHoiLichDay: phanHoi.maPhanHoiLichDay,
      thoiGianGui: phanHoi.thoiGianPhanHoi, trangThaiXuLy: 'ChoXuLy', tepDinhKem: [],
    }], { session });
    await ghiNhatKy({
      hanhDong: 'PHAN_CONG.GV_DE_XUAT_THAY_DOI',
      doiTuong: { loai: 'LichDay', ma: maLichDay },
      truoc: { maNhanSu: user.ma, trangThaiPhanCong: 'ChoXacNhan' },
      sau: { maNhanSu: user.ma, trangThaiPhanCong: 'DeXuatThayDoi', phanHoiLichDay: phanHoi, maPhieu },
    }, session);
    await thongBaoQuanLy({
      loaiThongBao: 'PhanHoiMoi',
      tieuDe: `${user.hoTen} đề xuất thay đổi lịch dạy`,
      noiDung: `Lớp ${banDo.lop.get(ld.maLop)?.tenLop} · ${clock.nhanNgayDayDu(ld.ngayDay)}: ${lyDoThayDoi}`,
    }, session);
    return { maLichDay, trangThaiPhanCong: 'DeXuatThayDoi', phanHoiLichDay: { ...phanHoi, ngayDeXuat: phanHoi.ngayDeXuat && clock.dinhDangNgay(phanHoi.ngayDeXuat) } };
  });
}

/* ------------------------------------------------------------------ UC_9 */

/** Cổng cập nhật lịch rảnh: mở 08:00 Thứ Hai, đóng 23:59 Thứ Năm hằng tuần (BR03) */
function trangThaiCong() {
  const bayGio = clock.now();
  const vn = new Date(bayGio.getTime() + 7 * clock.MOT_GIO);
  const thu = vn.getUTCDay();
  const phut = vn.getUTCHours() * 60 + vn.getUTCMinutes();
  const dangMo = (thu === 1 && phut >= 8 * 60) || thu === 2 || thu === 3 || thu === 4;
  const dauTuanNay = clock.dauTuan(clock.homNay());
  const tuanKeTiep = clock.congNgay(dauTuanNay, 7);
  return {
    dangMo,
    moLuc: clock.thoiDiem(dauTuanNay, '08:00'),
    dongLuc: new Date(clock.thoiDiem(clock.congNgay(dauTuanNay, 3), '23:59').getTime() + 59 * 1000),
    tuanBatDau: tuanKeTiep,
    tuanKetThuc: clock.congNgay(tuanKeTiep, 6),
  };
}

/** UC_9 bước 2 (MH30): bảng lịch tuần kế tiếp (Thứ Hai → Chủ Nhật × Ca 1–3) */
async function lichRanhTuanToi(maNhanSu) {
  const cong = trangThaiCong();
  const [doc, banDo] = await Promise.all([LichRanh.findOne({ maNhanSu, tuanBatDau: cong.tuanBatDau }).lean(), layBanDo()]);
  const daChon = new Set((doc?.cacRanh || []).map((c) => `${clock.dinhDangNgay(c.ngayRanh)}|${c.maCa}`));
  const cacNgay = Array.from({ length: 7 }, (_, i) => clock.congNgay(cong.tuanBatDau, i));
  return {
    cong: { dangMo: cong.dangMo, moLuc: cong.moLuc, dongLuc: cong.dongLuc },
    tuan: { tuNgay: clock.dinhDangNgay(cong.tuanBatDau), denNgay: clock.dinhDangNgay(cong.tuanKetThuc) },
    cot: cacNgay.map((d) => ({ ngay: clock.dinhDangNgay(d), thu: clock.tenThu(d), nhanNgay: clock.nhanNgayNgan(d) })),
    dong: banDo.dsCa.map((ca) => ({ maCa: ca._id, tenCa: ca.tenCa, gio: `${ca.gioBatDau} – ${ca.gioKetThuc}` })),
    daChon: [...daChon].map((k) => { const [ngayRanh, maCa] = k.split('|'); return { ngayRanh, maCa }; }),
    soCaDaChon: daChon.size,
    toiThieu: SO_CA_RANH_TOI_THIEU,
    thoiDiemCapNhat: doc?.thoiDiemCapNhat || null,
  };
}

/** UC_9 bước 3–7; ngoại lệ 4a, 4b, 5a, 5b */
async function capNhatLichRanh(maNhanSu, body) {
  const cong = trangThaiCong();
  if (!cong.dangMo) throw new AppError(403, M.LR_DONG_CONG); // 4b
  const banDo = await layBanDo();
  const vao = Array.isArray(body.cacRanh) ? body.cacRanh : [];
  const daThay = new Set();
  const cacRanh = [];
  for (const c of vao) {
    const ngay = clock.parseNgay(c.ngayRanh);
    if (!ngay || !banDo.ca.get(c.maCa) || ngay < cong.tuanBatDau || ngay > cong.tuanKetThuc) {
      throw new AppError(400, M.LR_NGOAI_TUAN);
    }
    const k = `${c.ngayRanh}|${c.maCa}`;
    if (!daThay.has(k)) {
      daThay.add(k);
      cacRanh.push({ ngayRanh: ngay, maCa: c.maCa });
    }
  }
  if (!cacRanh.length) throw new AppError(400, M.LR_CHUA_CHON); // 5a
  if (cacRanh.length < SO_CA_RANH_TOI_THIEU) throw new AppError(400, M.LR_CHUA_DU(cacRanh.length)); // 5b, BR02
  try {
    await trongGiaoDich(async (session) => {
      const coSan = await LichRanh.findOne({ maNhanSu, tuanBatDau: cong.tuanBatDau }).session(session).lean();
      // Ghi đè dữ liệu cũ của tuần đó trong một thao tác (bước 6); chỉ mục duy nhất (maNhanSu, tuanBatDau)
      await LichRanh.replaceOne(
        { maNhanSu, tuanBatDau: cong.tuanBatDau },
        {
          _id: coSan?._id || (await sinhMa('LR', session)),
          maNhanSu,
          tuanBatDau: cong.tuanBatDau,
          cacRanh,
          thoiDiemCapNhat: clock.now(),
        },
        { upsert: true, runValidators: true, session },
      );
      const tomTat = (ds) => (ds || []).map((c) => `${clock.dinhDangNgay(c.ngayRanh)}|${c.maCa}`);
      await ghiNhatKy({
        hanhDong: 'LICH_RANH.CAP_NHAT',
        doiTuong: { loai: 'LichRanh', ma: `${maNhanSu}|${clock.dinhDangNgay(cong.tuanBatDau)}` },
        truoc: coSan ? { cacRanh: tomTat(coSan.cacRanh) } : null,
        sau: { cacRanh: tomTat(cacRanh) },
      }, session);
    });
  } catch {
    throw new AppError(500, M.LR_THAT_BAI, { data: { chiTiet: M.LR_THAT_BAI_CHI_TIET } }); // 4a
  }
  return { soCaDaChon: cacRanh.length, tuan: { tuNgay: clock.dinhDangNgay(cong.tuanBatDau), denNgay: clock.dinhDangNgay(cong.tuanKetThuc) } };
}

/* ------------------------------------------------------------------ UC_10 */

/** UC_10 bước 3–8; ngoại lệ 5a, 7a */
async function guiYeuCau(maNhanSu, body) {
  const fieldErrors = {};
  const loaiPhanHoi = catChuoi(body.loaiPhanHoi);
  const tieuDe = catChuoi(body.tieuDe);
  const noiDung = catChuoi(body.noiDung);
  if (!loaiPhanHoi || !E.LOAI_PHAN_HOI_NHAN_SU.includes(loaiPhanHoi)) fieldErrors.loaiPhanHoi = M.PH_KHONG_DUOC_DE_TRONG;
  if (!tieuDe) fieldErrors.tieuDe = M.PH_KHONG_DUOC_DE_TRONG;
  if (!noiDung) fieldErrors.noiDung = M.PH_KHONG_DUOC_DE_TRONG;
  if (Object.keys(fieldErrors).length) throw new AppError(400, M.PH_KHONG_DUOC_DE_TRONG, { fieldErrors });
  if (noiDung.length > 500) throw new AppError(400, M.VUOT_500, { fieldErrors: { noiDung: M.VUOT_500 } }); // BR04
  if (tieuDe.length > 200) throw new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors: { tieuDe: M.HS_KHONG_HOP_LE } });
  try {
    const phieu = await taoPhieu({ maNhanSu, loaiPhanHoi, tieuDe, noiDung });
    return tienDoCongKhai(phieu);
  } catch {
    throw new AppError(500, M.YC_THAT_BAI);
  }
}

/** UC_10 bước 9: "Yêu cầu của tôi" kèm tiến độ xử lý */
async function yeuCauCuaToi(maNhanSu) {
  const ds = await PhanHoiGopY.find({ maNhanSu }).sort({ thoiGianGui: -1 }).lean();
  return ds.map(tienDoCongKhai);
}

/* ------------------------------------------------------------------ MH25 */

/** Trang chủ Giáo viên / Trợ giảng */
async function tongQuan(maNhanSu) {
  await capNhatPhanCongHetHan();
  const homNay = clock.homNay();
  const dau = clock.dauTuan(homNay);
  const [tuanNay, choXacNhan, yeuCau, lichRanh] = await Promise.all([
    lichDayCaNhan(maNhanSu, { tuNgay: clock.dinhDangNgay(dau), denNgay: clock.dinhDangNgay(clock.congNgay(dau, 6)) }),
    caDuKien(maNhanSu),
    PhanHoiGopY.countDocuments({ maNhanSu, trangThaiXuLy: { $in: ['ChoXuLy', 'DangXuLy'] } }),
    lichRanhTuanToi(maNhanSu),
  ]);
  const ngayHomNay = clock.dinhDangNgay(homNay);
  return {
    homNay: clock.nhanNgayDayDu(homNay),
    caDayTuanNay: tuanNay.ds.filter((l) => l.loaiLich === 'ChinhThuc').length,
    caChoXacNhan: choXacNhan.length,
    yeuCauDangXuLy: yeuCau,
    congLichRanh: lichRanh.cong.dangMo
      ? { dangMo: true, tuan: lichRanh.tuan, dongLuc: lichRanh.cong.dongLuc, soCaDaDangKy: lichRanh.soCaDaChon, toiThieu: SO_CA_RANH_TOI_THIEU }
      : { dangMo: false },
    lichDayHomNay: tuanNay.ds.filter((l) => l.ngayDay === ngayHomNay && l.loaiLich === 'ChinhThuc'),
    dsCaChoXacNhan: choXacNhan.slice(0, 5),
  };
}

module.exports = {
  capNhatPhanCongHetHan,
  lichDayCaNhan,
  chiTietLichDay,
  caDuKien,
  chiTietCaDuKien,
  xacNhanCaDay,
  deXuatThayDoi,
  trangThaiCong,
  lichRanhTuanToi,
  capNhatLichRanh,
  guiYeuCau,
  yeuCauCuaToi,
  tongQuan,
};
