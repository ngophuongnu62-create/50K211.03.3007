/**
 * Ưu tiên 3 – Kiểm thử THỜI HẠN và XIN NGHỈ TRỄ
 * UC_13 BR01 (xin nghỉ trước giờ học tối thiểu 02 tiếng; ngoại lệ 1a ca đã / đang diễn ra; 5a chưa đủ 2 tiếng),
 * UC_8 BR03 và UC_11 BR03 (phản hồi trong 24 giờ), UC_9 BR03 (cổng lịch rảnh 08:00 Thứ Hai – 23:59 Thứ Năm),
 * UC_2.3 (chỉ hủy đăng ký phòng trước giờ sử dụng), UC_6.2 BR01 (chỉ xử lý tuần tới), BR01 mỗi ca chỉ phản hồi một lần.
 *
 * Mốc đồng hồ ban đầu: 09:00 Thứ Tư 11/11/2026. Ca 2 hôm nay của GT-A2-08 bắt đầu 13:30 tại P.102.
 * Lịch dự kiến GT-B1-09 được gửi lúc 03:00 11/11 → hạn phản hồi 24 giờ là 03:00 Thứ Năm 12/11/2026.
 */
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/constants/messages');
const { khoiDong, vn, MOC, TK, PH } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
});
after(async () => { await t.dong(); });

const ngayDate = (s) => new Date(`${s}T00:00:00Z`);
const PHUT = 60 * 1000;
const caHomNay = async () => (await models.LichDay.findOne({ maLop: 'GT-A2-08', ngayDay: ngayDate('2026-11-11'), maCa: 'CA2' }).lean())._id;
const xinNghi = (token, ma) => t.goi('POST', `/phu-huynh/ca-hoc/${ma}/xin-nghi`, { token, body: { lyDoXinNghi: 'NghiOm', ghiChu: 'Bé bị sốt' } });

describe('Xin nghỉ học trễ hạn (UC_13)', () => {
  before(async () => { await t.napLai(); });
  afterEach(() => t.datGio(MOC));

  it('TC-TH-01 · Xin nghỉ lúc 09:00 cho ca 13:30 cùng ngày (trước 4 giờ 30 phút) → 201, ca chuyển "Báo vắng"', async () => {
    const ma = await caHomNay();
    const qlTruoc = await models.ThongBao.countDocuments({ maNguoiNhan: 'QL-001' });
    const r = await xinNghi(await t.phuHuynh(...PH.AN), ma);
    assert.equal(r.status, 201);
    assert.equal(r.body.message, M.NGHI_THANH_CONG);
    const tkb = await t.goi('GET', '/phu-huynh/thoi-khoa-bieu?maLop=GT-A2-08', { token: await t.phuHuynh(...PH.AN) });
    assert.equal(tkb.body.data.caHoc.find((c) => c.maLichDay === ma).baoVang, true);
    // Quản lý nhận thông báo ngay lập tức
    assert.equal(await models.ThongBao.countDocuments({ maNguoiNhan: 'QL-001' }), qlTruoc + 1);
  });

  it('TC-TH-02 · Xin nghỉ đúng 11:30 (vừa tròn 02 tiếng trước giờ học) → 201 (BR01 "tối thiểu 02 tiếng")', async () => {
    t.datGio(vn('2026-11-11', '11:30'));
    const r = await xinNghi(await t.phuHuynh(...PH.BINH), await caHomNay());
    assert.equal(r.status, 201);
  });

  it('TC-TH-03 · Xin nghỉ lúc 11:31 (còn 1 giờ 59 phút) → 422 "Đơn xin nghỉ phải được gửi trước giờ học tối thiểu 02 tiếng…" (5a)', async () => {
    t.datGio(vn('2026-11-11', '11:31'));
    const ma = await caHomNay();
    const r = await xinNghi(await t.phuHuynh(...PH.HANG), ma);
    assert.equal(r.status, 422);
    assert.equal(r.body.message, M.NGHI_CHUA_DU_2_TIENG);
    const ld = await models.LichDay.findById(ma).lean();
    assert.ok(!ld.yeuCauNghiHoc.some((y) => y.maPHHV === 'HV-0003'));
  });

  it('TC-TH-04 · Mở chi tiết ca lúc 12:00 → nút "Xin nghỉ ca này" bị khóa và kèm lý do', async () => {
    t.datGio(vn('2026-11-11', '12:00'));
    const r = await t.goi('GET', `/phu-huynh/ca-hoc/${await caHomNay()}`, { token: await t.phuHuynh(...PH.HANG) });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.coTheXinNghi, false);
    assert.equal(r.body.data.lyDoKhongTheXinNghi, M.NGHI_CHUA_DU_2_TIENG);
  });

  it('TC-TH-05 · Xin nghỉ đúng 13:30 (ca vừa bắt đầu) → 422 "Không thể báo vắng cho ca học đã hoặc đang diễn ra…" (1a)', async () => {
    t.datGio(vn('2026-11-11', '13:30'));
    const r = await xinNghi(await t.phuHuynh(...PH.HANG), await caHomNay());
    assert.equal(r.status, 422);
    assert.equal(r.body.message, M.NGHI_DA_DIEN_RA);
  });

  it('TC-TH-06 · Xin nghỉ lúc 15:00 (ca đang diễn ra) và cho ca của tuần trước → 422 (1a)', async () => {
    t.datGio(vn('2026-11-11', '15:00'));
    const hang = await t.phuHuynh(...PH.HANG);
    assert.equal((await xinNghi(hang, await caHomNay())).status, 422);
    const tuanTruoc = await models.LichDay.findOne({ maLop: 'GT-A2-08', ngayDay: ngayDate('2026-11-04') }).lean();
    const r = await xinNghi(hang, tuanTruoc._id);
    assert.equal(r.status, 422);
    assert.equal(r.body.message, M.NGHI_DA_DIEN_RA);
  });

  it('TC-TH-07 · Gửi đơn xin nghỉ lần thứ hai cho cùng ca → 409, không ghi trùng', async () => {
    const ma = await caHomNay();
    const r = await xinNghi(await t.phuHuynh(...PH.AN), ma);
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.NGHI_DA_GUI);
    const ld = await models.LichDay.findById(ma).lean();
    assert.equal(ld.yeuCauNghiHoc.filter((y) => y.maPHHV === 'HV-0001').length, 1);
  });

  it('TC-TH-08 · Gửi đồng thời 3 đơn xin nghỉ cùng ca của cùng học viên → chỉ 1 được ghi nhận', async () => {
    const ma = (await models.LichDay.findOne({ maLop: 'GT-A2-08', ngayDay: ngayDate('2026-11-16') }).lean())._id;
    const hang = await t.phuHuynh(...PH.HANG);
    const kq = await Promise.all([xinNghi(hang, ma), xinNghi(hang, ma), xinNghi(hang, ma)]);
    assert.deepEqual(kq.map((r) => r.status).sort(), [201, 409, 409]);
    const ld = await models.LichDay.findById(ma).lean();
    assert.equal(ld.yeuCauNghiHoc.filter((y) => y.maPHHV === 'HV-0003').length, 1);
  });

  it('TC-TH-09 · Xin nghỉ ca thuộc lịch chưa phát hành (GT-B1-09 đang chờ xác nhận) → 404', async () => {
    const ma = (await models.LichDay.findOne({ maLop: 'GT-B1-09' }).sort({ ngayDay: 1 }).lean())._id;
    assert.equal((await xinNghi(await t.phuHuynh(...PH.AN), ma)).status, 404);
  });
});

describe('Hạn 24 giờ giáo viên phản hồi lịch dự kiến (UC_8)', () => {
  before(async () => { await t.napLai(); });
  afterEach(() => t.datGio(MOC));
  const caLan = async (i = 0) => (await models.LichDay.find({ maLop: 'GT-B1-09' }).sort({ ngayDay: 1 }).lean())[i]._id;

  it('TC-TH-10 · Xác nhận lúc 02:59 ngày 12/11 (còn 1 phút trước hạn) → 200', async () => {
    t.datGio(vn('2026-11-12', '02:59'));
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${await caLan(0)}/xac-nhan`, { token: await t.nhanSu(TK.LAN) });
    assert.equal(r.status, 200);
  });

  it('TC-TH-11 · Phản hồi lại ca đã xác nhận → 409 (mỗi ca chỉ phản hồi một lần)', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ma = await caLan(0);
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/xac-nhan`, { token: lan })).status, 409);
    assert.equal((await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: 'Đổi ý' } })).status, 409);
  });

  it('TC-TH-12 · Xác nhận đúng 03:00 ngày 12/11 (tròn 24 giờ) → 403 "Đã quá thời hạn gửi phản hồi" (BR03)', async () => {
    t.datGio(vn('2026-11-12', '03:00'));
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${await caLan(1)}/xac-nhan`, { token: await t.nhanSu(TK.LAN) });
    assert.equal(r.status, 403);
    assert.equal(r.body.message, M.GV_QUA_HAN);
  });

  it('TC-TH-13 · Đề xuất thay đổi sau hạn 24 giờ → 403, không lưu đề xuất', async () => {
    t.datGio(vn('2026-11-12', '09:00'));
    const ma = await caLan(2);
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${ma}/de-xuat-thay-doi`, { token: await t.nhanSu(TK.LAN), body: { lyDoThayDoi: 'Có lịch thi chứng chỉ' } });
    assert.equal(r.status, 403);
    const pc = (await models.LichDay.findById(ma).lean()).phanCong.find((p) => p.maNhanSu === 'GV-001');
    assert.notEqual(pc.trangThaiPhanCong, 'DeXuatThayDoi');
  });

  it('TC-TH-14 · Sau hạn: danh sách "Phản hồi lịch dạy" không còn ca này; chi tiết ca báo quá hạn và khóa phản hồi', async () => {
    t.datGio(vn('2026-11-12', '09:00'));
    const lan = await t.nhanSu(TK.LAN);
    const ds = await t.goi('GET', '/giao-vien/ca-du-kien', { token: lan });
    assert.equal(ds.body.data.filter((c) => c.maLop === 'GT-B1-09').length, 0);
    const ct = await t.goi('GET', `/giao-vien/ca-du-kien/${await caLan(3)}`, { token: lan });
    assert.equal(ct.body.data.coThePhanHoi, false);
    assert.equal(ct.body.data.thongBao, M.GV_QUA_HAN);
  });
});

describe('Hạn 24 giờ phụ huynh xác nhận ca học dự kiến (UC_11)', () => {
  before(async () => { await t.napLai(); });
  afterEach(() => t.datGio(MOC));
  const caB1 = async (i) => (await models.LichDay.find({ maLop: 'GT-B1-09' }).sort({ ngayDay: 1 }).lean())[i]._id;

  it('TC-TH-15 · Xác nhận ca học trong hạn → 200; xác nhận lại cùng ca → 409 "Ca học này đã được phản hồi trước đó." (BR01)', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const ma = await caB1(0);
    assert.equal((await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/xac-nhan`, { token: an })).status, 200);
    const r = await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/xac-nhan`, { token: an });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.XN_DA_PHAN_HOI);
    assert.equal((await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/tu-choi`, { token: an, body: { lyDoTuChoi: 'Đổi ý vì bận' } })).status, 409);
  });

  it('TC-TH-16 · Từ chối lúc 02:59 ngày 12/11 → 200; trạng thái "Từ chối xác nhận" chuyển về Quản lý', async () => {
    t.datGio(vn('2026-11-12', '02:59'));
    const ma = await caB1(1);
    const r = await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/tu-choi`, { token: await t.phuHuynh(...PH.AN), body: { lyDoTuChoi: 'Trùng lịch thi học kỳ ở trường' } });
    assert.equal(r.status, 200);
    const kt = await t.goi('GET', '/quan-ly/quan-ly-lich/GT-B1-09/kiem-tra', { token: await t.nhanSu(TK.QL) });
    assert.ok(kt.body.data.phuHuynh.tuChoi >= 1);
  });

  it('TC-TH-17 · Xác nhận, từ chối, xác nhận tất cả đúng 03:00 ngày 12/11 (tròn 24 giờ) → 403 "Đã quá thời hạn phản hồi lịch học" (BR03)', async () => {
    t.datGio(vn('2026-11-12', '03:00'));
    const binh = await t.phuHuynh(...PH.BINH);
    const ma = await caB1(2);
    const a = await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/xac-nhan`, { token: binh });
    assert.equal(a.status, 403);
    assert.equal(a.body.message, M.XN_QUA_HAN);
    assert.equal((await t.goi('POST', `/phu-huynh/lich-du-kien/${ma}/tu-choi`, { token: binh, body: { lyDoTuChoi: 'Bận việc' } })).status, 403);
    assert.equal((await t.goi('POST', '/phu-huynh/lich-du-kien/xac-nhan-tat-ca', { token: binh })).status, 403);
  });

  it('TC-TH-18 · Sau hạn, màn hình lịch dự kiến hiển thị "Đã quá thời hạn…" và khóa toàn bộ ca chưa phản hồi', async () => {
    t.datGio(vn('2026-11-12', '09:00'));
    const r = await t.goi('GET', '/phu-huynh/lich-du-kien', { token: await t.phuHuynh(...PH.BINH) });
    assert.equal(r.body.data.thongBao, M.XN_QUA_HAN);
    assert.equal(r.body.data.chiTiet, M.XN_QUA_HAN_CHI_TIET);
    assert.ok(r.body.data.caHoc.filter((c) => !c.ketQua).every((c) => c.daKhoa));
  });
});

describe('Cổng cập nhật lịch rảnh (UC_9)', () => {
  before(async () => { await t.napLai(); });
  afterEach(() => t.datGio(MOC));

  const luu = async () => {
    const lan = await t.nhanSu(TK.LAN);
    const lr = (await t.goi('GET', '/giao-vien/lich-ranh', { token: lan })).body.data;
    const cacRanh = lr.cot.slice(0, 5).map((c) => ({ ngayRanh: c.ngay, maCa: 'CA3' }));
    return { lr, r: await t.goi('PUT', '/giao-vien/lich-ranh', { token: lan, body: { cacRanh } }) };
  };

  it('TC-TH-19 · Lưu lịch rảnh lúc 07:59 Thứ Hai (cổng chưa mở) → 403 "Hệ thống đã đóng cổng đăng ký…" (4b)', async () => {
    t.datGio(vn('2026-11-16', '07:59'));
    const { lr, r } = await luu();
    assert.equal(lr.cong.dangMo, false);
    assert.equal(r.status, 403);
    assert.equal(r.body.message, M.LR_DONG_CONG);
  });

  it('TC-TH-20 · Lưu lịch rảnh đúng 08:00 Thứ Hai (cổng vừa mở) → 200', async () => {
    t.datGio(vn('2026-11-16', '08:00'));
    const { r } = await luu();
    assert.equal(r.status, 200);
    assert.equal(r.body.message, M.LR_THANH_CONG);
  });

  it('TC-TH-21 · Lưu lịch rảnh lúc 23:59 Thứ Năm (phút cuối của cổng) → 200', async () => {
    t.datGio(vn('2026-11-19', '23:59'));
    assert.equal((await luu()).r.status, 200);
  });

  it('TC-TH-22 · Lưu lịch rảnh lúc 00:00 Thứ Sáu, Thứ Bảy, Chủ Nhật (cổng đã đóng) → 403, lịch rảnh đã lưu giữ nguyên', async () => {
    for (const [ngay, gio] of [['2026-11-20', '00:00'], ['2026-11-21', '10:00'], ['2026-11-22', '20:00']]) {
      t.datGio(vn(ngay, gio));
      const truoc = await models.LichRanh.countDocuments({ maNhanSu: 'GV-001' });
      assert.equal((await luu()).r.status, 403, `${ngay} ${gio}`);
      assert.equal(await models.LichRanh.countDocuments({ maNhanSu: 'GV-001' }), truoc);
    }
  });

  it('TC-TH-23 · Trang chủ giáo viên chỉ hiện nhắc việc cổng lịch rảnh khi cổng đang mở', async () => {
    const lan = await t.nhanSu(TK.LAN);
    t.datGio(vn('2026-11-19', '10:00'));
    assert.equal((await t.goi('GET', '/giao-vien/tong-quan', { token: lan })).body.data.congLichRanh.dangMo, true);
    t.datGio(vn('2026-11-20', '10:00'));
    assert.equal((await t.goi('GET', '/giao-vien/tong-quan', { token: lan })).body.data.congLichRanh.dangMo, false);
  });
});

describe('Thời điểm thao tác khác', () => {
  before(async () => { await t.napLai(); });
  afterEach(() => t.datGio(MOC));

  it('TC-TH-24 · Hủy đăng ký phòng khi đã đến giờ sử dụng (P.202 Thứ Năm 12/11 Ca 3, lúc 18:00) → 422 (8.a)', async () => {
    const dk = await models.DangKyPhong.findOne({ maPhong: 'P202', trangThaiDangKy: 'DaDangKy' }).lean();
    t.datGio(vn('2026-11-12', '18:00'));
    const r = await t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk._id}/huy`, { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 422);
    assert.equal(r.body.message, M.PHONG_KHONG_THE_HUY);
    assert.equal((await models.DangKyPhong.findById(dk._id).lean()).trangThaiDangKy, 'DaDangKy');
  });

  it('TC-TH-25 · Hủy đăng ký phòng trước giờ sử dụng 1 phút (17:29) → 200; hủy lần hai → 422', async () => {
    const dk = await models.DangKyPhong.findOne({ maPhong: 'P202', trangThaiDangKy: 'DaDangKy' }).lean();
    t.datGio(vn('2026-11-12', '17:29'));
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk._id}/huy`, { token: ql })).status, 200);
    assert.equal((await t.goi('PATCH', `/quan-ly/dang-ky-phong/${dk._id}/huy`, { token: ql })).status, 422);
  });

  it('TC-TH-26 · Lập lịch tuần: thêm buổi bù ngoài tuần tới (sau 22/11) → 400 (BR01 chỉ xử lý tuần tới)', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', {
      token: await t.nhanSu(TK.QL),
      body: { buoiBu: [{ maLop: 'GT-A2-08', ngayDay: '2026-11-25', maCa: 'CA1', maPhong: 'P401', maGiaoVien: 'GV-008', soTiet: 3 }] },
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.LT_XUNG_DOT);
  });

  it('TC-TH-27 · Phát hành lịch chưa được phê duyệt (Kids-K04 đang chờ) → 409; phê duyệt lịch giáo viên chưa xác nhận (GT-B1-09) → 409', async () => {
    const ql = await t.nhanSu(TK.QL);
    const a = await t.goi('POST', '/quan-ly/quan-ly-lich/Kids-K04/phat-hanh', { token: ql });
    assert.equal(a.status, 409);
    assert.equal(a.body.message, M.PH_HANH_CHI_DA_DUYET);
    const b = await t.goi('POST', '/quan-ly/quan-ly-lich/GT-B1-09/phe-duyet', { token: ql });
    assert.equal(b.status, 409);
    assert.equal(b.body.message, M.PD_CHUA_XAC_NHAN);
  });
});
