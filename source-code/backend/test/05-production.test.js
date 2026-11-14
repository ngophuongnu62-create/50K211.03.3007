/**
 * Kiểm thử TIÊU CHUẨN PRODUCTION
 *  P1 – Dữ liệu gốc an toàn (init-master-data không xóa dữ liệu, chạy lại không đổi gì), chặn nạp demo nhầm
 *  P2 – Chống xung đột đồng thời: giáo viên / trợ giảng / phòng không bao giờ bị xếp trùng dù gửi cùng lúc
 *  P3 – Nhật ký hệ thống audit_logs: đủ người thực hiện, thời gian, hành động, dữ liệu cũ / mới; không sửa xóa được
 *  P4 – Bảo mật: CORS nghiêm ngặt, giới hạn tần suất, bắt buộc đổi mật khẩu tạm, vô hiệu token cũ
 *  P5 – Dữ liệu lạ trên mọi API không làm máy chủ lỗi 5xx / sập
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { khoiDong, TK, PH } = require('./helpers/moiTruong'); // phải nạp trước để đặt NODE_ENV=test
const M = require('../src/constants/messages');
const { taoApp } = require('../src/app');
const { MAT_KHAU_MAU } = require('../src/seed/duLieuMau');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
});
after(async () => { await t.dong(); });

const ngayDate = (s) => new Date(`${s}T00:00:00Z`);
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');
const CON_HIEU_LUC = { trangThaiLich: { $ne: 'DaHuy' } };

/** Mở thêm một máy chủ với cấu hình riêng (CORS / giới hạn tần suất) trên cùng CSDL kiểm thử */
async function moMayChu(tuyChon) {
  const srv = taoApp(tuyChon).listen(0);
  await new Promise((ok) => srv.once('listening', ok));
  return { base: `http://127.0.0.1:${srv.address().port}/api`, dong: () => new Promise((ok) => srv.close(ok)) };
}

/** Không nhân sự nào có 2 buổi còn hiệu lực trong cùng ngày–ca */
async function khongTrungNhanSu(maNhanSu) {
  const ds = await models.LichDay.find({ ...CON_HIEU_LUC, 'phanCong.maNhanSu': maNhanSu }).lean();
  const khoa = ds.map((b) => `${b.ngayDay.toISOString()}|${b.maCa}`);
  assert.equal(new Set(khoa).size, khoa.length, `${maNhanSu} bị xếp trùng ca`);
}

/* ======================================================================================= */
describe('P2 · Chống trùng lịch khi nhiều người thao tác cùng lúc', () => {
  before(async () => { await t.napLai(); });

  it('TC-SX-01 · Phân công cùng một giáo viên vào 2 lớp trùng ca (IE65-K12 và IE65-K13, Thứ 3–5 Ca 3) gửi đồng thời → đúng 1 thành công', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    const luu = await t.goi('POST', '/quan-ly/quan-ly-lich', { token: ql, body: { maLop: 'IE65-K13', thu: [2, 4], maCa: 'CA3', maPhong: 'P401' } });
    assert.equal(luu.status, 201, JSON.stringify(luu.body));
    const [a, b] = await Promise.all([
      t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: ql, body: { maNhanSu: 'GV-005' } }),
      t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K13/phan-cong', { token: ql2, body: { maNhanSu: 'GV-005' } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.body, b.body]));
    await khongTrungNhanSu('GV-005');
    // Lớp bị từ chối vẫn giữ nguyên trạng thái Nháp, không có phân công dở dang
    const thua = a.status === 409 ? 'IE65-K12' : 'IE65-K13';
    assert.equal(await models.LichDay.countDocuments({ maLop: thua, 'phanCong.0': { $exists: true } }), 0);
  });

  it('TC-SX-02 · Phân công cùng một trợ giảng vào 2 lớp trùng ca gửi đồng thời → đúng 1 thành công', async () => {
    const ql = await t.nhanSu(TK.QL);
    // Lớp GT-B1-09 có lịch Nháp trùng đúng ngày–ca với TOEIC-K06 (Thứ 2, 4 Ca 2) nhưng ở phòng khác
    const goc = await models.LichDay.find({ maLop: 'TOEIC-K06' }).lean();
    await models.LichDay.insertMany(goc.map((b, i) => ({
      ...b, _id: `LD-SX-${i}`, maLop: 'GT-B1-09', maPhong: 'P402', phanCong: [], lichSu: [], xacNhanCaHoc: [], yeuCauNghiHoc: [],
    })));
    const [a, b] = await Promise.all([
      t.goi('POST', '/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: ql, body: { maNhanSu: 'TG-002', vaiTro: 'TroGiang' } }),
      t.goi('POST', '/quan-ly/quan-ly-lich/GT-B1-09/phan-cong', { token: ql, body: { maNhanSu: 'TG-002', vaiTro: 'TroGiang' } }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], JSON.stringify([a.body, b.body]));
    await khongTrungNhanSu('TG-002');
  });

  it('TC-SX-03 · Hai Quản lý cùng gán 2 trợ giảng khác nhau cho một lớp → mỗi buổi chỉ có đúng 1 trợ giảng', async () => {
    // Cho Như Ý (TG-004) rảnh Thứ 2, 4 Ca 2 để cả hai trợ giảng đều hợp lệ
    for (const lr of await models.LichRanh.find({ maNhanSu: 'TG-004' })) {
      for (const thu of [1, 3]) lr.cacRanh.push({ ngayRanh: new Date(lr.tuanBatDau.getTime() + (thu - 1) * 864e5), maCa: 'CA2' });
      await lr.save();
    }
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    await models.LichDay.updateMany({ maLop: 'GT-B1-09' }, { $set: { trangThaiLich: 'DaHuy' } });
    const kq = await Promise.all([
      t.goi('POST', '/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: ql, body: { maNhanSu: 'TG-004', vaiTro: 'TroGiang' } }),
      t.goi('POST', '/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: ql2, body: { maNhanSu: 'TG-002', vaiTro: 'TroGiang' } }),
    ]);
    assert.ok(kq.every((r) => r.status < 500), JSON.stringify(kq.map((r) => r.body)));
    assert.ok(kq.some((r) => r.status === 200));
    for (const b of await models.LichDay.find({ maLop: 'TOEIC-K06' }).lean()) {
      assert.equal(b.phanCong.filter((p) => p.vaiTro === 'TroGiang').length, 1, `Buổi ${b._id} có nhiều hơn 1 trợ giảng`);
    }
  });

  it('TC-SX-04 · CSDL từ chối buổi dạy có 2 trợ giảng hoặc 1 nhân sự xuất hiện 2 lần (bỏ qua API)', async () => {
    const b = await models.LichDay.findOne({ maLop: 'TOEIC-K06' }).lean();
    const pc = (ma, vaiTro) => ({ maPhanCong: `PC-SX-${ma}`, maNhanSu: ma, vaiTro, trangThaiPhanCong: 'ChoXacNhan' });
    await assert.rejects(models.LichDay.create({ ...b, _id: 'LD-SX-2TG', maLop: 'Kids-K04', maPhong: 'P303', phanCong: [pc('TG-003', 'TroGiang'), pc('TG-004', 'TroGiang')] }), /trợ giảng|TroGiang/i);
    await assert.rejects(models.LichDay.create({ ...b, _id: 'LD-SX-2LAN', maLop: 'Kids-K04', maPhong: 'P303', phanCong: [pc('GV-007', 'GiaoVien'), pc('GV-007', 'TroGiang')] }));
  });

  it('TC-SX-05 · Chèn trực tiếp buổi dạy khiến giáo viên dạy 2 lớp cùng ngày–ca → chỉ mục UX_LichDay_NhanSu chặn', async () => {
    const goc = await models.LichDay.findOne({ maLop: 'IEF-K15', ngayDay: ngayDate('2026-11-17') }).lean();
    await assert.rejects(
      models.LichDay.create({
        ...goc, _id: 'LD-SX-NS', maLop: 'Kids-K04', maPhong: 'P402', lichSu: [], xacNhanCaHoc: [], yeuCauNghiHoc: [],
        phanCong: [{ maPhanCong: 'PC-SX-NS', maNhanSu: 'GV-001', vaiTro: 'GiaoVien', trangThaiPhanCong: 'ChoXacNhan' }],
      }),
      (e) => e.code === 11000 && /UX_LichDay_NhanSu/.test(e.message),
    );
  });
});

describe('P2 · Đăng ký phòng và xếp lịch tranh cùng một phòng–ca', () => {
  before(async () => { await t.napLai(); });

  it('TC-SX-06 · Đăng ký phòng P.401 và lưu lịch lớp IE65-K13 vào P.401 cùng ngày–ca gửi đồng thời → đúng 1 thành công, không trùng phòng', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    const [dk, ll] = await Promise.all([
      t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql, body: { maPhong: 'P401', ngaySuDung: '2026-11-17', maCa: 'CA3' } }),
      t.goi('POST', '/quan-ly/quan-ly-lich', { token: ql2, body: { maLop: 'IE65-K13', tuNgay: '2026-11-17', thu: [2, 4], maCa: 'CA3', maPhong: 'P401' } }),
    ]);
    assert.deepEqual([dk.status, ll.status].sort(), [201, 409], JSON.stringify([dk.body, ll.body]));
    const soDk = await models.DangKyPhong.countDocuments({ maPhong: 'P401', ngaySuDung: ngayDate('2026-11-17'), maCa: 'CA3', trangThaiDangKy: 'DaDangKy' });
    const soBuoi = await models.LichDay.countDocuments({ ...CON_HIEU_LUC, maPhong: 'P401', ngayDay: ngayDate('2026-11-17'), maCa: 'CA3' });
    assert.equal(soDk + soBuoi, 1);
  });

  it('TC-SX-07 · Hai Quản lý cùng hủy một đăng ký phòng → 1 thành công, 1 nhận 422 (không lỗi 500)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    const dk = await models.DangKyPhong.findOne({ trangThaiDangKy: 'DaDangKy', ngaySuDung: { $gt: ngayDate('2026-11-12') } }).lean();
    const kq = await Promise.all([ql, ql2].map((tk) => t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk._id}/huy`, { token: tk })));
    assert.deepEqual(kq.map((r) => r.status).sort(), [200, 422]);
  });

  it('TC-SX-08 · Hai Quản lý cùng chuyển 2 buổi khác nhau vào cùng phòng–ca khi lập lịch tuần → đúng 1 thành công', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    const [a, b] = await Promise.all([
      t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', {
        token: ql, body: { buoiBu: [{ maLop: 'GT-A2-08', ngayDay: '2026-11-20', maCa: 'CA2', maPhong: 'P402', maGiaoVien: 'GV-002', soTiet: 3 }] },
      }),
      t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql2, body: { maPhong: 'P402', ngaySuDung: '2026-11-20', maCa: 'CA2' } }),
    ]);
    assert.ok([a.status, b.status].filter((s) => s >= 200 && s < 300).length <= 1, JSON.stringify([a.body, b.body]));
    assert.ok([a.status, b.status].every((s) => s < 500));
    const soDk = await models.DangKyPhong.countDocuments({ maPhong: 'P402', ngaySuDung: ngayDate('2026-11-20'), maCa: 'CA2', trangThaiDangKy: 'DaDangKy' });
    const soBuoi = await models.LichDay.countDocuments({ ...CON_HIEU_LUC, maPhong: 'P402', ngayDay: ngayDate('2026-11-20'), maCa: 'CA2' });
    assert.ok(soDk + soBuoi <= 1);
  });
});

/* ======================================================================================= */
describe('P3 · Nhật ký hệ thống (audit_logs)', () => {
  before(async () => { await t.napLai(); });

  it('TC-SX-09 · Phân công giáo viên ghi nhật ký: người thực hiện, thời điểm, hành động, dữ liệu cũ và mới, mã yêu cầu', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-005' } });
    assert.equal(r.status, 200);
    const maYeuCau = r.headers.get('x-request-id');
    assert.ok(maYeuCau);
    const log = await models.AuditLog.findOne({ maYeuCau }).lean();
    assert.ok(log, 'Không có nhật ký cho yêu cầu');
    assert.equal(log.hanhDong, 'PHAN_CONG.GIAO_VIEN');
    assert.deepEqual({ ma: log.nguoiThucHien.ma, vaiTro: log.nguoiThucHien.vaiTro }, { ma: 'QL-001', vaiTro: 'QuanLy' });
    assert.equal(log.thoiDiem.getTime(), t.MOC.getTime());
    assert.deepEqual(log.doiTuong, { loai: 'LopHoc', ma: 'IE65-K12' });
    assert.ok(log.duLieuCu.every((b) => b.trangThaiLich === 'Nhap' && b.phanCong.length === 0));
    assert.ok(log.duLieuMoi.every((b) => b.trangThaiLich === 'ChoGVXacNhan' && b.phanCong.some((p) => p.maNhanSu === 'GV-005')));
    assert.equal(log.duLieuMoi.length, r.body.data.soBuoi);
  });

  it('TC-SX-10 · Thao tác bị từ chối (409) không để lại nhật ký – nhật ký và dữ liệu cùng được ghi hoặc cùng hủy', async () => {
    const truoc = await models.AuditLog.countDocuments();
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-003' } });
    assert.equal(r.status, 409);
    assert.equal(await models.AuditLog.countDocuments(), truoc);
  });

  it('TC-SX-11 · Tạo / hủy đăng ký phòng, xin nghỉ, từ chối yêu cầu, lưu lịch rảnh đều được ghi nhật ký', async () => {
    const ql = await t.nhanSu(TK.QL);
    const dk = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql, body: { maPhong: 'P402', ngaySuDung: '2026-11-19', maCa: 'CA1' } });
    assert.equal(dk.status, 201);
    const huy = await t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk.body.data.maDangKy}/huy`, { token: ql });
    assert.equal(huy.status, 200);
    const logHuy = await models.AuditLog.findOne({ maYeuCau: huy.headers.get('x-request-id') }).lean();
    assert.equal(logHuy.hanhDong, 'DANG_KY_PHONG.HUY');
    assert.equal(logHuy.duLieuCu.trangThaiDangKy, 'DaDangKy');
    assert.equal(logHuy.duLieuMoi.trangThaiDangKy, 'DaHuy');

    const ca = await models.LichDay.findOne({ maLop: 'GT-A2-08', ngayDay: ngayDate('2026-11-11') }).lean();
    const nghi = await t.goi('POST', `/phu-huynh/ca-hoc/${ca._id}/xin-nghi`, { token: await t.phuHuynh(...PH.AN), body: { lyDoXinNghi: 'NghiOm' } });
    assert.equal(nghi.status, 201);
    const logNghi = await models.AuditLog.findOne({ maYeuCau: nghi.headers.get('x-request-id') }).lean();
    assert.equal(logNghi.hanhDong, 'XIN_NGHI.TAO');
    assert.equal(logNghi.nguoiThucHien.vaiTro, 'PhuHuynhHocVien');
    assert.equal(logNghi.duLieuMoi.trangThaiNghi, 'BaoVang');

    const phieu = (await models.PhanHoiGopY.findOne({ trangThaiXuLy: 'ChoXuLy' }).lean())._id;
    const tc = await t.goi('PATCH', `/quan-ly/phan-hoi/${phieu}/trang-thai`, { token: ql, body: { trangThaiMoi: 'TuChoi', ghiChu: 'Không đủ điều kiện' } });
    assert.equal(tc.status, 200);
    const logTc = await models.AuditLog.findOne({ maYeuCau: tc.headers.get('x-request-id') }).lean();
    assert.equal(logTc.hanhDong, 'PHAN_HOI.TU_CHOI');
    assert.equal(logTc.duLieuCu.trangThaiXuLy, 'ChoXuLy');
    assert.equal(logTc.duLieuMoi.trangThaiXuLy, 'TuChoi');
  });

  it('TC-SX-12 · Nhật ký không thể bị sửa hay xóa qua ứng dụng', async () => {
    const log = await models.AuditLog.findOne().lean();
    await assert.rejects(models.AuditLog.updateOne({ _id: log._id }, { $set: { hanhDong: 'GIA_MAO' } }));
    await assert.rejects(models.AuditLog.findOneAndUpdate({ _id: log._id }, { $set: { hanhDong: 'GIA_MAO' } }));
    await assert.rejects(models.AuditLog.deleteOne({ _id: log._id }));
    await assert.rejects(models.AuditLog.deleteMany({}));
    await assert.rejects(models.AuditLog.replaceOne({ _id: log._id }, { hanhDong: 'X' }));
    assert.equal((await models.AuditLog.findById(log._id).lean()).hanhDong, log.hanhDong);
  });

  it('TC-SX-13 · Thêm hồ sơ giáo viên ghi nhật ký nhưng tuyệt đối không lưu mật khẩu (kể cả dạng băm)', async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ hoTen: 'Phan Văn Khải', soDienThoai: '0905123987', email: 'khai.phan@gmail.com', diaChi: 'Đà Nẵng', loaiNhanSu: 'GiaoVien', matKhau: 'MatKhauTam123' })) f.append(k, v);
    f.append('bangCap', new Blob([PNG], { type: 'image/png' }), 'bang.png');
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: f });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const log = await models.AuditLog.findOne({ maYeuCau: r.headers.get('x-request-id') }).lean();
    assert.equal(log.hanhDong, 'HO_SO_NHAN_SU.TAO');
    assert.equal(log.duLieuCu, null);
    assert.equal(log.duLieuMoi.email, 'khai.phan@gmail.com');
    const chuoi = JSON.stringify(log);
    const bam = (await models.NguoiDung.findOne({ email: 'khai.phan@gmail.com' }).select('+matKhau').lean()).matKhau;
    assert.ok(!chuoi.includes('MatKhauTam123') && !chuoi.includes(bam) && !/matKhau"/.test(chuoi));
  });

  it('TC-SX-14 · Quản lý tra cứu nhật ký theo hành động, có phân trang; Giáo viên không được xem (403)', async () => {
    const r = await t.goi('GET', '/quan-ly/nhat-ky?hanhDong=PHAN_CONG&soDong=5', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.tong >= 1);
    assert.ok(r.body.data.ds.every((x) => x.hanhDong.startsWith('PHAN_CONG')));
    assert.equal((await t.goi('GET', '/quan-ly/nhat-ky', { token: await t.nhanSu(TK.LAN) })).status, 403);
    assert.equal((await t.goi('GET', '/quan-ly/nhat-ky?tuNgay=2026-13-45', { token: await t.nhanSu(TK.QL) })).status, 400);
  });
});

/* ======================================================================================= */
describe('P4 · Bảo mật production', () => {
  before(async () => { await t.napLai(); });

  it('TC-SX-15 · CORS: chỉ tên miền giao diện khai báo được gọi API; tên miền lạ → 403; không có Origin vẫn dùng được', async () => {
    const may = await moMayChu({ corsOrigin: ['https://lichday.broadway.edu.vn'] });
    try {
      const dung = await fetch(`${may.base}/suc-khoe`, { headers: { Origin: 'https://lichday.broadway.edu.vn' } });
      assert.equal(dung.status, 200);
      assert.equal(dung.headers.get('access-control-allow-origin'), 'https://lichday.broadway.edu.vn');
      const la = await fetch(`${may.base}/auth/dang-nhap`, {
        method: 'POST', headers: { Origin: 'https://gia-mao.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ tenDangNhap: 'quanly', matKhau: 'x' }),
      });
      assert.equal(la.status, 403);
      assert.equal(la.headers.get('access-control-allow-origin'), null);
      assert.equal((await la.json()).message, M.NGUON_KHONG_DUOC_PHEP);
      const preflight = await fetch(`${may.base}/auth/dang-nhap`, {
        method: 'OPTIONS', headers: { Origin: 'https://lichday.broadway.edu.vn', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' },
      });
      assert.equal(preflight.status, 204);
      assert.equal((await fetch(`${may.base}/suc-khoe`)).status, 200);
    } finally { await may.dong(); }
  });

  it('TC-SX-16 · Chống dò mật khẩu: sai quá ngưỡng → 429 tiếng Việt; tài khoản khác và lần đăng nhập đúng không bị tính', async () => {
    const may = await moMayChu({ gioiHan: { apiPhut: 0, dangNhap: 3 } });
    const dn = (tenDangNhap, matKhau) => fetch(`${may.base}/auth/dang-nhap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenDangNhap, matKhau }) });
    try {
      for (let i = 0; i < 5; i += 1) assert.equal((await dn('quanly', MAT_KHAU_MAU)).status, 200, 'Đăng nhập đúng không bị tính');
      for (let i = 0; i < 3; i += 1) assert.equal((await dn('gvnguyenlan', `sai-${i}`)).status, 401);
      const bi = await dn('gvnguyenlan', MAT_KHAU_MAU);
      assert.equal(bi.status, 429);
      const body = await bi.json();
      assert.equal(body.message, M.DN_QUA_NHIEU_LAN);
      assert.equal(body.code, 'DANG_NHAP_QUA_NHIEU_LAN');
      assert.ok(Number(bi.headers.get('retry-after')) > 0);
      assert.equal((await dn('gvtranquan', MAT_KHAU_MAU)).status, 200, 'Tài khoản khác vẫn đăng nhập được');
    } finally { await may.dong(); }
  });

  it('TC-SX-17 · Chặn spam API: vượt số yêu cầu / phút → 429 "Bạn thao tác quá nhanh…"; kiểm tra sức khỏe không bị chặn', async () => {
    const may = await moMayChu({ gioiHan: { apiPhut: 5, dangNhap: 0 } });
    try {
      const token = await t.nhanSu(TK.QL);
      const kq = [];
      for (let i = 0; i < 7; i += 1) kq.push((await fetch(`${may.base}/danh-muc/ca-hoc`, { headers: { Authorization: `Bearer ${token}` } })).status);
      assert.deepEqual(kq, [200, 200, 200, 200, 200, 429, 429]);
      const r = await fetch(`${may.base}/danh-muc/ca-hoc`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal((await r.json()).message, M.QUA_NHIEU_YEU_CAU);
      assert.equal((await fetch(`${may.base}/suc-khoe`)).status, 200);
    } finally { await may.dong(); }
  });

  it('TC-SX-18 · Tài khoản mới cấp phải đổi mật khẩu tạm ở lần đăng nhập đầu; token cũ bị vô hiệu sau khi đổi', async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ hoTen: 'Lý Thu Hà', soDienThoai: '0905111222', email: 'thuha.ly@gmail.com', diaChi: 'Huế', loaiNhanSu: 'TroGiang' })) f.append(k, v);
    f.append('bangCap', new Blob([PNG], { type: 'image/png' }), 'bang.png');
    const tao = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: f });
    assert.equal(tao.status, 201);
    const { tenDangNhap, matKhauTam } = tao.body.data.taiKhoan;
    assert.ok(matKhauTam);

    const dn = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap, matKhau: matKhauTam } });
    assert.equal(dn.status, 200);
    assert.equal(dn.body.data.nguoiDung.mustChangePassword, true);
    const cu = dn.body.data.token;

    const chan = await t.goi('GET', '/giao-vien/lich-day', { token: cu });
    assert.equal(chan.status, 403);
    assert.equal(chan.body.code, 'PHAI_DOI_MAT_KHAU');
    assert.equal((await t.goi('GET', '/thong-bao', { token: cu })).status, 403);
    assert.equal((await t.goi('GET', '/auth/toi', { token: cu })).body.data.mustChangePassword, true);

    const doi = (body, token = cu) => t.goi('POST', '/auth/doi-mat-khau', { token, body });
    assert.equal((await doi({ matKhauHienTai: matKhauTam, matKhauMoi: 'ngan1', xacNhanMatKhau: 'ngan1' })).body.message, M.DMK_KHONG_DU_MANH);
    assert.equal((await doi({ matKhauHienTai: matKhauTam, matKhauMoi: 'chicochu', xacNhanMatKhau: 'chicochu' })).status, 400);
    assert.equal((await doi({ matKhauHienTai: matKhauTam, matKhauMoi: 'ThuHa2026', xacNhanMatKhau: 'ThuHa2027' })).body.message, M.DMK_XAC_NHAN_KHONG_KHOP);
    assert.equal((await doi({ matKhauHienTai: 'sai-mat-khau', matKhauMoi: 'ThuHa2026', xacNhanMatKhau: 'ThuHa2026' })).body.message, M.DMK_SAI_MAT_KHAU_HIEN_TAI);
    assert.equal((await doi({ matKhauHienTai: matKhauTam, matKhauMoi: matKhauTam, xacNhanMatKhau: matKhauTam })).status, 400);
    assert.equal((await doi({ matKhauHienTai: { $ne: 1 }, matKhauMoi: 'ThuHa2026', xacNhanMatKhau: 'ThuHa2026' })).status, 400);

    const ok = await doi({ matKhauHienTai: matKhauTam, matKhauMoi: 'ThuHa2026', xacNhanMatKhau: 'ThuHa2026' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.nguoiDung.mustChangePassword, false);
    const moi = ok.body.data.token;

    const het = await t.goi('GET', '/auth/toi', { token: cu });
    assert.equal(het.status, 401);
    assert.equal(het.body.message, M.PHIEN_HET_HIEU_LUC);
    assert.equal((await t.goi('GET', '/giao-vien/lich-day', { token: moi })).status, 200);
    assert.equal((await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap, matKhau: matKhauTam } })).status, 401);
    const lai = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap, matKhau: 'ThuHa2026' } });
    assert.equal(lai.status, 200);
    assert.equal(lai.body.data.nguoiDung.mustChangePassword, false);

    const nd = await models.NguoiDung.findOne({ tenDangNhap }).lean();
    const log = await models.AuditLog.findOne({ hanhDong: 'TAI_KHOAN.DOI_MAT_KHAU', 'doiTuong.ma': nd._id }).lean();
    assert.ok(log);
    assert.equal(log.nguoiThucHien.ma, nd._id);
  });

  it('TC-SX-19 · Phụ huynh không có chức năng đổi mật khẩu (403)', async () => {
    const r = await t.goi('POST', '/auth/doi-mat-khau', { token: await t.phuHuynh(...PH.AN), body: { matKhauHienTai: 'a', matKhauMoi: 'b', xacNhanMatKhau: 'b' } });
    assert.equal(r.status, 403);
  });

  it('TC-SX-20 · Cấu hình production thiếu / yếu (MongoDB không xác thực, JWT ngắn, CORS "*", tắt giới hạn tần suất, giờ giả lập) → từ chối khởi động', () => {
    const { execFileSync } = require('child_process');
    const chay = (bien) => {
      try {
        execFileSync(process.execPath, ['-e', "require('./src/config/env').kiemTraCauHinh()"], {
          cwd: path.join(__dirname, '..'), env: { PATH: process.env.PATH, NODE_ENV: 'production', ...bien }, stdio: 'pipe',
        });
        return '';
      } catch (e) { return String(e.stderr); }
    };
    assert.match(chay({}), /MONGODB_URI[\s\S]*JWT_SECRET[\s\S]*CORS_ORIGIN/);
    assert.match(chay({ MONGODB_URI: 'mongodb://db/x', JWT_SECRET: 'ngan', CORS_ORIGIN: '*' }), /JWT_SECRET phải[\s\S]*"\*"/);
    assert.match(chay({ MONGODB_URI: 'mongodb://db/x', JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://a.vn/' }), /không hợp lệ/);
    assert.match(chay({ MONGODB_URI: 'mongodb://db/x', MONGODB_USER: 'broadway_app', MONGODB_PASSWORD: 'p'.repeat(24), JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://lichday.broadway.edu.vn', FAKE_NOW: '2026-01-01T00:00:00Z' }), /FAKE_NOW/);
    assert.match(chay({ MONGODB_URI: 'mongodb://db/x', MONGODB_USER: 'broadway_app', MONGODB_PASSWORD: 'p'.repeat(24), JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://lichday.broadway.edu.vn', RATE_LIMIT_DANG_NHAP: '0' }), /giới hạn tần suất/);
    // MongoDB không xác thực bị từ chối; tài khoản trong chuỗi kết nối (Atlas) được chấp nhận
    assert.match(chay({ MONGODB_URI: 'mongodb://db/x', JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://lichday.broadway.edu.vn' }), /phải bật xác thực/);
    assert.equal(chay({ MONGODB_URI: 'mongodb+srv://u:p@cum.mongodb.net/x', JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://lichday.broadway.edu.vn' }), '');
    assert.equal(chay({ MONGODB_URI: 'mongodb://db/x', MONGODB_USER: 'broadway_app', MONGODB_PASSWORD: 'p'.repeat(24), JWT_SECRET: 'x'.repeat(40), CORS_ORIGIN: 'https://lichday.broadway.edu.vn' }), '');
  });
});

/* ======================================================================================= */
describe('P1 · Dữ liệu gốc an toàn (init-master-data) và chặn nạp dữ liệu demo nhầm', () => {
  before(async () => { await t.napLai(); });

  it('TC-SX-21 · Chạy init-master-data trên CSDL đang có dữ liệu: không xóa, không ghi đè, không tạo thêm gì', async () => {
    const { khoiTaoDuLieuGoc } = require('../src/seed/khoiTaoDuLieuGoc');
    const DS = ['NguoiDung', 'PhongHoc', 'CaHoc', 'MonHoc', 'LopHoc', 'LichDay', 'DangKyPhong', 'PhanHoiGopY', 'PhuHuynhHocVien', 'LichRanh'];
    await models.PhongHoc.updateOne({ _id: 'P101' }, { $set: { moTa: 'Đã sửa bởi Quản lý' } });
    const dem = async () => Object.fromEntries(await Promise.all(DS.map(async (m) => [m, await models[m].countDocuments()])));
    const truoc = await dem();
    await khoiTaoDuLieuGoc({ log: () => {} });
    await khoiTaoDuLieuGoc({ log: () => {} });
    assert.deepEqual(await dem(), truoc);
    assert.equal((await models.PhongHoc.findById('P101').lean()).moTa, 'Đã sửa bởi Quản lý');
  });

  it('TC-SX-22 · CSDL chưa có Quản lý: tạo đúng 1 tài khoản Admin với mustChangePassword = true; chạy lại không tạo thêm', async () => {
    const { khoiTaoDuLieuGoc } = require('../src/seed/khoiTaoDuLieuGoc');
    await models.NguoiDung.collection.deleteMany({ loaiNguoiDung: 'QuanLy' });
    const thongDiep = [];
    await khoiTaoDuLieuGoc({ log: (s) => thongDiep.push(String(s)) });
    await khoiTaoDuLieuGoc({ log: () => {} });
    const ds = await models.NguoiDung.find({ loaiNguoiDung: 'QuanLy' }).lean();
    assert.equal(ds.length, 1);
    assert.equal(ds[0].tenDangNhap, 'admin');
    assert.equal(ds[0].mustChangePassword, true);
    const mk = thongDiep.join('\n').match(/Bw![A-Za-z0-9_-]+9a/)?.[0];
    assert.ok(mk, 'Mật khẩu tạm phải được in một lần cho người triển khai');
    const dn = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: 'admin', matKhau: mk } });
    assert.equal(dn.status, 200);
    assert.equal(dn.body.data.nguoiDung.mustChangePassword, true);
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: dn.body.data.token })).body.code, 'PHAI_DOI_MAT_KHAU');
  });

  it('TC-SX-23 · Nạp dữ liệu demo bị từ chối khi CSDL đã có dữ liệu thật (không có dấu hiệu dữ liệu demo)', async () => {
    const { napDuLieuMau, DAU_HIEU_DEMO } = require('../src/seed/duLieuMau');
    await models.BoDem.deleteOne({ _id: DAU_HIEU_DEMO });
    const soLich = await models.LichDay.countDocuments();
    await assert.rejects(napDuLieuMau({ xoaCu: true }), /dữ liệu/i);
    assert.equal(await models.LichDay.countDocuments(), soLich);
    await models.BoDem.create({ _id: DAU_HIEU_DEMO, giaTri: 1 });
  });
});

/* ======================================================================================= */
describe('P5 · Dữ liệu lạ trên mọi API không làm máy chủ lỗi', () => {
  before(async () => { await t.napLai(); });

  /** Đọc bảng định tuyến từ routes/index.js */
  function dsDuongDan() {
    const nguon = fs.readFileSync(path.join(__dirname, '../src/routes/index.js'), 'utf8');
    const tienTo = { api: '', authRouter: '/auth', danhMuc: '/danh-muc', quanLy: '/quan-ly', giaoVien: '/giao-vien', phuHuynh: '/phu-huynh' };
    const ds = [];
    for (const m of nguon.matchAll(/^(\w+)\.(get|post|put|patch|delete)\('([^']+)'/gm)) {
      if (tienTo[m[1]] !== undefined) ds.push({ method: m[2].toUpperCase(), duong: tienTo[m[1]] + m[3], nhom: m[1] });
    }
    return ds;
  }
  const RAC = [
    '{"hỏng json', '[]', 'null', '123', '"chuoi"',
    JSON.stringify({ $where: 'sleep(1000)', maPhong: { $gt: '' }, ngaySuDung: { $ne: null }, maCa: ['CA1', 'CA2'] }),
    JSON.stringify({ __proto__: { laQuanTri: true }, constructor: { prototype: { x: 1 } }, thu: 'abc', maLop: { a: { b: { c: [1, 2, 3] } } } }),
    JSON.stringify({ maNhanSu: 'x'.repeat(5000), lyDoXinNghi: 12345, matKhau: [], tenDangNhap: {}, ngayDay: '2026-02-31', tuNgay: 'khong-phai-ngay', thayDoi: 'abc', buoiBu: [null, 1, 'x'] }),
    JSON.stringify({ thayDoi: [{ maLichDay: { $gt: '' } }], buoiBu: [{ maLop: 'IE65-K12', ngayDay: '9999-99-99', maCa: { $ne: 1 } }], cacRanh: [{ ngayRanh: 'x', maCa: null }] }),
  ];
  const THAM_SO_RAC = ['%24ne', 'x'.repeat(300), '000000000000000000000000', '..%2F..%2Fetc%2Fpasswd', '%00'];

  it('TC-SX-24 · Mọi API × dữ liệu rác (JSON hỏng, toán tử $, kiểu sai, chuỗi rất dài, ngày sai) → không có phản hồi 5xx', async () => {
    const token = {
      quanLy: await t.nhanSu(TK.QL), danhMuc: await t.nhanSu(TK.QL), giaoVien: await t.nhanSu(TK.LAN),
      phuHuynh: await t.phuHuynh(...PH.AN), authRouter: await t.nhanSu(TK.QL), api: await t.nhanSu(TK.QL),
    };
    const loi = [];
    let soYeuCau = 0;
    for (const { method, duong, nhom } of dsDuongDan()) {
      if (duong === '/auth/doi-mat-khau') continue; // đổi mật khẩu thật sẽ vô hiệu token đang dùng
      for (const thamSo of THAM_SO_RAC) {
        const url = duong.replace(/:\w+/g, thamSo);
        for (const body of method === 'GET' ? [undefined] : RAC) {
          for (const tq of [`?q=${encodeURIComponent('{"$gt":""}')}&tuNgay=abc&trang=-1&soDong=1e9`, '?a[$ne]=1&a[b][c]=2']) {
            soYeuCau += 1;
            const r = await t.goi(method, url + tq, { token: token[nhom], body });
            if (r.status >= 500) loi.push(`${method} ${url}${tq} ${String(body).slice(0, 60)} → ${r.status} ${JSON.stringify(r.body)}`);
          }
        }
      }
    }
    assert.deepEqual(loi, [], `${loi.length}/${soYeuCau} yêu cầu lỗi 5xx:\n${loi.slice(0, 40).map((x) => x.replace(/x{20,}/g, 'x…x')).join('\n')}`);
    assert.equal((await t.goi('GET', '/suc-khoe')).status, 200);
  });

  it('TC-SX-25 · JSON hỏng → 400 tiếng Việt; thân yêu cầu quá lớn → 413; API không tồn tại → 404; lỗi có mã yêu cầu để tra cứu', async () => {
    const hong = await t.goi('POST', '/auth/dang-nhap', { body: '{"tenDangNhap": ' });
    assert.equal(hong.status, 400);
    assert.equal(hong.body.message, M.HS_KHONG_HOP_LE);
    const lon = await t.goi('POST', '/auth/dang-nhap', { body: JSON.stringify({ tenDangNhap: 'x'.repeat(2 * 1024 * 1024) }) });
    assert.equal(lon.status, 413);
    const khong = await t.goi('GET', '/khong-ton-tai');
    assert.equal(khong.status, 404);
    assert.equal(khong.body.message, M.KHONG_TIM_THAY_API);
    assert.ok(khong.headers.get('x-request-id'));
  });
});
