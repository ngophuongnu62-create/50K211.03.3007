/**
 * UC_6 – Quản lý lịch dạy (Quản lý): 6.1 Tạo lịch dạy mới, 6.3 Phân công, 6.4 Phê duyệt và phát hành.
 * (6.2 Lập và cập nhật lịch dạy hằng tuần: xem lichTuan.service.js)
 *
 * Màn hình MH19 hiển thị "một lịch" là nhóm các buổi của cùng một lớp có cùng trạng thái
 * (ví dụ "IELTS 6.5 – K12 · Thứ 3, 5 · Ca 3 · P.201 · Nháp"). Các thao tác 6.3, 6.4 áp dụng cho cả nhóm.
 * Vòng đời: Nhap → ChoGVXacNhan → DaDuyet → DaPhatHanh.
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { sinhNhieuMa } = require('../utils/sinhMa');
const { trongGiaoDich, trongGiaoDichCoKhoa, khoa: khoaTN } = require('../utils/giaoDich');
const { ghiNhatKy, anhBuoi } = require('../utils/nhatKy');
const { LichDay, LopHoc, KhoaHoc, NguoiDung, NhanSuGiangDay, PhuHuynhHocVien, MonHoc, PhanHoiGopY } = require('../models');
const { layBanDo, layTenNguoiDung, moTaLichHoc, nhanCa, tomTatBuoi } = require('./danhMuc.service');
const khaDung = require('./khaDung.service');
const { guiThongBao } = require('./thongBao.service');

const HANH_DONG_THEO_TRANG_THAI = {
  Nhap: 'PhanCong',
  ChoGVXacNhan: 'PheDuyetVaPhatHanh',
  DaDuyet: 'PhatHanh',
  DaPhatHanh: 'Xem',
};

/** Các mẫu ngày học trong tuần dùng để đề xuất (0 = CN, 1 = Thứ Hai ... 6 = Thứ Bảy) */
const MAU_NGAY_HOC = [[2, 4], [1, 3], [6, 0], [3, 5], [1, 3, 5], [2, 4, 6]];
const SO_PHUONG_AN_TOI_DA = 3;

const soNguyenDuong = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Các buổi của một lớp theo trạng thái (một "lịch" trên MH19) */
async function layNhomBuoi(maLop, dsTrangThai, session) {
  return LichDay.find({ maLop, trangThaiLich: { $in: dsTrangThai } }).sort({ ngayDay: 1, maCa: 1 }).session(session || null);
}

function nhanLichDayDu(dsBuoi, banDo) {
  if (!dsBuoi.length) return '';
  const ca = banDo.ca.get(dsBuoi[0].maCa);
  const thu = clock.chuoiThu(dsBuoi.map((b) => clock.thuTrongTuan(b.ngayDay)));
  const phong = [...new Set(dsBuoi.map((b) => banDo.phong.get(b.maPhong)?.tenPhong))].join(', ');
  return `${thu} · ${ca.tenCa} (${ca.gioBatDau} – ${ca.gioKetThuc}) · ${phong}`;
}

/* ------------------------------------------------------------------ MH19 */

/** MH19 – danh sách lịch theo vòng đời, có đếm cho từng tab */
async function danhSachLich({ trangThai }) {
  const loc = { trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } };
  const [dsBuoi, banDo] = await Promise.all([
    LichDay.find(loc, { maLop: 1, trangThaiLich: 1, ngayDay: 1, maCa: 1, maPhong: 1, phanCong: 1 }).sort({ ngayDay: 1 }).lean(),
    layBanDo(),
  ]);
  const nhom = new Map();
  for (const b of dsBuoi) {
    const k = `${b.maLop}|${b.trangThaiLich}`;
    if (!nhom.has(k)) nhom.set(k, []);
    nhom.get(k).push(b);
  }
  const ten = await layTenNguoiDung(dsBuoi.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)));
  const dem = { TatCa: nhom.size, Nhap: 0, ChoGVXacNhan: 0, DaDuyet: 0, DaPhatHanh: 0 };
  const ds = [];
  for (const [k, buoi] of nhom) {
    const [maLop, trangThaiLich] = k.split('|');
    dem[trangThaiLich] += 1;
    if (trangThai && trangThai !== trangThaiLich) continue;
    const gv = [...new Set(buoi.flatMap((b) => b.phanCong.filter((p) => p.vaiTro === 'GiaoVien').map((p) => p.maNhanSu)))];
    ds.push({
      maLop,
      tenLop: banDo.lop.get(maLop)?.tenLop,
      lichHoc: moTaLichHoc(buoi, banDo),
      giaoVien: gv.length ? gv.map((m) => ten.get(m)?.hoTen).join(', ') : '–',
      trangThaiLich,
      soBuoi: buoi.length,
      tuNgay: clock.dinhDangNgay(buoi[0].ngayDay),
      denNgay: clock.dinhDangNgay(buoi[buoi.length - 1].ngayDay),
      hanhDong: HANH_DONG_THEO_TRANG_THAI[trangThaiLich],
    });
  }
  const thuTu = { Nhap: 0, ChoGVXacNhan: 1, DaDuyet: 2, DaPhatHanh: 3 };
  ds.sort((a, b) => thuTu[a.trangThaiLich] - thuTu[b.trangThaiLich] || a.tuNgay.localeCompare(b.tuNgay));
  return { dem, ds };
}

/* ------------------------------------------------------------------ UC_6.1 */

/** MH20 – các lớp chưa có lịch (danh sách thả xuống "Lớp học") */
async function lopChuaCoLich() {
  const coLich = await LichDay.distinct('maLop', { trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } });
  const dsLop = await LopHoc.find({ _id: { $nin: coLich }, trangThaiLop: { $ne: 'KetThuc' } }).sort({ tenLop: 1 }).lean();
  const khoa = new Map((await KhoaHoc.find({ _id: { $in: dsLop.map((l) => l.maKhoaHoc) } }).lean()).map((k) => [k._id, k]));
  return dsLop.map((l) => ({
    maLop: l._id,
    tenLop: l.tenLop,
    loaiLop: l.loaiLop,
    khoaHoc: {
      maKhoaHoc: l.maKhoaHoc,
      tenKhoaHoc: khoa.get(l.maKhoaHoc)?.tenKhoaHoc,
      ngayBatDau: khoa.get(l.maKhoaHoc) && clock.dinhDangNgay(khoa.get(l.maKhoaHoc).ngayBatDau),
      ngayKetThuc: khoa.get(l.maKhoaHoc) && clock.dinhDangNgay(khoa.get(l.maKhoaHoc).ngayKetThuc),
    },
    tongSoTiet: l.tongSoTiet,
    soLuongHocVien: l.soLuongHocVien,
  }));
}

/** Sinh danh sách ngày học từ ngày bắt đầu theo các thứ trong tuần, đủ số buổi */
function sinhNgayHoc(tuNgay, dsThu, soBuoi) {
  const ds = [];
  for (let d = tuNgay, dem = 0; ds.length < soBuoi && dem < 1200; d = clock.congNgay(d, 1), dem += 1) {
    if (dsThu.includes(clock.thuTrongTuan(d))) ds.push(d);
  }
  return ds;
}

/** Đọc thông tin lớp và tham số đề xuất (MH20) */
async function docThamSoTaoLich(body) {
  if (!body.maLop) throw new AppError(400, M.TL_CHUA_CHON_LOP, { fieldErrors: { maLop: M.TL_CHUA_CHON_LOP } }); // 3.a
  const lop = await LopHoc.findById(body.maLop).lean();
  if (!lop) throw new AppError(400, M.TL_CHUA_CHON_LOP, { fieldErrors: { maLop: M.TL_CHUA_CHON_LOP } });
  const khoa = await KhoaHoc.findById(lop.maKhoaHoc).lean();
  const ngayMai = clock.congNgay(clock.homNay(), 1);
  let tuNgay = body.tuNgay ? clock.parseNgay(body.tuNgay) : khoa?.ngayBatDau;
  const denNgay = body.denNgay ? clock.parseNgay(body.denNgay) : khoa?.ngayKetThuc;
  if (!tuNgay || !denNgay || tuNgay > denNgay) {
    throw new AppError(400, M.TC_NGAY_KHONG_HOP_LE, { fieldErrors: { khoangThoiGian: M.TC_NGAY_KHONG_HOP_LE } });
  }
  if (tuNgay < ngayMai) tuNgay = ngayMai; // lịch mới chỉ xếp từ ngày mai
  const tongSoTiet = soNguyenDuong(body.tongSoTiet) || lop.tongSoTiet;
  const soLuongHocVien = body.soLuongHocVien !== undefined && body.soLuongHocVien !== '' ? Number(body.soLuongHocVien) : lop.soLuongHocVien;
  const soTietMoiBuoi = soNguyenDuong(body.soTietMoiBuoi) || 3;
  return { lop, tuNgay, denNgay, tongSoTiet, soLuongHocVien, soTietMoiBuoi, soBuoi: Math.ceil(tongSoTiet / soTietMoiBuoi) };
}

function dinhDangPhuongAn(pa, banDo, ten) {
  const ca = banDo.ca.get(pa.maCa);
  const phong = banDo.phong.get(pa.maPhong);
  return {
    thu: pa.thu,
    nhanThu: clock.chuoiThu(pa.thu),
    maCa: pa.maCa,
    gioHoc: nhanCa(ca),
    maPhong: pa.maPhong,
    tenPhong: phong?.tenPhong,
    soBuoi: pa.cacNgay.length,
    soTietMoiBuoi: pa.soTietMoiBuoi,
    tongSoTiet: pa.tongSoTiet,
    soTuan: Math.ceil((pa.cacNgay[pa.cacNgay.length - 1] - clock.dauTuan(pa.cacNgay[0])) / (7 * clock.MOT_NGAY)),
    tuNgay: clock.dinhDangNgay(pa.cacNgay[0]),
    denNgay: clock.dinhDangNgay(pa.cacNgay[pa.cacNgay.length - 1]),
    cacNgay: pa.cacNgay.map(clock.dinhDangNgay),
    giaoVienPhuHop: pa.giaoVien.map((m) => ({ maNhanSu: m, hoTen: ten.get(m)?.hoTen })),
  };
}

/**
 * Kiểm tra một phương án: phòng trống, lớp không trùng, sức chứa đủ, có giáo viên đúng chuyên môn rảnh (BR01).
 * Trả về danh sách giáo viên phù hợp, hoặc null kèm lý do.
 */
function danhGiaPhuongAn({ cacNgay, maCa, maPhong, maLop }, ctx) {
  const lyDo = [];
  const phong = ctx.banDo.phong.get(maPhong);
  if (!phong) lyDo.push('Phòng học không tồn tại');
  else if (phong.sucChua < ctx.soLuongHocVien) lyDo.push(`${phong.tenPhong} không đủ sức chứa`);
  for (const d of cacNgay) {
    if (ctx.cd.phong.has(khaDung.khoa(maPhong, d, maCa))) lyDo.push(`${phong?.tenPhong || maPhong} bận ${clock.nhanNgayDayDu(d)}`);
    if (ctx.cd.lop.has(khaDung.khoa(maLop, d, maCa))) lyDo.push(`Lớp đã có buổi học ${clock.nhanNgayDayDu(d)}`);
  }
  const giaoVien = ctx.dsGiaoVien
    .filter((gv) => cacNgay.every((d) => khaDung.coRanh(ctx.mau.get(gv._id), d, maCa) && !ctx.cd.nhanSu.has(khaDung.khoa(gv._id, d, maCa))))
    .sort((a, b) => b.kinhNghiem - a.kinhNghiem)
    .map((gv) => gv._id);
  if (!giaoVien.length) lyDo.push('Không có giáo viên đúng chuyên môn rảnh vào thời gian này');
  return { hopLe: lyDo.length === 0, lyDo: [...new Set(lyDo)], giaoVien };
}

async function taoNguCanh(ts) {
  const [banDo, dsGiaoVien] = await Promise.all([
    layBanDo(),
    NhanSuGiangDay.find({ loaiNhanSu: 'GiaoVien', trangThaiTaiKhoan: 'HoatDong', chuyenMon: ts.lop.maMonHoc }).lean(),
  ]);
  const [cd, mau] = await Promise.all([
    khaDung.taiChiemDung({ tuNgay: ts.tuNgay, denNgay: clock.congNgay(ts.denNgay, 400) }),
    khaDung.taiMauRanh(dsGiaoVien.map((g) => g._id)),
  ]);
  return { banDo, dsGiaoVien, cd, mau, soLuongHocVien: ts.soLuongHocVien };
}

/** UC_6.1 bước 4–6: đề xuất phương án (ngày học, giờ học, phòng học, số tiết); ngoại lệ 3.a, 5.a */
async function deXuatLich(body) {
  const ts = await docThamSoTaoLich(body);
  if (await LichDay.exists({ maLop: ts.lop._id, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } })) {
    throw new AppError(409, M.TL_LOP_DA_CO_LICH);
  }
  const ctx = await taoNguCanh(ts);
  const dsCa = [...ctx.banDo.dsCa].sort((a, b) => b.gioBatDau.localeCompare(a.gioBatDau)); // ưu tiên ca tối
  const dsPhong = ctx.banDo.dsPhong.filter((p) => p.sucChua >= ts.soLuongHocVien).sort((a, b) => a.sucChua - b.sucChua);
  const phuongAn = [];
  for (const thu of MAU_NGAY_HOC) {
    for (const ca of dsCa) {
      if (phuongAn.length >= SO_PHUONG_AN_TOI_DA) break;
      const cacNgay = sinhNgayHoc(ts.tuNgay, thu, ts.soBuoi);
      if (cacNgay.length < ts.soBuoi || cacNgay[cacNgay.length - 1] > ts.denNgay) continue;
      for (const p of dsPhong) {
        const dg = danhGiaPhuongAn({ cacNgay, maCa: ca._id, maPhong: p._id, maLop: ts.lop._id }, ctx);
        if (dg.hopLe) {
          phuongAn.push({ thu, maCa: ca._id, maPhong: p._id, cacNgay, giaoVien: dg.giaoVien, soTietMoiBuoi: ts.soTietMoiBuoi, tongSoTiet: ts.tongSoTiet });
          break;
        }
      }
    }
  }
  if (!phuongAn.length) throw new AppError(422, M.TL_KHONG_CO_PHUONG_AN); // 5.a
  const ten = await layTenNguoiDung(phuongAn.flatMap((p) => p.giaoVien));
  return {
    lop: { maLop: ts.lop._id, tenLop: ts.lop.tenLop },
    phuongAn: phuongAn.map((pa, i) => ({ soThuTu: i + 1, ...dinhDangPhuongAn(pa, ctx.banDo, ten) })),
  };
}

/** Đọc một phương án do Quản lý chọn / sửa (luồng 7.a) */
async function docPhuongAn(body) {
  const ts = await docThamSoTaoLich(body);
  const thu = (Array.isArray(body.thu) ? body.thu : String(body.thu || '').split(',')).map(Number).filter((t) => Number.isInteger(t) && t >= 0 && t <= 6);
  if (!thu.length || !body.maCa || !body.maPhong) throw new AppError(400, M.TL_TRUNG, { fieldErrors: { phuongAn: 'Phương án chưa đủ ngày học, giờ học, phòng học' } });
  const cacNgay = sinhNgayHoc(ts.tuNgay, [...new Set(thu)], ts.soBuoi);
  return { ts, pa: { thu: [...new Set(thu)], maCa: body.maCa, maPhong: body.maPhong, cacNgay, soTietMoiBuoi: ts.soTietMoiBuoi, tongSoTiet: ts.tongSoTiet } };
}

/** UC_6.1 luồng 7.a: "Kiểm tra lại" phương án đã sửa; ngoại lệ 7.b */
async function kiemTraPhuongAn(body) {
  const { ts, pa } = await docPhuongAn(body);
  if (await LichDay.exists({ maLop: ts.lop._id, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } })) throw new AppError(409, M.TL_LOP_DA_CO_LICH);
  const ctx = await taoNguCanh(ts);
  if (!ctx.banDo.ca.get(pa.maCa)) throw new AppError(400, M.TL_TRUNG);
  const dg = danhGiaPhuongAn({ ...pa, maLop: ts.lop._id }, ctx);
  if (!dg.hopLe || pa.cacNgay[pa.cacNgay.length - 1] > ts.denNgay) {
    throw new AppError(409, M.TL_TRUNG, { data: { lyDo: dg.lyDo.length ? dg.lyDo : ['Không đủ thời gian trong khoảng đã chọn'] } });
  }
  const ten = await layTenNguoiDung(dg.giaoVien);
  return { ts, pa: { ...pa, giaoVien: dg.giaoVien }, hienThi: dinhDangPhuongAn({ ...pa, giaoVien: dg.giaoVien }, ctx.banDo, ten) };
}

/**
 * UC_6.1 bước 7–9: lưu lịch ở trạng thái "Nháp" và ghi lịch sử tạo lịch; ngoại lệ 7.b, 8.a.
 * Chống trùng đồng thời: khóa phòng + lớp, kiểm tra lại phòng / lớp trong giao dịch trước khi ghi.
 */
async function luuLich(body, maQuanLy) {
  const { ts, pa, hienThi } = await kiemTraPhuongAn(body);
  const maLop = ts.lop._id;
  try {
    const dsMa = await trongGiaoDichCoKhoa([khoaTN.phong(pa.maPhong), khoaTN.lop(maLop)], async (session) => {
      if (await LichDay.exists({ maLop, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } }).session(session)) {
        throw new AppError(409, M.TL_LOP_DA_CO_LICH);
      }
      const cd = await khaDung.taiChiemDung({ tuNgay: pa.cacNgay[0], denNgay: pa.cacNgay[pa.cacNgay.length - 1] }, session);
      const lyDo = [];
      for (const ngay of pa.cacNgay) {
        if (cd.phong.has(khaDung.khoa(pa.maPhong, ngay, pa.maCa))) lyDo.push(`${hienThi.tenPhong} bận ${clock.nhanNgayDayDu(ngay)}`);
        if (cd.lop.has(khaDung.khoa(maLop, ngay, pa.maCa))) lyDo.push(`Lớp đã có buổi học ${clock.nhanNgayDayDu(ngay)}`);
      }
      if (lyDo.length) throw new AppError(409, M.TL_TRUNG, { data: { lyDo } });
      const n = pa.cacNgay.length;
      const [maLD, maLS] = await Promise.all([sinhNhieuMa('LD', n, session), sinhNhieuMa('LS', n, session)]);
      const luc = clock.now();
      const docs = pa.cacNgay.map((ngay, i) => ({
        _id: maLD[i],
        maLop,
        maPhong: pa.maPhong,
        maCa: pa.maCa,
        maQuanLy,
        ngayDay: ngay,
        soTiet: ts.soTietMoiBuoi,
        trangThaiLich: 'Nhap',
        thoiDiemTao: luc,
        lichSu: [{ maLichSuLich: maLS[i], maQuanLy, hanhDong: 'Tao', thoiDiem: luc }],
      }));
      await LichDay.insertMany(docs, { session });
      await ghiNhatKy({
        hanhDong: 'LICH_DAY.TAO',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Tạo lịch ${ts.lop.tenLop}: ${hienThi.nhanThu} · ${hienThi.gioHoc} · ${hienThi.tenPhong} · ${n} buổi`,
        sau: { phuongAn: { thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong, tuNgay: hienThi.tuNgay, denNgay: hienThi.denNgay }, dsBuoi: docs.map(anhBuoi) },
      }, session);
      return maLD;
    });
    return { lop: { maLop, tenLop: ts.lop.tenLop }, phuongAn: hienThi, trangThaiLich: 'Nhap', dsMaLichDay: dsMa };
  } catch (err) {
    if (err && err.code === 11000) throw new AppError(409, M.TL_TRUNG); // chỉ mục UX_LichDay_Phong / UX_LichDay_Lop
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.TL_LUU_THAT_BAI); // 8.a
  }
}

/* ------------------------------------------------------------------ UC_6.3 */

async function tenMonHoc(maMonHoc) {
  return (await MonHoc.findById(maMonHoc).lean())?.tenMonHoc;
}

/** UC_6.3 bước 3: thông tin lịch + danh sách giáo viên đề xuất; ngoại lệ 3.a */
async function thongTinPhanCong(maLop, { vaiTro = 'GiaoVien' } = {}) {
  const trangThaiChoPhep = vaiTro === 'GiaoVien' ? ['Nhap'] : ['Nhap', 'ChoGVXacNhan'];
  const dsBuoi = (await layNhomBuoi(maLop, trangThaiChoPhep)).map((d) => d.toObject());
  if (!dsBuoi.length) throw new AppError(409, M.PC_PHAI_LA_NHAP);
  const [banDo, lop] = await Promise.all([layBanDo(), LopHoc.findById(maLop).lean()]);
  const deXuat = await khaDung.timNhanSuPhuHop({
    maMonHoc: lop.maMonHoc, vaiTro, dsBuoi, maLop, boQuaLichDay: dsBuoi.map((b) => b._id),
  });
  const tenMon = new Map((await MonHoc.find().lean()).map((m) => [m._id, m.tenMonHoc]));
  return {
    lop: { maLop, tenLop: lop.tenLop, monHoc: await tenMonHoc(lop.maMonHoc) },
    lichHoc: nhanLichDayDu(dsBuoi, banDo),
    phong: [...new Set(dsBuoi.map((b) => banDo.phong.get(b.maPhong)?.tenPhong))].join(', '),
    batDau: clock.dinhDangNgay(dsBuoi[0].ngayDay),
    soBuoi: dsBuoi.length,
    trangThaiLich: dsBuoi[0].trangThaiLich,
    vaiTro,
    deXuat: deXuat.map((d) => ({ ...d, chuyenMon: d.chuyenMon.map((m) => tenMon.get(m) || m) })),
    thongBao: deXuat.length ? undefined : M.PC_KHONG_CO_GV,
  };
}

/** UC_6.3 luồng 4.a.2: danh sách giáo viên / trợ giảng của trung tâm */
async function danhSachNhanSu({ vaiTro = 'GiaoVien' }) {
  const ds = await NhanSuGiangDay.find({ loaiNhanSu: vaiTro, trangThaiTaiKhoan: 'HoatDong' }).sort({ hoTen: 1 }).lean();
  const tenMon = new Map((await MonHoc.find().lean()).map((m) => [m._id, m.tenMonHoc]));
  return ds.map((n) => ({
    maNhanSu: n._id, hoTen: n.hoTen, loaiNhanSu: n.loaiNhanSu, hinhThucLamViec: n.hinhThucLamViec,
    kinhNghiem: n.kinhNghiem, chuyenMon: n.chuyenMon.map((m) => tenMon.get(m) || m),
  }));
}

/** UC_6.3 luồng 4.a.4–4.a.8: "Kiểm tra lịch" của giáo viên được chọn (BR03). session: chạy lại trong giao dịch */
async function kiemTraNhanSu(maLop, { maNhanSu, vaiTro = 'GiaoVien' }, session) {
  const trangThaiChoPhep = vaiTro === 'GiaoVien' ? ['Nhap'] : ['Nhap', 'ChoGVXacNhan'];
  const dsBuoi = (await layNhomBuoi(maLop, trangThaiChoPhep, session)).map((d) => d.toObject());
  if (!dsBuoi.length) throw new AppError(409, M.PC_PHAI_LA_NHAP);
  const [banDo, lop, nhanSu] = await Promise.all([
    layBanDo(),
    LopHoc.findById(maLop).session(session || null).lean(),
    NguoiDung.findById(String(maNhanSu || '')).session(session || null).lean(),
  ]);
  const lyDo = await khaDung.lyDoKhongPhuHop({
    nhanSu, maMonHoc: lop.maMonHoc, vaiTro, dsBuoi, boQuaLichDay: dsBuoi.map((b) => b._id),
  }, banDo, session);
  if (lyDo.length) throw new AppError(409, M.PC_XUNG_DOT, { data: { lyDo } }); // 4.a.8
  return { phuHop: true, maNhanSu: nhanSu._id, hoTen: nhanSu.hoTen }; // 4.a.6
}

/**
 * UC_6.3 bước 4–6: lưu phân công, lịch chuyển sang "Chờ giáo viên xác nhận"; ngoại lệ 6.a.
 * Chống trùng đồng thời: khóa nhân sự + lớp, kiểm tra lại trong giao dịch, chỉ mục UX_LichDay_NhanSu là lớp chặn cuối.
 */
async function phanCong(maLop, { maNhanSu, vaiTro = 'GiaoVien' }, maQuanLy) {
  if (!E.VAI_TRO_PHAN_CONG.includes(vaiTro)) throw new AppError(400, M.PC_LUU_THAT_BAI);
  const { maNhanSu: ma } = await kiemTraNhanSu(maLop, { maNhanSu, vaiTro }); // BR03: kiểm tra sớm để báo lỗi nhanh
  const trangThaiChoPhep = vaiTro === 'GiaoVien' ? ['Nhap'] : ['Nhap', 'ChoGVXacNhan'];
  try {
    return await trongGiaoDichCoKhoa([khoaTN.nhanSu(ma), khoaTN.lop(maLop)], async (session) => {
      await kiemTraNhanSu(maLop, { maNhanSu: ma, vaiTro }, session); // kiểm tra lại với dữ liệu mới nhất
      const dsBuoi = await layNhomBuoi(maLop, trangThaiChoPhep, session);
      if (!dsBuoi.length) throw new AppError(409, M.PC_PHAI_LA_NHAP);
      const truoc = dsBuoi.map(anhBuoi);
      const [maPC, maLS] = await Promise.all([sinhNhieuMa('PC', dsBuoi.length, session), sinhNhieuMa('LS', dsBuoi.length, session)]);
      const luc = clock.now();
      for (const [i, b] of dsBuoi.entries()) {
        b.phanCong = b.phanCong.filter((p) => p.vaiTro !== vaiTro && p.maNhanSu !== ma);
        b.phanCong.push({ maPhanCong: maPC[i], maNhanSu: ma, vaiTro, trangThaiPhanCong: 'ChoXacNhan' });
        if (vaiTro === 'GiaoVien') b.trangThaiLich = 'ChoGVXacNhan';
        b.thoiDiemCapNhat = luc;
        b.lichSu.push({ maLichSuLich: maLS[i], maQuanLy, hanhDong: 'PhanCong', thoiDiem: luc, ghiChu: `${vaiTro === 'GiaoVien' ? 'Giáo viên' : 'Trợ giảng'} ${ma}` });
        await b.save({ session });
      }
      await ghiNhatKy({
        hanhDong: vaiTro === 'GiaoVien' ? 'PHAN_CONG.GIAO_VIEN' : 'PHAN_CONG.TRO_GIANG',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Phân công ${vaiTro === 'GiaoVien' ? 'giáo viên' : 'trợ giảng'} ${ma} cho ${dsBuoi.length} buổi`,
        truoc,
        sau: dsBuoi.map(anhBuoi),
      }, session);
      return { maLop, maNhanSu: ma, vaiTro, soBuoi: dsBuoi.length, trangThaiLich: dsBuoi[0].trangThaiLich };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err?.code === 11000) throw new AppError(409, M.PC_XUNG_DOT); // UX_LichDay_NhanSu
    throw new AppError(500, M.PC_LUU_THAT_BAI);
  }
}

/** Danh sách học viên của lớp */
async function hocVienCuaLop(maLop, session) {
  return PhuHuynhHocVien.find({ lopTheoHoc: maLop }).session(session || null).lean();
}

/** UC_6.3 bước 7–9: gửi thông báo lịch dự kiến cho giáo viên (và phụ huynh có học viên thuộc lớp – BPMN); ngoại lệ 8.a */
async function guiThongBaoPhanCong(maLop, maQuanLy) {
  const banDo = await layBanDo();
  try {
    return await trongGiaoDichCoKhoa([khoaTN.lop(maLop)], async (session) => {
      const dsBuoi = await layNhomBuoi(maLop, ['ChoGVXacNhan'], session);
      const canGui = dsBuoi.filter((b) => b.phanCong.some((p) => !p.thoiDiemGuiThongBao));
      if (!canGui.length) throw new AppError(409, M.PC_KHONG_CO_GI_DE_GUI);
      const luc = clock.now();
      const maLS = await sinhNhieuMa('LS', canGui.length, session);
      const nhanSuNhan = new Set();
      for (const [i, b] of canGui.entries()) {
        for (const p of b.phanCong) {
          if (!p.thoiDiemGuiThongBao) {
            p.thoiDiemGuiThongBao = luc; // mốc tính hạn 24 giờ (UC_8 BR03)
            nhanSuNhan.add(p.maNhanSu);
          }
        }
        if (!b.thoiDiemGuiDuKien) b.thoiDiemGuiDuKien = luc; // mốc 24 giờ cho phụ huynh (UC_11 BR03)
        b.thoiDiemCapNhat = luc;
        b.lichSu.push({ maLichSuLich: maLS[i], maQuanLy, hanhDong: 'GuiDuKien', thoiDiem: luc });
        await b.save({ session });
      }
      const tenLop = banDo.lop.get(maLop)?.tenLop;
      const moTa = nhanLichDayDu(canGui, banDo);
      const tuNgay = clock.nhanNgayDayDu(canGui[0].ngayDay);
      const dsNhan = [...nhanSuNhan].map((ma) => ({
        maNguoiNhan: ma,
        loaiThongBao: 'LichDuKien',
        tieuDe: `Lịch dạy dự kiến lớp ${tenLop}`,
        noiDung: `Bạn được phân công lớp ${tenLop}: ${moTa}, bắt đầu ${tuNgay}. Vui lòng phản hồi trong 24 giờ.`,
      }));
      for (const hv of await hocVienCuaLop(maLop, session)) {
        dsNhan.push({
          maPHHV: hv._id,
          loaiThongBao: 'LichDuKien',
          tieuDe: `Lịch học dự kiến lớp ${tenLop}`,
          noiDung: `Lịch học dự kiến: ${moTa}, bắt đầu ${tuNgay}. Vui lòng xác nhận trong 24 giờ.`,
        });
      }
      await guiThongBao(dsNhan, session);
      await ghiNhatKy({
        hanhDong: 'PHAN_CONG.GUI_THONG_BAO',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Gửi lịch dự kiến cho ${nhanSuNhan.size} nhân sự và ${dsNhan.length - nhanSuNhan.size} học viên`,
        sau: { soBuoi: canGui.length, nhanSu: [...nhanSuNhan] },
      }, session);
      return { maLop, soBuoi: canGui.length, soNguoiNhan: dsNhan.length };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.PC_CHUA_GUI_THONG_BAO); // 8.a: phân công đã lưu ở bước 6
  }
}

/* ------------------------------------------------------------------ UC_6.4 */

function trangThaiPhanHoiTongHop(dsTrangThai) {
  if (dsTrangThai.includes('DeXuatThayDoi')) return 'DeXuatThayDoi';
  if (dsTrangThai.includes('HetHan')) return 'HetHan';
  if (dsTrangThai.length && dsTrangThai.every((t) => t === 'DaXacNhan')) return 'DaXacNhan';
  return 'ChoXacNhan';
}

/** UC_6.4 bước 3–4 (MH24): thông tin lịch, phản hồi giáo viên, xác nhận của phụ huynh, kiểm tra trùng lịch */
async function kiemTraTruocPheDuyet(maLop, { trangThai } = {}) {
  const dsTrangThai = trangThai ? [trangThai] : ['ChoGVXacNhan', 'DaDuyet', 'DaPhatHanh'];
  let dsBuoi = [];
  for (const tt of dsTrangThai) {
    dsBuoi = (await layNhomBuoi(maLop, [tt])).map((d) => d.toObject());
    if (dsBuoi.length) break;
  }
  if (!dsBuoi.length) throw new AppError(404, M.KHONG_TIM_THAY_LICH);
  const [banDo, lop, hocVien] = await Promise.all([layBanDo(), LopHoc.findById(maLop).lean(), hocVienCuaLop(maLop)]);
  const maNhanSu = [...new Set(dsBuoi.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)))];
  const [ten, tenMon] = await Promise.all([
    layTenNguoiDung(maNhanSu),
    MonHoc.find().lean().then((ds) => new Map(ds.map((m) => [m._id, m.tenMonHoc]))),
  ]);
  const nhanSu = maNhanSu.map((ma) => {
    const pcs = dsBuoi.flatMap((b) => b.phanCong.filter((p) => p.maNhanSu === ma).map((p) => ({ ...p, maLichDay: b._id, ngayDay: b.ngayDay })));
    const nd = ten.get(ma);
    return {
      maNhanSu: ma,
      hoTen: nd?.hoTen,
      vaiTro: pcs[0].vaiTro,
      chuyenMon: (nd?.chuyenMon || []).map((m) => tenMon.get(m) || m),
      hinhThucLamViec: nd?.hinhThucLamViec,
      trangThaiPhanHoi: trangThaiPhanHoiTongHop(pcs.map((p) => p.trangThaiPhanCong)),
      deXuatThayDoi: pcs.flatMap((p) => p.phanHoiLichDay.map((ph) => ({
        maLichDay: p.maLichDay,
        ngayDay: clock.dinhDangNgay(p.ngayDay),
        ...ph,
        ngayDeXuat: ph.ngayDeXuat && clock.dinhDangNgay(ph.ngayDeXuat),
      }))),
    };
  });
  // Kết quả xác nhận ca học của phụ huynh / học viên (UC_11) – đếm theo học viên
  const ketQuaHV = hocVien.map((hv) => {
    const kq = dsBuoi.map((b) => b.xacNhanCaHoc.find((x) => x.maPHHV === hv._id));
    if (kq.some((x) => x && x.ketQua === 'TuChoi')) return 'TuChoi';
    if (kq.every((x) => x && x.ketQua === 'XacNhan')) return 'XacNhan';
    return 'ChuaPhanHoi';
  });
  const tenHV = new Map(hocVien.map((h) => [h._id, h.tenHocVien]));
  const xungDot = await khaDung.kiemTraXungDot(dsBuoi, banDo);
  const giaoVien = nhanSu.filter((n) => n.vaiTro === 'GiaoVien');
  return {
    maLop,
    tenLop: lop.tenLop,
    lichHoc: `${lop.tenLop} · ${nhanLichDayDu(dsBuoi, banDo)}`,
    trangThaiLich: dsBuoi[0].trangThaiLich,
    soBuoi: dsBuoi.length,
    nhanSu,
    phuHuynh: {
      daXacNhan: ketQuaHV.filter((k) => k === 'XacNhan').length,
      tuChoi: ketQuaHV.filter((k) => k === 'TuChoi').length,
      chuaPhanHoi: ketQuaHV.filter((k) => k === 'ChuaPhanHoi').length,
      // UC_11: phụ huynh chỉ xác nhận lịch dự kiến trong 24 giờ kể từ khi gửi → lịch đã phát hành hoặc hết hạn thì
      // các học viên chưa phản hồi là "Không phản hồi" (không còn chờ)
      hetHanPhanHoi: dsBuoi[0].trangThaiLich === 'DaPhatHanh'
        || dsBuoi.some((b) => b.thoiDiemGuiDuKien && b.thoiDiemGuiDuKien.getTime() + 24 * clock.MOT_GIO <= clock.now().getTime()),
      dsTuChoi: dsBuoi.flatMap((b) => b.xacNhanCaHoc.filter((x) => x.ketQua === 'TuChoi').map((x) => ({
        maLichDay: b._id, ngayDay: clock.dinhDangNgay(b.ngayDay), maPHHV: x.maPHHV, tenHocVien: tenHV.get(x.maPHHV), lyDoTuChoi: x.lyDoTuChoi,
      }))),
    },
    xungDot,
    coThePheDuyet: dsBuoi[0].trangThaiLich === 'ChoGVXacNhan' && giaoVien.length > 0 && giaoVien.every((g) => g.trangThaiPhanHoi === 'DaXacNhan'),
    coThePhatHanh: dsBuoi[0].trangThaiLich === 'DaDuyet',
    dsBuoi: dsBuoi.map((b) => ({ ...tomTatBuoi(b, banDo), giaoVien: b.phanCong.map((p) => ({ maNhanSu: p.maNhanSu, hoTen: ten.get(p.maNhanSu)?.hoTen, vaiTro: p.vaiTro, trangThaiPhanCong: p.trangThaiPhanCong })) })),
  };
}

async function capNhatTrangThaiNhom(maLop, { tu, sang, hanhDong, ghiChu, maQuanLy, bienDoi }, session) {
  const dsBuoi = await layNhomBuoi(maLop, [tu], session);
  if (!dsBuoi.length) return [];
  const maLS = await sinhNhieuMa('LS', dsBuoi.length, session);
  const luc = clock.now();
  for (const [i, b] of dsBuoi.entries()) {
    b.trangThaiLich = sang;
    b.thoiDiemCapNhat = luc;
    if (bienDoi) bienDoi(b);
    b.lichSu.push({ maLichSuLich: maLS[i], maQuanLy, hanhDong, thoiDiem: luc, ...(ghiChu ? { ghiChu } : {}) });
    await b.save({ session });
  }
  return dsBuoi;
}

/** Điều kiện phê duyệt: mọi buổi có giáo viên và mọi giáo viên đã xác nhận (tiền điều kiện UC_6.4) */
const duDieuKienPheDuyet = (dsBuoi) => dsBuoi.length > 0 && dsBuoi.every((b) => {
  const gv = b.phanCong.filter((p) => p.vaiTro === 'GiaoVien');
  return gv.length > 0 && gv.every((p) => p.trangThaiPhanCong === 'DaXacNhan');
});

/** UC_6.4 bước 5–7: phê duyệt; ngoại lệ 6.a. Khóa lớp, kiểm tra lại điều kiện trong giao dịch. */
async function pheDuyet(maLop, maQuanLy) {
  const kt = await kiemTraTruocPheDuyet(maLop, { trangThai: 'ChoGVXacNhan' }).catch((e) => {
    // Lớp không còn nhóm buổi "Chờ GV xác nhận" (đã duyệt / đã phát hành) → báo đúng lý do
    if (e.status === 404) throw new AppError(409, M.PD_CHI_CHO_GV_XAC_NHAN);
    throw e;
  });
  if (!kt.coThePheDuyet) throw new AppError(409, M.PD_CHUA_XAC_NHAN, { data: { nhanSu: kt.nhanSu } });
  try {
    const ds = await trongGiaoDichCoKhoa([khoaTN.lop(maLop)], async (session) => {
      const hienTai = await layNhomBuoi(maLop, ['ChoGVXacNhan'], session);
      if (!duDieuKienPheDuyet(hienTai)) throw new AppError(409, M.PD_CHUA_XAC_NHAN);
      const truoc = hienTai.map(anhBuoi);
      const kq = await capNhatTrangThaiNhom(maLop, { tu: 'ChoGVXacNhan', sang: 'DaDuyet', hanhDong: 'PheDuyet', maQuanLy }, session);
      await ghiNhatKy({
        hanhDong: 'LICH_DAY.PHE_DUYET',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Phê duyệt ${kq.length} buổi`,
        truoc: { trangThaiLich: 'ChoGVXacNhan', dsBuoi: truoc },
        sau: { trangThaiLich: 'DaDuyet', dsMaLichDay: kq.map((b) => b._id) },
      }, session);
      return kq;
    });
    return { maLop, trangThaiLich: 'DaDuyet', soBuoi: ds.length, canhBaoTuChoi: kt.phuHuynh.tuChoi, xungDot: kt.xungDot };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.PD_THAT_BAI);
  }
}

async function danhSachNguoiNhanLich(dsBuoi, maLop) {
  const nhanSu = [...new Set(dsBuoi.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)))];
  const hocVien = await hocVienCuaLop(maLop);
  return { nhanSu, hocVien };
}

/** UC_6.4 bước 9–12: phát hành (BR02, BR03); ngoại lệ 10.a, 11.a */
async function phatHanh(maLop, maQuanLy) {
  const banDo = await layBanDo();
  let dsBuoi;
  try {
    dsBuoi = await trongGiaoDichCoKhoa([khoaTN.lop(maLop)], async (session) => {
      const ds = await capNhatTrangThaiNhom(maLop, {
        tu: 'DaDuyet', sang: 'DaPhatHanh', hanhDong: 'PhatHanh', maQuanLy,
      }, session);
      if (!ds.length) throw new AppError(409, M.PH_HANH_CHI_DA_DUYET);
      await ghiNhatKy({
        hanhDong: 'LICH_DAY.PHAT_HANH',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Phát hành ${ds.length} buổi`,
        truoc: { trangThaiLich: 'DaDuyet' },
        sau: { trangThaiLich: 'DaPhatHanh', dsMaLichDay: ds.map((b) => b._id) },
      }, session);
      return ds.map((d) => d.toObject());
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.PH_HANH_THAT_BAI); // 10.a: giữ trạng thái "Đã duyệt"
  }
  const ketQuaGui = await guiThongBaoLichChinhThuc(maLop, dsBuoi, banDo);
  return { maLop, trangThaiLich: 'DaPhatHanh', soBuoi: dsBuoi.length, ...ketQuaGui };
}

/** Gửi thông báo lịch chính thức cho giáo viên được phân công và phụ huynh có học viên thuộc lớp */
async function guiThongBaoLichChinhThuc(maLop, dsBuoi, banDo) {
  const { nhanSu, hocVien } = await danhSachNguoiNhanLich(dsBuoi, maLop);
  const ten = await layTenNguoiDung(nhanSu);
  const tenLop = banDo.lop.get(maLop)?.tenLop;
  const moTa = nhanLichDayDu(dsBuoi, banDo);
  const dsNhan = [
    ...nhanSu.map((ma) => ({ maNguoiNhan: ma, hoTen: ten.get(ma)?.hoTen, loaiThongBao: 'LichChinhThuc', tieuDe: `Lịch dạy chính thức lớp ${tenLop}`, noiDung: `Lịch dạy chính thức: ${moTa}.` })),
    ...hocVien.map((hv) => ({ maPHHV: hv._id, hoTen: hv.tenHocVien, soDienThoai: hv.soDienThoai, loaiThongBao: 'LichChinhThuc', tieuDe: `Lịch học chính thức lớp ${tenLop}`, noiDung: `Lịch học chính thức: ${moTa}.` })),
  ];
  try {
    await trongGiaoDich((session) => guiThongBao(dsNhan.map(({ hoTen, soDienThoai, ...tb }) => tb), session));
    return { soNguoiNhan: dsNhan.length, soNhanSu: nhanSu.length, soPhuHuynh: hocVien.length, daGuiNhanSu: nhanSu.length, daGuiPhuHuynh: hocVien.length, chuaGui: [] };
  } catch {
    // 11.a: lịch đã phát hành nhưng chưa gửi được thông báo → hiển thị danh sách, cho "Gửi lại"
    return {
      soNguoiNhan: 0,
      soNhanSu: nhanSu.length,
      soPhuHuynh: hocVien.length,
      daGuiNhanSu: 0,
      daGuiPhuHuynh: 0,
      chuaGui: dsNhan.map((n) => ({ maNguoiNhan: n.maNguoiNhan, maPHHV: n.maPHHV, hoTen: n.hoTen, soDienThoai: n.soDienThoai })),
      thongBao: M.PH_HANH_CHUA_GUI_HET,
    };
  }
}

/** UC_6.4 bước 11.a.2–11.a.3: "Gửi lại" thông báo lịch chính thức */
async function guiLaiThongBaoPhatHanh(maLop, { dsNguoiNhan } = {}) {
  const dsBuoi = (await layNhomBuoi(maLop, ['DaPhatHanh'])).map((d) => d.toObject());
  if (!dsBuoi.length) throw new AppError(409, M.PH_HANH_CHI_DA_DUYET);
  const banDo = await layBanDo();
  const kq = await guiThongBaoLichChinhThuc(maLop, dsBuoi, banDo);
  if (Array.isArray(dsNguoiNhan) && dsNguoiNhan.length) kq.ghiChu = 'Đã gửi lại cho người nhận của lịch';
  return { maLop, trangThaiLich: 'DaPhatHanh', ...kq };
}

/** UC_6.4 luồng 5.a: phân công lại – đưa lịch về "Nháp" (BR04) */
async function phanCongLai(maLop, maQuanLy) {
  const ds = await trongGiaoDichCoKhoa([khoaTN.lop(maLop)], async (session) => {
    const truoc = (await layNhomBuoi(maLop, ['ChoGVXacNhan', 'DaDuyet'], session)).map(anhBuoi);
    const ketQua = [];
    for (const tu of ['ChoGVXacNhan', 'DaDuyet']) {
      ketQua.push(...await capNhatTrangThaiNhom(maLop, {
        tu,
        sang: 'Nhap',
        hanhDong: 'CapNhat',
        ghiChu: 'Phân công lại',
        maQuanLy,
        bienDoi: (b) => {
          b.phanCong = b.phanCong.filter((p) => p.vaiTro !== 'GiaoVien');
          b.thoiDiemGuiDuKien = undefined;
        },
      }, session));
    }
    if (ketQua.length) {
      await ghiNhatKy({
        hanhDong: 'PHAN_CONG.PHAN_CONG_LAI',
        doiTuong: { loai: 'LopHoc', ma: maLop },
        moTa: `Đưa ${ketQua.length} buổi về Nháp để phân công lại`,
        truoc,
        sau: ketQua.map(anhBuoi),
      }, session);
    }
    return ketQua;
  });
  if (!ds.length) throw new AppError(409, M.KHONG_TIM_THAY_LICH);
  return { maLop, trangThaiLich: 'Nhap', soBuoi: ds.length };
}

/** Quản lý xử lý đề xuất thay đổi của giáo viên (PhanHoiLichDay.trangThaiXuLy – Bảng 4.1: UC_6.4) */
async function xuLyDeXuatThayDoi(maLichDay, maPhanHoiLichDay, { trangThaiXuLy, ghiChu } = {}, maQuanLy) {
  if (!['DaChapNhan', 'TuChoi'].includes(trangThaiXuLy)) throw new AppError(400, M.PH_CHUA_CHON_TRANG_THAI);
  const ma = String(maLichDay);
  const maPH = String(maPhanHoiLichDay);
  // Đề xuất có phiếu trong Phản hồi & yêu cầu (UC_8 5a) → xử lý qua phiếu để lịch dạy, phiếu và thông báo luôn khớp nhau
  const phieu = await PhanHoiGopY.findOne({ maLichDay: ma, maPhanHoiLichDay: maPH }, { _id: 1 }).lean();
  if (phieu) {
    const phanHoi = require('./phanHoi.service');
    return phanHoi.capNhatTrangThai(phieu._id, {
      trangThaiMoi: trangThaiXuLy === 'DaChapNhan' ? 'DaXuLy' : 'TuChoi',
      ghiChu: ghiChu || (trangThaiXuLy === 'TuChoi' ? 'Quản lý từ chối đề xuất thay đổi ca dạy' : undefined),
    }, maQuanLy);
  }
  const ld = await LichDay.findOne({ _id: ma, 'phanCong.phanHoiLichDay.maPhanHoiLichDay': maPH }).lean();
  if (!ld) throw new AppError(404, M.KHONG_TIM_THAY_LICH);
  const pc = ld.phanCong.find((p) => p.phanHoiLichDay.some((x) => x.maPhanHoiLichDay === maPH));
  return trongGiaoDich(async (session) => {
    // Cập nhật nguyên tử: chỉ xử lý khi đề xuất còn "Chờ xử lý" (hai quản lý cùng xử lý → người sau nhận 409)
    const kq = await LichDay.updateOne(
      { _id: ma, phanCong: { $elemMatch: { maNhanSu: pc.maNhanSu, phanHoiLichDay: { $elemMatch: { maPhanHoiLichDay: maPH, trangThaiXuLy: 'ChoXuLy' } } } } },
      { $set: { 'phanCong.$[pc].phanHoiLichDay.$[ph].trangThaiXuLy': trangThaiXuLy, thoiDiemCapNhat: clock.now() } },
      { arrayFilters: [{ 'pc.maNhanSu': pc.maNhanSu }, { 'ph.maPhanHoiLichDay': maPH }], session },
    );
    if (kq.modifiedCount !== 1) throw new AppError(409, M.PH_CHI_CAP_NHAT_KHI);
    const banDo = await layBanDo();
    await guiThongBao([{
      maNguoiNhan: pc.maNhanSu,
      loaiThongBao: 'KetQuaXuLy',
      tieuDe: `Đề xuất thay đổi lịch dạy ${trangThaiXuLy === 'DaChapNhan' ? 'được chấp nhận' : 'bị từ chối'}`,
      noiDung: `Lớp ${banDo.lop.get(ld.maLop)?.tenLop} · ${clock.nhanNgayDayDu(ld.ngayDay)}: Quản lý đã ${trangThaiXuLy === 'DaChapNhan' ? 'chấp nhận' : 'từ chối'} đề xuất của bạn.`,
    }], session);
    await ghiNhatKy({
      hanhDong: trangThaiXuLy === 'DaChapNhan' ? 'DE_XUAT_THAY_DOI.DUYET' : 'DE_XUAT_THAY_DOI.TU_CHOI',
      doiTuong: { loai: 'LichDay', ma },
      moTa: `Đề xuất ${maPH} của ${pc.maNhanSu}`,
      truoc: { maPhanHoiLichDay: maPH, trangThaiXuLy: 'ChoXuLy' },
      sau: { maPhanHoiLichDay: maPH, trangThaiXuLy },
    }, session);
    return { maLichDay: ma, maPhanHoiLichDay: maPH, trangThaiXuLy };
  });
}

module.exports = {
  layNhomBuoi,
  nhanLichDayDu,
  danhSachLich,
  lopChuaCoLich,
  deXuatLich,
  kiemTraPhuongAn: async (body) => (await kiemTraPhuongAn(body)).hienThi,
  luuLich,
  thongTinPhanCong,
  danhSachNhanSu,
  kiemTraNhanSu,
  phanCong,
  guiThongBaoPhanCong,
  kiemTraTruocPheDuyet,
  pheDuyet,
  phatHanh,
  guiLaiThongBaoPhatHanh,
  phanCongLai,
  xuLyDeXuatThayDoi,
  hocVienCuaLop,
};
