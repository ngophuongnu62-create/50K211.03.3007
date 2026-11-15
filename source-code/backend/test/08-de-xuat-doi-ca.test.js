/**
 * UC_8 luồng 5a → UC_4.2: giáo viên đề xuất thay đổi ca dạy, Quản lý xử lý phiếu.
 * - 5a.2: lưu phản hồi "Chờ xử lý" và tạo phiếu trong "Phản hồi & yêu cầu" của Quản lý
 *   (tiêu đề = ca dạy đề xuất thay thế, nội dung chi tiết = lý do thay đổi).
 * - Quản lý cập nhật "Đã xử lý" → lịch dạy chuyển sang ca đề xuất; "Từ chối" → giáo viên dạy đúng ca cũ.
 *
 * Mốc đồng hồ: 09:00 Thứ Tư 11/11/2026; lịch dự kiến GT-B1-09 của GV Nguyễn Thị Lan đang chờ phản hồi (hạn 03:00 12/11).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { khoiDong, TK } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
  await t.napLai();
});
after(async () => { await t.dong(); });

const caLan = async (i = 0) => (await models.LichDay.find({ maLop: 'GT-B1-09' }).sort({ ngayDay: 1 }).lean())[i]._id;
const ngay = (d) => d.toISOString().slice(0, 10);

describe('Đề xuất thay đổi ca dạy (UC_8 5a) và xử lý của Quản lý (UC_4.2)', () => {
  it('TC-DX-01 · Gửi đề xuất có ca thay thế → phiếu "Chờ xử lý": tiêu đề là ca đề xuất, nội dung là lý do', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ma = await caLan(0);
    const ct = await t.goi('GET', `/giao-vien/ca-du-kien/${ma}`, { token: lan });
    const ca = ct.body.data.caThayThe[0];
    assert.ok(ca, 'phải có ít nhất một ca thay thế để thử');
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/de-xuat-thay-doi`, {
      token: lan, body: { lyDoThayDoi: 'Trùng lịch thi chứng chỉ', ngayDeXuat: ca.ngayDeXuat, maCaDeXuat: ca.maCaDeXuat },
    });
    assert.equal(r.status, 200);
    const phieu = await models.PhanHoiGopY.findOne({ maLichDay: ma }).lean();
    assert.ok(phieu, 'phải tạo phiếu phản hồi');
    assert.match(phieu._id, /^YC-\d{4}$/);
    assert.equal(phieu.trangThaiXuLy, 'ChoXuLy');
    assert.equal(phieu.loaiPhanHoi, 'DoiLich');
    assert.equal(phieu.tieuDe, ca.nhan);
    assert.equal(phieu.noiDung, 'Trùng lịch thi chứng chỉ');
    // Quản lý thấy phiếu trong "Phản hồi & yêu cầu"
    const ds = await t.goi('GET', '/quan-ly/phan-hoi', { token: await t.nhanSu(TK.QL) });
    assert.ok(ds.body.data.ds.some((p) => p.maPhanHoi === phieu._id && p.trangThaiXuLy === 'ChoXuLy'));
  });

  it('TC-DX-02 · Quản lý cập nhật "Đã xử lý" → buổi dạy chuyển sang ca đề xuất, phân công "Đã xác nhận"', async () => {
    const ma = await caLan(0);
    const phieu = await models.PhanHoiGopY.findOne({ maLichDay: ma }).lean();
    const ph = (await models.LichDay.findById(ma).lean()).phanCong.find((p) => p.maNhanSu === 'GV-001').phanHoiLichDay.at(-1);
    const r = await t.goi('PATCH', `/quan-ly/phan-hoi/${phieu._id}/trang-thai`, { token: await t.nhanSu(TK.QL), body: { trangThaiMoi: 'DaXuLy' } });
    assert.equal(r.status, 200);
    const ld = await models.LichDay.findById(ma).lean();
    assert.equal(ngay(ld.ngayDay), ngay(ph.ngayDeXuat));
    assert.equal(ld.maCa, ph.maCaDeXuat);
    const pc = ld.phanCong.find((p) => p.maNhanSu === 'GV-001');
    assert.equal(pc.trangThaiPhanCong, 'DaXacNhan');
    assert.equal(pc.phanHoiLichDay.at(-1).trangThaiXuLy, 'DaChapNhan');
  });

  it('TC-DX-03 · Quản lý cập nhật "Từ chối" → buổi dạy giữ nguyên ngày, ca; giáo viên dạy ca cũ', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ma = await caLan(1);
    const truoc = await models.LichDay.findById(ma).lean();
    const ct = await t.goi('GET', `/giao-vien/ca-du-kien/${ma}`, { token: lan });
    const ca = ct.body.data.caThayThe[0];
    const body = { lyDoThayDoi: 'Bận việc gia đình', ...(ca ? { ngayDeXuat: ca.ngayDeXuat, maCaDeXuat: ca.maCaDeXuat } : {}) };
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/de-xuat-thay-doi`, { token: lan, body })).status, 200);
    const phieu = await models.PhanHoiGopY.findOne({ maLichDay: ma }).lean();
    const r = await t.goi('PATCH', `/quan-ly/phan-hoi/${phieu._id}/trang-thai`, {
      token: await t.nhanSu(TK.QL), body: { trangThaiMoi: 'TuChoi', ghiChu: 'Không có giáo viên thay, giữ ca cũ' },
    });
    assert.equal(r.status, 200);
    const sau = await models.LichDay.findById(ma).lean();
    assert.equal(ngay(sau.ngayDay), ngay(truoc.ngayDay));
    assert.equal(sau.maCa, truoc.maCa);
    const pc = sau.phanCong.find((p) => p.maNhanSu === 'GV-001');
    assert.equal(pc.trangThaiPhanCong, 'DaXacNhan');
    assert.equal(pc.phanHoiLichDay.at(-1).trangThaiXuLy, 'TuChoi');
  });

  it('TC-DX-04 · Phiếu do giáo viên tự gửi (UC_10) khi cập nhật "Đã xử lý" không làm thay đổi lịch dạy', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ma = await caLan(2);
    const truoc = await models.LichDay.findById(ma).lean();
    const tao = await t.goi('POST', '/giao-vien/yeu-cau', { token: lan, body: { loaiPhanHoi: 'DoiLich', tieuDe: 'Xin đổi ca', noiDung: 'Nội dung' } });
    assert.equal(tao.status, 201);
    const maPhieu = tao.body.data.maPhanHoi || tao.body.data._id || tao.body.data.maPhieu;
    assert.equal((await t.goi('PATCH', `/quan-ly/phan-hoi/${maPhieu}/trang-thai`, { token: await t.nhanSu(TK.QL), body: { trangThaiMoi: 'DaXuLy' } })).status, 200);
    const sau = await models.LichDay.findById(ma).lean();
    assert.equal(ngay(sau.ngayDay), ngay(truoc.ngayDay));
    assert.equal(sau.maCa, truoc.maCa);
  });
it('TC-DX-05 · Xử lý qua API đề xuất cũ (Từ chối) cũng cập nhật phiếu và giữ ca cũ – không lệch dữ liệu', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ma = await caLan(3);
    const truoc = await models.LichDay.findById(ma).lean();
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: 'Ốm' } })).status, 200);
    const ph = (await models.LichDay.findById(ma).lean()).phanCong.find((p) => p.maNhanSu === 'GV-001').phanHoiLichDay.at(-1);
    const r = await t.goi('PATCH', `/quan-ly/quan-ly-lich/de-xuat-thay-doi/${ma}/${ph.maPhanHoiLichDay}`, { token: await t.nhanSu(TK.QL), body: { trangThaiXuLy: 'TuChoi' } });
    assert.equal(r.status, 200);
    const phieu = await models.PhanHoiGopY.findOne({ maLichDay: ma }).lean();
    assert.equal(phieu.trangThaiXuLy, 'TuChoi');
    const sau = await models.LichDay.findById(ma).lean();
    assert.equal(sau.maCa, truoc.maCa);
    assert.equal(sau.phanCong.find((p) => p.maNhanSu === 'GV-001').trangThaiPhanCong, 'DaXacNhan');
  });
});

