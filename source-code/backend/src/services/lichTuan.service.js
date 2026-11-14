/**
 * UC_6.2 – Lập và cập nhật lịch dạy hằng tuần (Quản lý).
 * - Truy xuất thay đổi lịch bận giáo viên (lịch rảnh tuần tới, trùng lịch) và lịch phòng học (đăng ký phòng).
 * - Chỉ xử lý tuần tới; thay đổi của các tuần sau chỉ được đếm và giữ lại (BR01).
 * - Chỉ thay đổi các buổi bị ảnh hưởng, buổi còn lại giữ lịch cố định (BR02).
 * - Hệ thống chỉ đề xuất; Quản lý quyết định giáo viên và phòng (BR05). Không xác nhận khi còn xung đột (BR06).
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const clock = require('../utils/clock');
const { sinhNhieuMa } = require('../utils/sinhMa');
const { trongGiaoDichCoKhoa, khoa: khoaTN } = require('../utils/giaoDich');
const { ghiNhatKy, anhBuoi } = require('../utils/nhatKy');
const { LichDay, LopHoc, DangKyPhong } = require('../models');
const { layBanDo, layTenNguoiDung, nhanCa } = require('./danhMuc.service');
const khaDung = require('./khaDung.service');
const { guiThongBao } = require('./thongBao.service');

const SO_TUAN_SAU_THEO_DOI = 8;

function tuanToi() {
  const tuNgay = clock.congNgay(clock.dauTuan(clock.homNay()), 7);
  return { tuNgay, denNgay: clock.congNgay(tuNgay, 6) };
}

/** Lý do một buổi đã phát hành bị ảnh hưởng */
async function timBuoiBiAnhHuong(dsBuoi, banDo, ten) {
  if (!dsBuoi.length) return [];
  const ts = dsBuoi.map((b) => b.ngayDay.getTime());
  const tuNgay = new Date(Math.min(...ts));
  const denNgay = new Date(Math.max(...ts));
  const nhanSu = [...new Set(dsBuoi.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)))];
  const [mau, dangKy, cd] = await Promise.all([
    khaDung.taiMauRanh(nhanSu),
    DangKyPhong.find({ ngaySuDung: { $gte: tuNgay, $lte: denNgay }, trangThaiDangKy: 'DaDangKy' }).lean(),
    khaDung.taiChiemDung({ tuNgay, denNgay, boQuaLichDay: dsBuoi.map((b) => b._id) }),
  ]);
  const phongDangKy = new Set(dangKy.map((d) => khaDung.khoa(d.maPhong, d.ngaySuDung, d.maCa)));
  const ketQua = [];
  for (const b of dsBuoi) {
    const lyDo = [];
    const loaiAnhHuong = new Set();
    for (const p of b.phanCong) {
      const hoTen = ten.get(p.maNhanSu)?.hoTen;
      const nhan = p.vaiTro === 'GiaoVien' ? 'GV' : 'TG';
      // Lịch rảnh tuần đó đã đăng ký mà không có ca này → bận
      if (khaDung.coRanh(mau.get(p.maNhanSu), b.ngayDay, b.maCa, { nghiemNgat: false }) === false) {
        lyDo.push(`${nhan} ${hoTen} bận`);
        loaiAnhHuong.add(p.vaiTro);
      } else if (cd.nhanSu.has(khaDung.khoa(p.maNhanSu, b.ngayDay, b.maCa))) {
        lyDo.push(`${nhan} ${hoTen} trùng lịch dạy`);
        loaiAnhHuong.add(p.vaiTro);
      }
    }
    if (phongDangKy.has(khaDung.khoa(b.maPhong, b.ngayDay, b.maCa))) {
      lyDo.push(`${banDo.phong.get(b.maPhong)?.tenPhong} đã được đăng ký sử dụng`);
      loaiAnhHuong.add('Phong');
    }
    if (lyDo.length) ketQua.push({ buoi: b, lyDo, loaiAnhHuong });
  }
  return ketQua;
}

/** UC_6.2 bước 1–6 (MH22): lịch tuần tới kèm đề xuất; luồng 4a, 5a */
async function layLichTuanToi() {
  const { tuNgay, denNgay } = tuanToi();
  const banDo = await layBanDo();
  const dsTuanToi = await LichDay.find({ ngayDay: { $gte: tuNgay, $lte: denNgay }, trangThaiLich: 'DaPhatHanh' }).sort({ ngayDay: 1, maCa: 1 }).lean();
  const dsTuanSau = await LichDay.find({
    ngayDay: { $gt: denNgay, $lte: clock.congNgay(denNgay, 7 * SO_TUAN_SAU_THEO_DOI) },
    trangThaiLich: 'DaPhatHanh',
  }).lean();
  const ten = await layTenNguoiDung([...dsTuanToi, ...dsTuanSau].flatMap((b) => b.phanCong.map((p) => p.maNhanSu)));
  const [anhHuong, anhHuongSau] = await Promise.all([
    timBuoiBiAnhHuong(dsTuanToi, banDo, ten),
    timBuoiBiAnhHuong(dsTuanSau, banDo, ten),
  ]);
  const tuan = { tuNgay: clock.dinhDangNgay(tuNgay), denNgay: clock.dinhDangNgay(denNgay), soTuan: clock.tuanISO(tuNgay) };
  if (!anhHuong.length) {
    return { tuan, buoiBiAnhHuong: [], soBuoiGiuCoDinh: dsTuanToi.length, soThayDoiTuanSau: anhHuongSau.length, thongBao: M.LT_KHONG_THAY_DOI };
  }
  const dsLop = new Map((await LopHoc.find({ _id: { $in: anhHuong.map((a) => a.buoi.maLop) } }).lean()).map((l) => [l._id, l]));
  const buoiBiAnhHuong = [];
  for (const { buoi: b, lyDo, loaiAnhHuong } of anhHuong) {
    const lop = dsLop.get(b.maLop);
    const deXuat = {};
    for (const vaiTro of ['GiaoVien', 'TroGiang']) {
      if (!loaiAnhHuong.has(vaiTro)) continue;
      const ds = await khaDung.timNhanSuPhuHop({ maMonHoc: lop.maMonHoc, vaiTro, dsBuoi: [b], maLop: b.maLop, boQuaLichDay: [b._id] });
      deXuat[vaiTro === 'GiaoVien' ? 'giaoVien' : 'troGiang'] = ds.slice(0, 5).map((d) => ({ maNhanSu: d.maNhanSu, hoTen: d.hoTen }));
    }
    if (loaiAnhHuong.has('Phong')) {
      const cd = await khaDung.taiChiemDung({ tuNgay: b.ngayDay, denNgay: b.ngayDay, boQuaLichDay: [b._id] });
      deXuat.phong = banDo.dsPhong
        .filter((p) => p._id !== b.maPhong && p.sucChua >= lop.soLuongHocVien && !cd.phong.has(khaDung.khoa(p._id, b.ngayDay, b.maCa)))
        .slice(0, 5)
        .map((p) => ({ maPhong: p._id, tenPhong: p.tenPhong }));
    }
    const chuaCoDeXuat = Object.values(deXuat).some((ds) => !ds.length); // luồng 5a
    buoiBiAnhHuong.push({
      maLichDay: b._id,
      maLop: b.maLop,
      tenLop: lop.tenLop,
      ngayDay: clock.dinhDangNgay(b.ngayDay),
      nhanBuoi: `${clock.tenThu(b.ngayDay)} ${clock.nhanNgayNgan(b.ngayDay)} · ${banDo.ca.get(b.maCa)?.tenCa}`,
      maCa: b.maCa,
      lyDo,
      giaoVienHienTai: b.phanCong.map((p) => ({ maNhanSu: p.maNhanSu, hoTen: ten.get(p.maNhanSu)?.hoTen, vaiTro: p.vaiTro })),
      phongHienTai: { maPhong: b.maPhong, tenPhong: banDo.phong.get(b.maPhong)?.tenPhong },
      deXuat,
      chuaCoDeXuat,
    });
  }
  return {
    tuan,
    buoiBiAnhHuong,
    soBuoiGiuCoDinh: dsTuanToi.length - anhHuong.length,
    soThayDoiTuanSau: anhHuongSau.length,
  };
}

/**
 * Dựng cấu hình mới của các buổi và kiểm tra xung đột (BR03, BR04, BR06).
 * Chạy hai lần: kiểm tra nhanh ngoài giao dịch (báo lỗi sớm, xác định tài nguyên cần khóa)
 * và kiểm tra chốt bên trong giao dịch đã khóa (dữ liệu mới nhất, chống xếp trùng đồng thời).
 */
async function lapKeHoach({ thayDoi, buoiBu, tuNgay, denNgay }, session) {
  const banDo = await layBanDo();
  const trongTuan = (d) => d && d >= tuNgay && d <= denNgay;

  // 1. Dựng cấu hình mới của các buổi
  const goc = await LichDay.find({ _id: { $in: thayDoi.map((t) => String(t?.maLichDay)) } }).session(session || null).lean();
  const gocMap = new Map(goc.map((g) => [g._id, g]));
  const loi = [];
  const ketQuaDuKien = [];
  for (const t of thayDoi) {
    const g = gocMap.get(t.maLichDay);
    if (!g || g.trangThaiLich !== 'DaPhatHanh' || !trongTuan(g.ngayDay)) {
      loi.push(`Buổi ${t.maLichDay} không thuộc lịch đã phát hành của tuần tới`);
      continue;
    }
    if (t.huyBuoi) {
      ketQuaDuKien.push({ goc: g, huy: true });
      continue;
    }
    const ngayMoi = t.ngayDay ? clock.parseNgay(t.ngayDay) : g.ngayDay;
    if (!trongTuan(ngayMoi)) loi.push(`Buổi ${t.maLichDay}: ngày mới phải thuộc tuần tới`);
    const phanCongMoi = g.phanCong.map((p) => ({ ...p }));
    for (const [vaiTro, maMoi] of [['GiaoVien', t.maGiaoVien], ['TroGiang', t.maTroGiang]]) {
      if (!maMoi) continue;
      const cu = phanCongMoi.findIndex((p) => p.vaiTro === vaiTro);
      if (cu >= 0) phanCongMoi.splice(cu, 1);
      phanCongMoi.push({ maNhanSu: maMoi, vaiTro, moi: true });
    }
    ketQuaDuKien.push({
      goc: g,
      moi: { _id: g._id, maLop: g.maLop, maPhong: t.maPhong || g.maPhong, maCa: t.maCa || g.maCa, ngayDay: ngayMoi, phanCong: phanCongMoi },
    });
  }
  for (const [i, bu] of buoiBu.entries()) {
    const ngay = clock.parseNgay(bu.ngayDay);
    if (!bu.maLop || !bu.maCa || !bu.maPhong || !bu.maGiaoVien || !trongTuan(ngay)) {
      loi.push(`Buổi bù thứ ${i + 1} thiếu thông tin hoặc không thuộc tuần tới`);
      continue;
    }
    const pcs = [{ maNhanSu: bu.maGiaoVien, vaiTro: 'GiaoVien', moi: true }];
    if (bu.maTroGiang) pcs.push({ maNhanSu: bu.maTroGiang, vaiTro: 'TroGiang', moi: true });
    ketQuaDuKien.push({ buoiBu: true, moi: { maLop: bu.maLop, maPhong: bu.maPhong, maCa: bu.maCa, ngayDay: ngay, phanCong: pcs, soTiet: Number(bu.soTiet) || 3 } });
  }
  if (loi.length) throw new AppError(400, M.LT_XUNG_DOT, { data: { loi } });

  // 2. Kiểm tra xung đột (BR03, BR04, BR06): trùng giáo viên, trùng phòng, sai lịch rảnh, trùng lớp
  const conHieuLuc = ketQuaDuKien.filter((k) => !k.huy).map((k) => k.moi);
  const xungDot = await khaDung.kiemTraXungDot(conHieuLuc, banDo, session);
  const cd = await khaDung.taiChiemDung({ tuNgay, denNgay, boQuaLichDay: conHieuLuc.map((b) => b._id).filter(Boolean) }, session);
  const trungLop = conHieuLuc.filter((b) => cd.lop.has(khaDung.khoa(b.maLop, b.ngayDay, b.maCa)));
  const ten = await layTenNguoiDung(conHieuLuc.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)));
  // Nhân sự mới phải đúng loại và đúng chuyên môn
  const saiChuyenMon = [];
  for (const b of conHieuLuc) {
    const lop = banDo.lop.get(b.maLop);
    for (const p of b.phanCong.filter((x) => x.moi)) {
      const nd = ten.get(p.maNhanSu);
      if (!nd || nd.loaiNhanSu !== p.vaiTro || (p.vaiTro === 'GiaoVien' && !(nd.chuyenMon || []).includes(lop?.maMonHoc))) {
        saiChuyenMon.push(`${nd?.hoTen || p.maNhanSu} không phù hợp với lớp ${lop?.tenLop}`);
      }
    }
  }
  if (khaDung.coXungDot(xungDot) || trungLop.length || saiChuyenMon.length) {
    const chiTiet = [
      ...xungDot.trungGiaoVien.map((x) => `${x.hoTen} đã có lịch dạy ${x.voiLop || ''} ${x.moTa.split(' · ').slice(1).join(' · ')}`.replace(/\s+/g, ' ').trim()),
      ...xungDot.trungPhong.map((x) => `${x.moTa} đã có lớp hoặc đăng ký sử dụng`),
      ...xungDot.saiLichRanh.map((x) => `${x.moTa} không có trong lịch rảnh`),
      ...trungLop.map((b) => `Lớp ${banDo.lop.get(b.maLop)?.tenLop} đã có buổi học ${clock.nhanNgayDayDu(b.ngayDay)}`),
      ...saiChuyenMon,
    ];
    throw new AppError(409, M.LT_XUNG_DOT, { data: { xungDot, chiTiet } }); // 10a
  }
  return { ketQuaDuKien, banDo };
}

/** Tài nguyên cần khóa khi ghi: phòng, lớp, nhân sự của mọi buổi bị thay đổi / thêm */
function khoaCuaKeHoach(ketQuaDuKien) {
  const ds = [];
  for (const k of ketQuaDuKien) {
    for (const b of [k.goc, k.moi].filter(Boolean)) {
      ds.push(khoaTN.phong(b.maPhong), khoaTN.lop(b.maLop), ...(b.phanCong || []).map((p) => khoaTN.nhanSu(p.maNhanSu)));
    }
  }
  return ds;
}

/**
 * UC_6.2 bước 7–12: xác nhận lịch tuần (chọn giáo viên, phòng; chỉnh sửa đặc biệt: đổi ca, hủy buổi, thêm buổi bù).
 * body.thayDoi: [{ maLichDay, maGiaoVien?, maTroGiang?, maPhong?, maCa?, ngayDay?, huyBuoi? }]
 * body.buoiBu:  [{ maLop, ngayDay, maCa, maPhong, maGiaoVien, maTroGiang?, soTiet }]
 * Ngoại lệ 10a: lịch tuần bị xung đột (BR06).
 */
async function xacNhanLichTuan(body, maQuanLy) {
  const { tuNgay, denNgay } = tuanToi();
  const thayDoi = Array.isArray(body.thayDoi) ? body.thayDoi : [];
  const buoiBu = Array.isArray(body.buoiBu) ? body.buoiBu : [];
  if (!thayDoi.length && !buoiBu.length) throw new AppError(400, M.LT_KHONG_THAY_DOI);
  if ([...thayDoi, ...buoiBu].some((x) => !x || typeof x !== 'object' || Array.isArray(x))) throw new AppError(400, M.HS_KHONG_HOP_LE);
  const soBo = await lapKeHoach({ thayDoi, buoiBu, tuNgay, denNgay });
  return trongGiaoDichCoKhoa(khoaCuaKeHoach(soBo.ketQuaDuKien), async (session) => {
    const { ketQuaDuKien, banDo } = await lapKeHoach({ thayDoi, buoiBu, tuNgay, denNgay }, session);
    const luc = clock.now();
    const nhatKy = [];
    const nhanSuThayDoi = new Map();
    let soCapNhat = 0;
    let soHuy = 0;
    let soBuoiBu = 0;
    for (const k of ketQuaDuKien) {
      if (k.buoiBu) continue;
      const doc = await LichDay.findOne({ _id: k.goc._id, trangThaiLich: 'DaPhatHanh' }).session(session);
      if (!doc) throw new AppError(409, M.LT_XUNG_DOT);
      const [maLS] = await sinhNhieuMa('LS', 1, session);
      if (k.huy) {
        doc.trangThaiLich = 'DaHuy';
        doc.lichSu.push({ maLichSuLich: maLS, maQuanLy, hanhDong: 'Huy', thoiDiem: luc, ghiChu: 'Hủy buổi khi lập lịch tuần' });
        for (const p of doc.phanCong) nhanSuThayDoi.set(p.maNhanSu, doc);
        soHuy += 1;
        nhatKy.push({ hanhDong: 'LICH_DAY.HUY', ma: doc._id, truoc: anhBuoi(k.goc), sau: anhBuoi(doc) });
      } else {
        const moiPC = k.moi.phanCong.filter((p) => p.moi);
        const maPC = await sinhNhieuMa('PC', moiPC.length, session);
        doc.maPhong = k.moi.maPhong;
        doc.maCa = k.moi.maCa;
        doc.ngayDay = k.moi.ngayDay;
        doc.phanCong = k.moi.phanCong.map((p) => (p.moi
          ? { maPhanCong: maPC.shift(), maNhanSu: p.maNhanSu, vaiTro: p.vaiTro, trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: luc }
          : { ...p, trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: luc, thoiDiemPhanHoi: undefined }));
        doc.trangThaiLich = 'ChoGVXacNhan';
        doc.thoiDiemGuiDuKien = luc;
        doc.lichSu.push({ maLichSuLich: maLS, maQuanLy, hanhDong: 'CapNhat', thoiDiem: luc, ghiChu: 'Cập nhật lịch tuần' });
        for (const p of doc.phanCong) nhanSuThayDoi.set(p.maNhanSu, doc);
        soCapNhat += 1;
        nhatKy.push({ hanhDong: 'LICH_DAY.CAP_NHAT', ma: doc._id, truoc: anhBuoi(k.goc), sau: anhBuoi(doc) });
      }
      doc.thoiDiemCapNhat = luc;
      await doc.save({ session });
    }
    for (const k of ketQuaDuKien.filter((x) => x.buoiBu)) {
      const [[maLD], [maLS], maPC] = await Promise.all([
        sinhNhieuMa('LD', 1, session), sinhNhieuMa('LS', 1, session), sinhNhieuMa('PC', k.moi.phanCong.length, session),
      ]);
      const [doc] = await LichDay.create([{
        _id: maLD,
        maLop: k.moi.maLop,
        maPhong: k.moi.maPhong,
        maCa: k.moi.maCa,
        maQuanLy,
        ngayDay: k.moi.ngayDay,
        soTiet: k.moi.soTiet,
        trangThaiLich: 'ChoGVXacNhan',
        thoiDiemTao: luc,
        thoiDiemGuiDuKien: luc,
        phanCong: k.moi.phanCong.map((p, i) => ({ maPhanCong: maPC[i], maNhanSu: p.maNhanSu, vaiTro: p.vaiTro, trangThaiPhanCong: 'ChoXacNhan', thoiDiemGuiThongBao: luc })),
        lichSu: [{ maLichSuLich: maLS, maQuanLy, hanhDong: 'Tao', thoiDiem: luc, ghiChu: 'Buổi bù' }],
      }], { session });
      for (const p of doc.phanCong) nhanSuThayDoi.set(p.maNhanSu, doc);
      soBuoiBu += 1;
      nhatKy.push({ hanhDong: 'LICH_DAY.TAO', ma: doc._id, truoc: null, sau: anhBuoi(doc), moTa: 'Thêm buổi bù khi lập lịch tuần' });
    }
    await guiThongBao([...nhanSuThayDoi.entries()].map(([ma, doc]) => ({
      maNguoiNhan: ma,
      loaiThongBao: 'ThayDoiLich',
      tieuDe: `Thay đổi lịch dạy tuần ${clock.nhanNgayNgan(tuNgay)} – ${clock.nhanNgayNgan(denNgay)}`,
      noiDung: `Lịch dạy lớp ${banDo.lop.get(doc.maLop)?.tenLop} (${clock.nhanNgayDayDu(doc.ngayDay)} · ${nhanCa(banDo.ca.get(doc.maCa))}) có thay đổi. Vui lòng kiểm tra và phản hồi trong 24 giờ.`,
    })), session);
    for (const n of nhatKy) {
      await ghiNhatKy({ hanhDong: n.hanhDong, doiTuong: { loai: 'LichDay', ma: n.ma }, moTa: n.moTa || 'Lập lịch tuần tới', truoc: n.truoc, sau: n.sau }, session);
    }
    return { tuan: { tuNgay: clock.dinhDangNgay(tuNgay), denNgay: clock.dinhDangNgay(denNgay) }, soCapNhat, soHuy, soBuoiBu, soNhanSuDuocThongBao: nhanSuThayDoi.size, trangThaiLich: 'ChoGVXacNhan' };
  });
}

module.exports = { layLichTuanToi, xacNhanLichTuan, tuanToi };
