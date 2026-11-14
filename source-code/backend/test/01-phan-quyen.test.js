/**
 * Ưu tiên 3 – Kiểm thử SAI QUYỀN
 * UC_1 BR03/BR04 (xác thực, phân quyền theo vai trò), UC_5 BR02, UC_7 BR01, UC_9 BR04, UC_14 BR02 (cách ly dữ liệu).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const M = require('../src/constants/messages');
const { khoiDong, TK, PH } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
});
after(async () => { await t.dong(); });

const buoiDauCua = async (maLop, loc = {}) => (await models.LichDay.findOne({ maLop, ...loc }).sort({ ngayDay: 1 }).lean())._id;

describe('Xác thực (token)', () => {
  it('TC-PQ-01 · Gọi API Quản lý không kèm token → 401 "Vui lòng đăng nhập…"', async () => {
    const r = await t.goi('GET', '/quan-ly/tong-quan');
    assert.equal(r.status, 401);
    assert.equal(r.body.message, M.CHUA_DANG_NHAP);
  });

  it('TC-PQ-02 · Gọi API Giáo viên và Phụ huynh không kèm token → 401', async () => {
    assert.equal((await t.goi('GET', '/giao-vien/lich-day')).status, 401);
    assert.equal((await t.goi('GET', '/phu-huynh/lop')).status, 401);
    assert.equal((await t.goi('GET', '/thong-bao')).status, 401);
  });

  it('TC-PQ-03 · Token sai định dạng / không theo kiểu Bearer → 401', async () => {
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: 'abc.def.ghi' })).status, 401);
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { headers: { Authorization: `Token ${ql}` } })).status, 401);
  });

  it('TC-PQ-04 · Token giả mạo vai trò Quản lý (ký bằng khóa khác) → 401', async () => {
    const gia = jwt.sign({ sub: 'QL-001', vaiTro: 'QuanLy' }, 'khoa-bi-mat-gia', { expiresIn: '1h' });
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: gia })).status, 401);
  });

  it('TC-PQ-05 · Token đã hết hạn → 401', async () => {
    const het = jwt.sign({ sub: 'QL-001', vaiTro: 'QuanLy', exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: het })).status, 401);
  });

  it('TC-PQ-06 · Token hợp lệ nhưng tự khai vai trò Quản lý cho tài khoản Giáo viên → vẫn bị chặn 403', async () => {
    // Vai trò luôn đọc lại từ CSDL, không tin vai trò ghi trong token
    const gia = jwt.sign({ sub: 'GV-001', vaiTro: 'QuanLy' }, env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: gia })).status, 403);
  });

  it('TC-PQ-07 · Token của tài khoản không còn tồn tại → 401', async () => {
    const ma = jwt.sign({ sub: 'GV-999', vaiTro: 'GiaoVien' }, env.JWT_SECRET, { expiresIn: '1h' });
    assert.equal((await t.goi('GET', '/giao-vien/lich-day', { token: ma })).status, 401);
  });

  it('TC-PQ-08 · Đăng nhập tài khoản đang bị tạm khóa → 403 "Tài khoản đang bị tạm khóa…"', async () => {
    await models.NguoiDung.updateOne({ _id: 'GV-008' }, { $set: { trangThaiTaiKhoan: 'TamKhoa' } });
    const r = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: TK.JOHN, matKhau: 'Broadway@2026' } });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, M.DN_TAI_KHOAN_KHOA);
    assert.equal(r.body.data, undefined);
  });

  it('TC-PQ-09 · Tài khoản bị khóa sau khi đã đăng nhập: token cũ không dùng được nữa → 403', async () => {
    await models.NguoiDung.updateOne({ _id: 'GV-008' }, { $set: { trangThaiTaiKhoan: 'HoatDong' } });
    const token = await t.nhanSu(TK.JOHN);
    assert.equal((await t.goi('GET', '/giao-vien/lich-day', { token })).status, 200);
    await models.NguoiDung.updateOne({ _id: 'GV-008' }, { $set: { trangThaiTaiKhoan: 'TamKhoa' } });
    assert.equal((await t.goi('GET', '/giao-vien/lich-day', { token })).status, 403);
    await models.NguoiDung.updateOne({ _id: 'GV-008' }, { $set: { trangThaiTaiKhoan: 'HoatDong' } });
  });
});

describe('Phân quyền theo vai trò', () => {
  it('TC-PQ-10 · Giáo viên gọi các chức năng của Quản lý (xem, thêm, sửa, duyệt) → 403 "Bạn không có quyền…"', async () => {
    const gv = await t.nhanSu(TK.LAN);
    const ds = [
      ['GET', '/quan-ly/tong-quan'], ['GET', '/quan-ly/ho-so-giao-vien'], ['GET', '/quan-ly/phan-hoi'],
      ['GET', '/quan-ly/lich-day'], ['GET', '/quan-ly/quan-ly-lich'], ['POST', '/quan-ly/dang-ky-phong'],
      ['POST', '/quan-ly/quan-ly-lich/Kids-K04/phe-duyet'], ['PATCH', '/quan-ly/phan-hoi/PH-2611-0001/trang-thai'],
    ];
    for (const [m, p] of ds) {
      const r = await t.goi(m, p, { token: gv, body: {} });
      assert.equal(r.status, 403, `${m} ${p}`);
      assert.equal(r.body.message, M.KHONG_CO_QUYEN);
    }
    // Không có tác dụng phụ: lịch Kids-K04 vẫn "Chờ GV xác nhận"
    assert.equal(await models.LichDay.countDocuments({ maLop: 'Kids-K04', trangThaiLich: 'DaDuyet' }), 0);
  });

  it('TC-PQ-11 · Trợ giảng gọi chức năng của Quản lý → 403; chức năng Giáo viên / Trợ giảng → 200', async () => {
    const tg = await t.nhanSu(TK.TG_ANH);
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: tg })).status, 403);
    assert.equal((await t.goi('GET', '/giao-vien/tong-quan', { token: tg })).status, 200);
  });

  it('TC-PQ-12 · Phụ huynh / Học viên gọi API Quản lý, Giáo viên, danh mục nội bộ → 403', async () => {
    const ph = await t.phuHuynh(...PH.AN);
    for (const p of ['/quan-ly/tong-quan', '/giao-vien/lich-day', '/giao-vien/lich-ranh', '/danh-muc/phong-hoc', '/quan-ly/ho-so-giao-vien']) {
      assert.equal((await t.goi('GET', p, { token: ph })).status, 403, p);
    }
  });

  it('TC-PQ-13 · Quản lý gọi API riêng của Giáo viên và Phụ huynh → 403', async () => {
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('GET', '/giao-vien/lich-day', { token: ql })).status, 403);
    assert.equal((await t.goi('PUT', '/giao-vien/lich-ranh', { token: ql, body: { cacRanh: [] } })).status, 403);
    assert.equal((await t.goi('GET', '/phu-huynh/lop', { token: ql })).status, 403);
  });

  it('TC-PQ-14 · Giáo viên gọi API Phụ huynh (xin nghỉ, xác nhận ca học) → 403', async () => {
    const gv = await t.nhanSu(TK.QUAN);
    const ma = await buoiDauCua('GT-A2-08');
    assert.equal((await t.goi('POST', `/phu-huynh/ca-hoc/${ma}/xin-nghi`, { token: gv, body: { lyDoXinNghi: 'NghiOm' } })).status, 403);
    assert.equal((await t.goi('POST', '/phu-huynh/lich-du-kien/xac-nhan-tat-ca', { token: gv })).status, 403);
  });

  it('TC-PQ-15 · Giáo viên tải tệp lên chức năng thêm hồ sơ của Quản lý → 403 và không lưu tệp nào', async () => {
    const khoTep = require('../src/config/mongoose').connection.db.collection('tepTaiLen.files');
    const truoc = await khoTep.countDocuments();
    const f = new FormData();
    f.append('hoTen', 'Kẻ Mạo Danh');
    f.append('bangCap', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'a.png');
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.LAN), form: f });
    assert.equal(r.status, 403);
    assert.equal(await khoTep.countDocuments(), truoc);
  });
});

describe('Cách ly dữ liệu giữa người dùng', () => {
  it('TC-PQ-16 · Giáo viên xem chi tiết lịch dạy của giáo viên khác → 404 "Lịch dạy không còn khả dụng!"', async () => {
    const r = await t.goi('GET', `/giao-vien/lich-day/${await buoiDauCua('GT-A2-08')}`, { token: await t.nhanSu(TK.LAN) });
    assert.equal(r.status, 404);
    assert.equal(r.body.message, M.GV_LICH_KHONG_KHA_DUNG);
  });

  it('TC-PQ-17 · Giáo viên chỉ thấy lịch dạy của chính mình (UC_7 BR01)', async () => {
    const r = await t.goi('GET', '/giao-vien/lich-day', { token: await t.nhanSu(TK.LAN), body: undefined });
    assert.equal(r.status, 200);
    const maCuaLan = new Set((await models.LichDay.find({ 'phanCong.maNhanSu': 'GV-001' }, { _id: 1 }).lean()).map((x) => x._id));
    assert.ok(r.body.data.ds.length > 0);
    for (const b of r.body.data.ds) assert.ok(maCuaLan.has(b.maLichDay), b.maLichDay);
  });

  it('TC-PQ-18 · Giáo viên xác nhận / đề xuất thay đổi ca dự kiến được phân công cho người khác → 404', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const caCuaMai = await buoiDauCua('Kids-K04');
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${caCuaMai}/xac-nhan`, { token: lan })).status, 404);
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${caCuaMai}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: 'Bận việc riêng' } })).status, 404);
    assert.equal((await t.goi('GET', `/giao-vien/ca-du-kien/${caCuaMai}`, { token: lan })).status, 404);
  });

  it('TC-PQ-19 · Giáo viên gửi kèm mã nhân sự khác khi lưu lịch rảnh → chỉ lịch rảnh của chính mình thay đổi (UC_9 BR04)', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const lr = (await t.goi('GET', '/giao-vien/lich-ranh', { token: lan })).body.data;
    const quanTruoc = await models.LichRanh.findOne({ maNhanSu: 'GV-002', tuanBatDau: new Date(`${lr.tuan.tuNgay}T00:00:00Z`) }).lean();
    const cacRanh = lr.cot.slice(0, 5).map((c) => ({ ngayRanh: c.ngay, maCa: 'CA1' }));
    const r = await t.goi('PUT', '/giao-vien/lich-ranh', { token: lan, body: { maNhanSu: 'GV-002', cacRanh } });
    assert.equal(r.status, 200);
    const quanSau = await models.LichRanh.findOne({ maNhanSu: 'GV-002', tuanBatDau: quanTruoc.tuanBatDau }).lean();
    assert.deepEqual(quanSau.cacRanh.map((c) => c.maCa), quanTruoc.cacRanh.map((c) => c.maCa));
    const lanSau = await models.LichRanh.findOne({ maNhanSu: 'GV-001', tuanBatDau: quanTruoc.tuanBatDau }).lean();
    assert.ok(lanSau.cacRanh.every((c) => c.maCa === 'CA1'));
  });

  it('TC-PQ-20 · "Yêu cầu của tôi" và thông báo chỉ chứa dữ liệu của chính giáo viên', async () => {
    const yc = await t.goi('GET', '/giao-vien/yeu-cau', { token: await t.nhanSu(TK.LAN) });
    const cuaLan = new Set((await models.PhanHoiGopY.find({ maNhanSu: 'GV-001' }).lean()).map((p) => p._id));
    assert.ok(yc.body.data.length > 0);
    for (const p of yc.body.data) assert.ok(cuaLan.has(p.maPhieu));
    const tb = await t.goi('GET', '/thong-bao', { token: await t.nhanSu(TK.QUAN) });
    const cuaQuan = await models.ThongBao.countDocuments({ maNguoiNhan: 'GV-002' });
    assert.equal(tb.body.data.length, cuaQuan);
  });

  it('TC-PQ-21 · Phụ huynh xem thời khóa biểu lớp học viên không theo học → 403', async () => {
    const r = await t.goi('GET', '/phu-huynh/thoi-khoa-bieu?maLop=Kids-K03', { token: await t.phuHuynh(...PH.AN) });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, M.TKB_KHONG_PHAI_LOP);
  });

  it('TC-PQ-22 · Phụ huynh xem chi tiết / xin nghỉ ca học của lớp khác → 404, không ghi nhận báo vắng', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const caKids = await buoiDauCua('Kids-K03', { ngayDay: { $gte: new Date('2026-11-12T00:00:00Z') } });
    assert.equal((await t.goi('GET', `/phu-huynh/ca-hoc/${caKids}`, { token: an })).status, 404);
    assert.equal((await t.goi('POST', `/phu-huynh/ca-hoc/${caKids}/xin-nghi`, { token: an, body: { lyDoXinNghi: 'NghiOm' } })).status, 404);
    assert.equal((await models.LichDay.findById(caKids).lean()).yeuCauNghiHoc.length, 0);
  });

  it('TC-PQ-23 · Phụ huynh xác nhận ca dự kiến của lớp học viên không theo học → 404', async () => {
    const r = await t.goi('POST', `/phu-huynh/lich-du-kien/${await buoiDauCua('Kids-K04')}/xac-nhan`, { token: await t.phuHuynh(...PH.AN) });
    assert.equal(r.status, 404);
  });

  it('TC-PQ-24 · Phụ huynh tra cứu phiếu phản hồi của học viên khác → 404 (UC_14)', async () => {
    const cuaBinh = await models.PhanHoiGopY.findOne({ maPHHV: 'HV-0002' }).lean();
    const r = await t.goi('GET', `/phu-huynh/gop-y/${cuaBinh._id}`, { token: await t.phuHuynh(...PH.AN) });
    assert.equal(r.status, 404);
    assert.equal(r.body.message, M.GY_KHONG_TIM_THAY_PHIEU);
  });

  it('TC-PQ-25 · Phụ huynh chỉ thấy tiến độ công khai, không thấy ghi chú nội bộ của Quản lý (UC_14 BR02)', async () => {
    const cuaBinh = await models.PhanHoiGopY.findOne({ maPHHV: 'HV-0002' }).lean();
    const r = await t.goi('GET', `/phu-huynh/gop-y/${cuaBinh._id}`, { token: await t.phuHuynh(...PH.BINH) });
    assert.equal(r.status, 200);
    const chuoi = JSON.stringify(r.body.data);
    for (const k of ['lichSuXuLy', 'ghiChuXuLy', 'maQuanLy', 'maPHHV', 'maNhanSu']) assert.ok(!chuoi.includes(`"${k}"`), k);
  });

  it('TC-PQ-26 · Lịch sử phản hồi và lịch dự kiến của phụ huynh chỉ thuộc học viên trong phiên', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const ls = await t.goi('GET', '/phu-huynh/gop-y', { token: an });
    const cuaAn = new Set((await models.PhanHoiGopY.find({ maPHHV: 'HV-0001' }).lean()).map((p) => p._id));
    for (const p of ls.body.data) assert.ok(cuaAn.has(p.maPhieu));
    const dk = await t.goi('GET', '/phu-huynh/lich-du-kien', { token: an });
    for (const c of dk.body.data.caHoc) assert.ok(['IEF-K15', 'GT-A2-08', 'GT-B1-09'].includes(c.maLop), c.maLop);
  });
});
