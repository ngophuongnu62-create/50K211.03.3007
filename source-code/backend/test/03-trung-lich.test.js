/**
 * Ưu tiên 3 – Kiểm thử TRÙNG LỊCH
 * Trùng phòng (UC_2 BR2, UC_6.1 BR01, UC_6.2 BR04), trùng giáo viên / sai lịch rảnh / sai chuyên môn (UC_6.3 BR03, UC_6.2 BR03),
 * không xác nhận lịch tuần khi còn xung đột (UC_6.2 BR06), gửi đồng thời và chỉ mục duy nhất ở tầng CSDL.
 *
 * Dữ liệu mẫu tuần tới (16–22/11/2026): IEF-K15 P.201 Ca 3 T3,T5 (GV Lan) · GT-A2-08 P.102 Ca 2 T2,T4 (GV Quân)
 * · GS-MILKY P.302 Ca 3 T2–T5 · Kids-K03 P.101 Ca 2 T7,CN · IE65-K12 (Nháp) P.202 Ca 3 T3,T5 · TOEIC-K06 (Nháp) P.301 Ca 2 T2,T4
 * · Đăng ký phòng: P.101 CN 22/11 Ca 2 (trùng Kids-K03), P.202 T5 12/11 Ca 3.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/constants/messages');
const { khoiDong, TK } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
});
after(async () => { await t.dong(); });

const ngayDate = (s) => new Date(`${s}T00:00:00Z`);
const buoi = (maLop, ngay) => models.LichDay.findOne({ maLop, ngayDay: ngayDate(ngay), trangThaiLich: { $ne: 'DaHuy' } }).lean();

describe('Trùng phòng khi đăng ký phòng (UC_2)', () => {
  before(async () => { await t.napLai(); });

  it('TC-TL-01 · Kiểm tra phòng đang có lớp học (P.102 Thứ Hai 16/11 Ca 2) → 409 "Phòng học không còn trống…" (5.a)', async () => {
    const r = await t.goi('POST', '/quan-ly/phong-hoc/kiem-tra', { token: await t.nhanSu(TK.QL), body: { maPhong: 'P102', ngaySuDung: '2026-11-16', maCa: 'CA2' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.PHONG_KHONG_CON_TRONG);
  });

  it('TC-TL-02 · Đăng ký phòng đã có đăng ký khác (P.202 Thứ Năm 12/11 Ca 3) → 409, không tạo bản ghi mới', async () => {
    const truoc = await models.DangKyPhong.countDocuments();
    const r = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: await t.nhanSu(TK.QL), body: { maPhong: 'P202', ngaySuDung: '2026-11-12', maCa: 'CA3' } });
    assert.equal(r.status, 409);
    assert.equal(await models.DangKyPhong.countDocuments(), truoc);
  });

  it('TC-TL-03 · Đăng ký phòng trùng buổi của lịch còn ở trạng thái Nháp (IE65-K12, P.202 Thứ Ba 17/11 Ca 3) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: await t.nhanSu(TK.QL), body: { maPhong: 'P202', ngaySuDung: '2026-11-17', maCa: 'CA3' } });
    assert.equal(r.status, 409);
  });

  it('TC-TL-04 · 5 yêu cầu đăng ký cùng phòng, cùng ca gửi đồng thời → chỉ 1 thành công, 4 bị từ chối 409', async () => {
    const ql = await t.nhanSu(TK.QL);
    const body = { maPhong: 'P401', ngaySuDung: '2026-11-18', maCa: 'CA1' };
    const kq = await Promise.all(Array.from({ length: 5 }, () => t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql, body })));
    const ma = kq.map((r) => r.status).sort();
    assert.deepEqual(ma, [201, 409, 409, 409, 409]);
    assert.equal(await models.DangKyPhong.countDocuments({ maPhong: 'P401', ngaySuDung: ngayDate('2026-11-18'), maCa: 'CA1', trangThaiDangKy: 'DaDangKy' }), 1);
  });

  it('TC-TL-05 · Hủy đăng ký rồi đăng ký lại đúng phòng, ca đó → 201 (đăng ký đã hủy không giữ chỗ)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const dk = await models.DangKyPhong.findOne({ maPhong: 'P401', trangThaiDangKy: 'DaDangKy' }).lean();
    assert.equal((await t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk._id}/huy`, { token: ql })).status, 200);
    const r = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql, body: { maPhong: 'P401', ngaySuDung: '2026-11-18', maCa: 'CA1' } });
    assert.equal(r.status, 201);
  });
});

describe('Trùng lịch khi tạo lịch dạy mới (UC_6.1)', () => {
  before(async () => { await t.napLai(); });
  const thamSo = { maLop: 'IE65-K13' };

  it('TC-TL-06 · Mọi phương án hệ thống đề xuất đều có phòng trống và giáo viên đúng chuyên môn rảnh (BR01)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/de-xuat', { token: ql, body: thamSo });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.phuongAn.length > 0);
    for (const pa of r.body.data.phuongAn) {
      assert.ok(pa.giaoVienPhuHop.length > 0);
      const kt = await t.goi('POST', '/quan-ly/quan-ly-lich/kiem-tra-phuong-an', { token: ql, body: { ...thamSo, thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong } });
      assert.equal(kt.status, 200, `Phương án ${pa.soThuTu}`);
    }
  });

  it('TC-TL-07 · Sửa phương án sang phòng đang có lớp (P.201 Thứ 3, 5 Ca 3) → 409 "Thời gian hoặc phòng học bị trùng" (7.b)', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/kiem-tra-phuong-an', { token: await t.nhanSu(TK.QL), body: { ...thamSo, thu: [2, 4], maCa: 'CA3', maPhong: 'P201' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.TL_TRUNG);
    assert.ok(r.body.data.lyDo.some((x) => x.includes('P.201')));
  });

  it('TC-TL-08 · Sửa phương án sang phòng không đủ sức chứa (P3, 15 chỗ cho lớp 18 học viên) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/kiem-tra-phuong-an', { token: await t.nhanSu(TK.QL), body: { ...thamSo, thu: [1, 3], maCa: 'CA1', maPhong: 'P3' } });
    assert.equal(r.status, 409);
    assert.ok(r.body.data.lyDo.some((x) => x.includes('sức chứa')));
  });

  it('TC-TL-09 · Sửa phương án vào ca không giáo viên IELTS nào rảnh (Chủ Nhật Ca 2) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/kiem-tra-phuong-an', { token: await t.nhanSu(TK.QL), body: { ...thamSo, thu: [0], maCa: 'CA2', maPhong: 'P401' } });
    assert.equal(r.status, 409);
    assert.ok(r.body.data.lyDo.some((x) => x.includes('giáo viên')));
  });

  it('TC-TL-10 · Lưu phương án trùng phòng (bỏ qua bước kiểm tra) → 409, không tạo buổi dạy nào', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich', { token: await t.nhanSu(TK.QL), body: { ...thamSo, thu: [2, 4], maCa: 'CA3', maPhong: 'P201' } });
    assert.equal(r.status, 409);
    assert.equal(await models.LichDay.countDocuments({ maLop: 'IE65-K13' }), 0);
  });

  it('TC-TL-11 · Hai Quản lý cùng lưu lịch cho một lớp cùng lúc → 1 thành công, 1 bị từ chối; lớp không có buổi trùng', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ql2 = await t.nhanSu('quanly2');
    const pa = (await t.goi('POST', '/quan-ly/quan-ly-lich/de-xuat', { token: ql, body: thamSo })).body.data.phuongAn[0];
    const body = { ...thamSo, thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong };
    const [a, b] = await Promise.all([
      t.goi('POST', '/quan-ly/quan-ly-lich', { token: ql, body }),
      t.goi('POST', '/quan-ly/quan-ly-lich', { token: ql2, body }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    const ds = await models.LichDay.find({ maLop: 'IE65-K13' }).lean();
    assert.equal(ds.length, pa.soBuoi);
    assert.equal(new Set(ds.map((x) => `${x.ngayDay.toISOString()}|${x.maCa}`)).size, ds.length);
  });
});

describe('Trùng lịch khi phân công giáo viên (UC_6.3)', () => {
  before(async () => { await t.napLai(); });

  it('TC-TL-12 · Danh sách đề xuất không chứa giáo viên đã có lịch dạy cùng ca (Lan dạy IEF-K15 Thứ 3, 5 Ca 3)', async () => {
    const r = await t.goi('GET', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 200);
    assert.ok(!r.body.data.deXuat.some((g) => g.maNhanSu === 'GV-001'));
    assert.ok(r.body.data.deXuat.length > 0);
  });

  it('TC-TL-13 · Chọn ngoài đề xuất giáo viên trùng lịch (Lan) → 409 "Cảnh báo xung đột lịch dạy…" (4.a.8)', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/kiem-tra-giao-vien', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-001' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.PC_XUNG_DOT);
  });

  it('TC-TL-14 · Cố lưu phân công giáo viên trùng lịch (bỏ qua bước kiểm tra) → 409, lịch vẫn ở trạng thái Nháp', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-001' } });
    assert.equal(r.status, 409);
    assert.equal(await models.LichDay.countDocuments({ maLop: 'IE65-K12', trangThaiLich: { $ne: 'Nhap' } }), 0);
    assert.equal(await models.LichDay.countDocuments({ maLop: 'IE65-K12', 'phanCong.0': { $exists: true } }), 0);
  });

  it('TC-TL-15 · Phân công giáo viên sai chuyên môn (Quân – Giao tiếp, cho lớp IELTS) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-002' } });
    assert.equal(r.status, 409);
  });

  it('TC-TL-16 · Phân công giáo viên đúng chuyên môn nhưng không có lịch rảnh ca đó (Hà – TOEIC-K06 Ca 2) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-003' } });
    assert.equal(r.status, 409);
    assert.ok((r.body.data?.lyDo || []).some((x) => /rảnh/i.test(x)), JSON.stringify(r.body.data));
  });

  it('TC-TL-17 · Phân công trợ giảng vào vai trò giáo viên (Lê Hoàng Anh) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/kiem-tra-giao-vien', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'TG-001' } });
    assert.equal(r.status, 409);
  });

  it('TC-TL-18 · Phân công giáo viên phù hợp (David Miller) → 200, lịch chuyển "Chờ GV xác nhận"', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: await t.nhanSu(TK.QL), body: { maNhanSu: 'GV-005' } });
    assert.equal(r.status, 200);
    assert.equal(await models.LichDay.countDocuments({ maLop: 'IE65-K12', trangThaiLich: 'ChoGVXacNhan' }), r.body.data.soBuoi);
  });
});

describe('Trùng lịch khi lập lịch tuần (UC_6.2)', () => {
  before(async () => { await t.napLai(); });

  it('TC-TL-19 · Hệ thống phát hiện buổi bị ảnh hưởng: P.101 Chủ Nhật 22/11 Ca 2 trùng đăng ký sự kiện; GV Quân bận Thứ Tư 18/11', async () => {
    const r = await t.goi('GET', '/quan-ly/quan-ly-lich/tuan-toi', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 200);
    const ds = r.body.data.buoiBiAnhHuong;
    assert.ok(ds.some((b) => b.maLop === 'Kids-K03' && b.ngayDay === '2026-11-22' && b.lyDo.join(' ').includes('P.101')));
    assert.ok(ds.some((b) => b.maLop === 'GT-A2-08' && b.ngayDay === '2026-11-18' && b.lyDo.join(' ').includes('Trần Minh Quân')));
    // Phòng đề xuất phải thật sự trống đúng ngày, ca (BR04)
    const kids = ds.find((b) => b.maLop === 'Kids-K03');
    for (const p of kids.deXuat.phong) assert.notEqual(p.maPhong, 'P101');
  });

  it('TC-TL-20 · Xác nhận lịch tuần nhưng giữ phòng đang bị đăng ký sự kiện → 409 "Lịch tuần bị xung đột!" (10a)', async () => {
    const b = await buoi('Kids-K03', '2026-11-22');
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { token: await t.nhanSu(TK.QL), body: { thayDoi: [{ maLichDay: b._id, maPhong: 'P101' }] } });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.LT_XUNG_DOT);
  });

  it('TC-TL-21 · Đổi ca buổi học sang phòng đang có lớp khác (P.302 Thứ Tư Ca 3 – GS Milky) → 409', async () => {
    const b = await buoi('GT-A2-08', '2026-11-18');
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { token: await t.nhanSu(TK.QL), body: { thayDoi: [{ maLichDay: b._id, maCa: 'CA3', maPhong: 'P302', maGiaoVien: 'GV-008' }] } });
    assert.equal(r.status, 409);
    assert.ok(r.body.data.chiTiet.length > 0);
  });

  it('TC-TL-22 · Thêm buổi bù với giáo viên đang dạy lớp khác cùng ca (Lan, Thứ Ba 17/11 Ca 3) → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', {
      token: await t.nhanSu(TK.QL),
      body: { buoiBu: [{ maLop: 'GT-A2-08', ngayDay: '2026-11-17', maCa: 'CA3', maPhong: 'P401', maGiaoVien: 'GV-001', soTiet: 3 }] },
    });
    assert.equal(r.status, 409);
    assert.ok(r.body.data.chiTiet.some((x) => x.includes('Nguyễn Thị Lan')), JSON.stringify(r.body.data.chiTiet));
  });

  it('TC-TL-23 · Thêm buổi bù trùng đúng ca học sẵn có của chính lớp đó → 409', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', {
      token: await t.nhanSu(TK.QL),
      body: { buoiBu: [{ maLop: 'GT-A2-08', ngayDay: '2026-11-16', maCa: 'CA2', maPhong: 'P401', maGiaoVien: 'GV-008', soTiet: 3 }] },
    });
    assert.equal(r.status, 409);
  });

  it('TC-TL-24 · Đổi giáo viên sang người sai chuyên môn (Mandy – Thiếu nhi cho lớp Giao tiếp) → 409', async () => {
    const b = await buoi('GT-A2-08', '2026-11-18');
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { token: await t.nhanSu(TK.QL), body: { thayDoi: [{ maLichDay: b._id, maGiaoVien: 'GV-006' }] } });
    assert.equal(r.status, 409);
  });

  it('TC-TL-25 · Sau các lần bị từ chối, dữ liệu lịch tuần không bị thay đổi (BR06)', async () => {
    const quan = await buoi('GT-A2-08', '2026-11-18');
    assert.equal(quan.trangThaiLich, 'DaPhatHanh');
    assert.equal(quan.maCa, 'CA2');
    assert.equal(quan.phanCong.find((p) => p.vaiTro === 'GiaoVien').maNhanSu, 'GV-002');
    assert.equal(await models.LichDay.countDocuments({ maLop: 'GT-A2-08', ngayDay: { $in: [ngayDate('2026-11-16'), ngayDate('2026-11-17')] } }), 1);
  });

  it('TC-TL-26 · Chọn giáo viên, phòng theo đề xuất của hệ thống → 200, các buổi chuyển "Chờ GV xác nhận"', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ds = (await t.goi('GET', '/quan-ly/quan-ly-lich/tuan-toi', { token: ql })).body.data.buoiBiAnhHuong;
    const quan = ds.find((b) => b.maLop === 'GT-A2-08');
    const kids = ds.find((b) => b.maLop === 'Kids-K03');
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', {
      token: ql,
      body: { thayDoi: [{ maLichDay: quan.maLichDay, maGiaoVien: quan.deXuat.giaoVien[0].maNhanSu }, { maLichDay: kids.maLichDay, maPhong: kids.deXuat.phong[0].maPhong }] },
    });
    assert.equal(r.status, 200);
    assert.equal((await models.LichDay.findById(quan.maLichDay).lean()).trangThaiLich, 'ChoGVXacNhan');
  });
});

describe('Bảo vệ ở tầng cơ sở dữ liệu và cảnh báo xung đột', () => {
  before(async () => { await t.napLai(); });

  it('TC-TL-27 · Chèn trực tiếp vào CSDL buổi dạy trùng phòng–ngày–ca (bỏ qua API) → bị chỉ mục UX_LichDay_Phong chặn', async () => {
    const goc = await buoi('IEF-K15', '2026-11-17');
    await assert.rejects(
      models.LichDay.create({ ...goc, _id: 'LD-TEST-01', maLop: 'Kids-K04', phanCong: [], lichSu: [], xacNhanCaHoc: [], yeuCauNghiHoc: [] }),
      (e) => e.code === 11000 && /UX_LichDay_Phong/.test(e.message),
    );
  });

  it('TC-TL-28 · Chèn trực tiếp vào CSDL buổi học trùng lớp–ngày–ca ở phòng khác → bị chỉ mục UX_LichDay_Lop chặn', async () => {
    const goc = await buoi('IEF-K15', '2026-11-17');
    await assert.rejects(
      models.LichDay.create({ ...goc, _id: 'LD-TEST-02', maPhong: 'P402', phanCong: [], lichSu: [], xacNhanCaHoc: [], yeuCauNghiHoc: [] }),
      (e) => e.code === 11000 && /UX_LichDay_Lop/.test(e.message),
    );
  });

  it('TC-TL-29 · Chèn trực tiếp hai đăng ký phòng còn hiệu lực cùng phòng–ngày–ca → bị chỉ mục UX_DangKyPhong chặn', async () => {
    const goc = await models.DangKyPhong.findOne({ trangThaiDangKy: 'DaDangKy' }).lean();
    await assert.rejects(models.DangKyPhong.create({ ...goc, _id: 'DK-TEST-01' }), (e) => e.code === 11000);
  });

  it('TC-TL-30 · Trang chủ Quản lý cảnh báo xung đột lịch dạy (trùng phòng P.101, sai lịch rảnh GV Quân)', async () => {
    const r = await t.goi('GET', '/quan-ly/tong-quan', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 200);
    const cb = r.body.data.canhBaoXungDot;
    assert.ok(cb.some((x) => x.tieuDe === 'Trùng phòng' && x.moTa.includes('P.101')), JSON.stringify(cb));
    assert.ok(cb.some((x) => x.tieuDe === 'Sai lịch rảnh' && x.moTa.includes('Trần Minh Quân')));
    assert.equal(r.body.data.thongKe.xungDotCanXuLy, cb.length);
  });
});
