/**
 * Ưu tiên 3 – Kiểm thử NHẬP SAI DỮ LIỆU
 * Trường bắt buộc, định dạng, giới hạn độ dài (500 ký tự), trùng dữ liệu, tệp đính kèm, dữ liệu độc hại.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/constants/messages');
const { khoiDong, TK, PH } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
});
after(async () => { await t.dong(); });

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const formHoSo = (truong, tep = [{ du: PNG, ten: 'bang.png', loai: 'image/png' }]) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(truong)) f.append(k, v);
  for (const x of tep) f.append('bangCap', new Blob([x.du], { type: x.loai }), x.ten);
  return f;
};
const HO_SO_HOP_LE = { hoTen: 'Hoàng Bảo Ngọc', soDienThoai: '0905999888', email: 'ngoc.hoang@gmail.com', diaChi: 'Đà Nẵng', loaiNhanSu: 'GiaoVien' };
const formGopY = (truong, tep = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(truong)) f.append(k, v);
  for (const x of tep) f.append('tepDinhKem', new Blob([x.du], { type: x.loai }), x.ten);
  return f;
};
/** Số tệp đang lưu trong kho tệp (GridFS) thuộc một thư mục */
const demTep = (con) => require('../src/config/mongoose').connection.db.collection('tepTaiLen.files').countDocuments({ filename: new RegExp(`^${con}/`) });

describe('Đăng nhập (UC_1)', () => {
  it('TC-DL-01 · Đăng nhập nhân sự bỏ trống mật khẩu → 400 "Vui lòng nhập đầy đủ…"', async () => {
    const r = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: 'quanly', matKhau: '   ' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.DN_THIEU_THONG_TIN);
  });

  it('TC-DL-02 · Đăng nhập sai mật khẩu → 401, không trả token', async () => {
    const r = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: 'quanly', matKhau: 'Broadway@2025' } });
    assert.equal(r.status, 401);
    assert.equal(r.body.message, M.DN_SAI_THONG_TIN);
    assert.equal(r.body.data, undefined);
  });

  it('TC-DL-03 · Chèn toán tử NoSQL vào tên đăng nhập / mật khẩu ({"$ne": null}) → không đăng nhập được', async () => {
    const r = await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: { $ne: null }, matKhau: { $ne: null } } });
    assert.ok([400, 401].includes(r.status), String(r.status));
    assert.equal(r.body.data, undefined);
  });

  it('TC-DL-04 · Phụ huynh nhập sai số điện thoại / chèn toán tử NoSQL → 401 "Thông tin…không đúng"', async () => {
    const sai = await t.goi('POST', '/auth/phu-huynh/dang-nhap', { body: { hoTen: 'Nguyễn Minh An', soDienThoai: '0905000457' } });
    assert.equal(sai.status, 401);
    assert.equal(sai.body.message, M.DN_PH_SAI_THONG_TIN);
    const chen = await t.goi('POST', '/auth/phu-huynh/dang-nhap', { body: { hoTen: 'Nguyễn Minh An', soDienThoai: { $gt: '' } } });
    assert.ok([400, 401].includes(chen.status));
    assert.equal(chen.body.data, undefined);
  });

  it('TC-DL-05 · Gửi JSON hỏng cú pháp → 400 "Dữ liệu không hợp lệ" (không lỗi 500)', async () => {
    const r = await t.goi('POST', '/auth/dang-nhap', { body: '{"tenDangNhap": "quanly", ' });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.HS_KHONG_HOP_LE);
  });
});

describe('Chèn toán tử truy vấn vào API nghiệp vụ', () => {
  it('TC-DL-06 · Tham số truy vấn chứa toán tử ($ne) khi tra cứu lịch dạy → 400, không thực thi điều kiện', async () => {
    const r = await t.goi('GET', '/quan-ly/lich-day?maLop[$ne]=IEF-K15', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 400);
  });

  it('TC-DL-07 · Thân yêu cầu chứa toán tử ({"$ne": null}) khi kiểm tra giáo viên phân công → 400', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IE65-K12/kiem-tra-giao-vien', { token: await t.nhanSu(TK.QL), body: { maNhanSu: { $ne: null } } });
    assert.equal(r.status, 400);
  });

  it('TC-DL-08 · Ô tìm kiếm chứa ký tự đặc biệt của biểu thức chính quy "(*[" → 200, không lỗi máy chủ', async () => {
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('GET', `/quan-ly/ho-so-giao-vien?q=${encodeURIComponent('(*[')}`, { token: ql })).status, 200);
    assert.equal((await t.goi('GET', `/quan-ly/phan-hoi?q=${encodeURIComponent('.*')}`, { token: ql })).body.data.ds.length, 0);
  });
});

describe('Phòng học (UC_2)', () => {
  it('TC-DL-09 · Tìm phòng trống với ngày không tồn tại (31/02) hoặc trạng thái lạ → 400 (luồng 6.a)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const r = await t.goi('GET', '/quan-ly/phong-hoc/trong?ngay=2026-02-31', { token: ql });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.PHONG_TIM_KIEM_KHONG_HOP_LE);
    assert.equal((await t.goi('GET', '/quan-ly/phong-hoc/trong?trangThai=BiPha', { token: ql })).status, 400);
  });

  it('TC-DL-10 · Đăng ký phòng thiếu ca học / phòng không tồn tại / ca không tồn tại → 400 (BR3)', async () => {
    const ql = await t.nhanSu(TK.QL);
    for (const body of [
      { maPhong: 'P303', ngaySuDung: '2026-11-16' },
      { maPhong: 'P999', ngaySuDung: '2026-11-16', maCa: 'CA2' },
      { maPhong: 'P303', ngaySuDung: '2026-11-16', maCa: 'CA9' },
    ]) {
      const r = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: ql, body });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.body.message, M.PHONG_THIEU_THONG_TIN);
    }
  });

  it('TC-DL-11 · Đăng ký phòng cho ca đã kết thúc (hôm qua) → 400', async () => {
    const r = await t.goi('POST', '/quan-ly/dang-ky-phong', { token: await t.nhanSu(TK.QL), body: { maPhong: 'P303', ngaySuDung: '2026-11-10', maCa: 'CA2' } });
    assert.equal(r.status, 400);
    assert.equal(await models.DangKyPhong.countDocuments({ maPhong: 'P303', ngaySuDung: new Date('2026-11-10T00:00:00Z') }), 0);
  });
});

describe('Hồ sơ giáo viên (UC_3)', () => {
  it('TC-DL-12 · Thêm hồ sơ bỏ trống họ tên, SĐT, email, địa chỉ, bằng cấp → 400, báo lỗi từng trường (7b)', async () => {
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: formHoSo({ loaiNhanSu: 'GiaoVien' }, []) });
    assert.equal(r.status, 400);
    for (const k of ['hoTen', 'soDienThoai', 'email', 'diaChi', 'bangCap']) assert.equal(r.body.fieldErrors[k], M.HS_THIEU_BAT_BUOC, k);
  });

  it('TC-DL-13 · Email sai định dạng và SĐT không đủ 10 số → 400 với thông báo đúng từng trường (7a)', async () => {
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: formHoSo({ ...HO_SO_HOP_LE, email: 'ngoc@', soDienThoai: '090599988' }) });
    assert.equal(r.status, 400);
    assert.equal(r.body.fieldErrors.email, M.HS_EMAIL_SAI);
    assert.equal(r.body.fieldErrors.soDienThoai, M.HS_SDT_SAI);
  });

  it('TC-DL-14 · SĐT có chữ cái / bắt đầu khác 0 → 400', async () => {
    const ql = await t.nhanSu(TK.QL);
    for (const sdt of ['09059a9888', '8905999888', '+84905999888']) {
      const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: ql, form: formHoSo({ ...HO_SO_HOP_LE, soDienThoai: sdt }) });
      assert.equal(r.status, 400, sdt);
    }
  });

  it('TC-DL-15 · SĐT hoặc email trùng với nhân sự khác → 409 (7c), hồ sơ không được tạo', async () => {
    const ql = await t.nhanSu(TK.QL);
    const truoc = await models.NguoiDung.countDocuments();
    const r1 = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: ql, form: formHoSo({ ...HO_SO_HOP_LE, soDienThoai: '0905100001' }) });
    assert.equal(r1.status, 409);
    assert.equal(r1.body.fieldErrors.soDienThoai, M.HS_TRUNG_SDT_EMAIL);
    const r2 = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: ql, form: formHoSo({ ...HO_SO_HOP_LE, email: 'GVNGUYENLAN@broadway.edu.vn' }) });
    assert.equal(r2.status, 409, 'email không phân biệt hoa thường');
    assert.equal(await models.NguoiDung.countDocuments(), truoc);
  });

  it('TC-DL-16 · Họ tên dài hơn 100 ký tự / loại nhân sự không hợp lệ → 400', async () => {
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: ql, form: formHoSo({ ...HO_SO_HOP_LE, hoTen: 'A'.repeat(101) }) })).status, 400);
    assert.equal((await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: ql, form: formHoSo({ ...HO_SO_HOP_LE, loaiNhanSu: 'QuanLy' }) })).status, 400);
  });

  it('TC-DL-17 · Ảnh bằng cấp sai loại tệp (PDF, TXT) → 400 "Tệp đính kèm không đúng định dạng…"', async () => {
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: formHoSo(HO_SO_HOP_LE, [{ du: PDF, ten: 'bang.pdf', loai: 'application/pdf' }]) });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.TEP_KHONG_HOP_LE);
  });

  it('TC-DL-18 · Tệp văn bản đổi đuôi thành .png (giả mạo ảnh) → 400, không lưu tệp', async () => {
    const truoc = await demTep('bangcap');
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', {
      token: await t.nhanSu(TK.QL),
      form: formHoSo(HO_SO_HOP_LE, [{ du: Buffer.from('<script>alert(1)</script>'), ten: 'bang.png', loai: 'image/png' }]),
    });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.TEP_KHONG_HOP_LE);
    assert.equal(await demTep('bangcap'), truoc);
  });

  it('TC-DL-19 · Dữ liệu sai thì ảnh vừa tải lên không bị lưu lại trên máy chủ', async () => {
    const truoc = await demTep('bangcap');
    const r = await t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: formHoSo({ ...HO_SO_HOP_LE, email: 'sai' }) });
    assert.equal(r.status, 400);
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(await demTep('bangcap'), truoc);
  });

  it('TC-DL-20 · Sửa hồ sơ bỏ hết bằng cấp → 400 (Trình độ học vấn bắt buộc)', async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ hoTen: 'Nguyễn Thị Lan', soDienThoai: '0905100001', email: 'gvnguyenlan@broadway.edu.vn', diaChi: 'Đà Nẵng', loaiNhanSu: 'GiaoVien', giuBangCap: '[]' })) f.append(k, v);
    const r = await t.goi('PUT', '/quan-ly/ho-so-giao-vien/GV-001', { token: await t.nhanSu(TK.QL), form: f });
    assert.equal(r.status, 400);
    assert.equal(r.body.fieldErrors.bangCap, M.HS_THIEU_BAT_BUOC);
    assert.equal((await models.NguoiDung.findById('GV-001').lean()).bangCap.length, 1);
  });
});

describe('Phản hồi & yêu cầu (UC_4, UC_10, UC_14)', () => {
  it('TC-DL-21 · Cập nhật trạng thái phản hồi không chọn trạng thái / trạng thái lạ → 400 (7a)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ma = (await models.PhanHoiGopY.findOne({ trangThaiXuLy: 'ChoXuLy' }).lean())._id;
    for (const body of [{}, { trangThaiMoi: 'XoaPhieu' }]) {
      const r = await t.goi('PATCH', `/quan-ly/phan-hoi/${ma}/trang-thai`, { token: ql, body });
      assert.equal(r.status, 400);
      assert.equal(r.body.message, M.PH_CHUA_CHON_TRANG_THAI);
    }
  });

  it('TC-DL-22 · Từ chối phản hồi không ghi lý do → 400 (7b); ghi chú 501 ký tự → 400 (BR06)', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ma = (await models.PhanHoiGopY.findOne({ trangThaiXuLy: 'ChoXuLy' }).lean())._id;
    const r = await t.goi('PATCH', `/quan-ly/phan-hoi/${ma}/trang-thai`, { token: ql, body: { trangThaiMoi: 'TuChoi', ghiChu: '   ' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.PH_TRONG_LY_DO_TU_CHOI);
    assert.equal((await t.goi('PATCH', `/quan-ly/phan-hoi/${ma}/trang-thai`, { token: ql, body: { trangThaiMoi: 'DangXuLy', ghiChu: 'x'.repeat(501) } })).status, 400);
    assert.equal((await models.PhanHoiGopY.findById(ma).lean()).trangThaiXuLy, 'ChoXuLy');
  });

  it('TC-DL-23 · Trả lời người gửi để trống / vượt 500 ký tự → 400 "Không được để trống!"', async () => {
    const ql = await t.nhanSu(TK.QL);
    const ma = (await models.PhanHoiGopY.findOne().lean())._id;
    const r = await t.goi('POST', `/quan-ly/phan-hoi/${ma}/tra-loi`, { token: ql, body: { noiDung: '' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.PH_KHONG_DUOC_DE_TRONG);
    assert.equal((await t.goi('POST', `/quan-ly/phan-hoi/${ma}/tra-loi`, { token: ql, body: { noiDung: 'a'.repeat(501) } })).status, 400);
  });

  it('TC-DL-24 · Giáo viên gửi yêu cầu thiếu loại, tiêu đề, nội dung → 400, báo "Không được để trống!" từng trường (5a)', async () => {
    const r = await t.goi('POST', '/giao-vien/yeu-cau', { token: await t.nhanSu(TK.LAN), body: { loaiPhanHoi: '', tieuDe: ' ', noiDung: '' } });
    assert.equal(r.status, 400);
    for (const k of ['loaiPhanHoi', 'tieuDe', 'noiDung']) assert.equal(r.body.fieldErrors[k], M.PH_KHONG_DUOC_DE_TRONG, k);
  });

  it('TC-DL-25 · Giáo viên gửi yêu cầu loại dành cho phụ huynh / nội dung 501 ký tự → 400', async () => {
    const lan = await t.nhanSu(TK.LAN);
    assert.equal((await t.goi('POST', '/giao-vien/yeu-cau', { token: lan, body: { loaiPhanHoi: 'CoSoVatChat', tieuDe: 'Máy chiếu', noiDung: 'Hỏng' } })).status, 400);
    assert.equal((await t.goi('POST', '/giao-vien/yeu-cau', { token: lan, body: { loaiPhanHoi: 'GopY', tieuDe: 'Góp ý', noiDung: 'n'.repeat(501) } })).status, 400);
  });

  it('TC-DL-26 · Phụ huynh gửi ý kiến thiếu tiêu đề hoặc nội dung → 400 "Vui lòng nhập đầy đủ Tiêu đề và Nội dung…" (5a)', async () => {
    const r = await t.goi('POST', '/phu-huynh/gop-y', { token: await t.phuHuynh(...PH.AN), form: formGopY({ loaiPhanHoi: 'DichVu', tieuDe: 'Bãi xe' }) });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.GY_THIEU);
  });

  it('TC-DL-27 · Phụ huynh gửi ý kiến với phân loại không có trong danh sách / nội dung 501 ký tự → 400', async () => {
    const an = await t.phuHuynh(...PH.AN);
    assert.equal((await t.goi('POST', '/phu-huynh/gop-y', { token: an, form: formGopY({ loaiPhanHoi: 'NghiPhep', tieuDe: 'a', noiDung: 'b' }) })).status, 400);
    assert.equal((await t.goi('POST', '/phu-huynh/gop-y', { token: an, form: formGopY({ loaiPhanHoi: 'DichVu', tieuDe: 'a', noiDung: 'b'.repeat(501) }) })).status, 400);
  });

  it('TC-DL-28 · Tệp minh chứng sai loại (.txt) / quá 5 tệp / lớn hơn 5 MB → 400', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const goc = { loaiPhanHoi: 'DichVu', tieuDe: 'Bãi xe', noiDung: 'Chật' };
    assert.equal((await t.goi('POST', '/phu-huynh/gop-y', { token: an, form: formGopY(goc, [{ du: Buffer.from('x'), ten: 'a.txt', loai: 'text/plain' }]) })).status, 400);
    const sauTep = Array.from({ length: 6 }, (_, i) => ({ du: PDF, ten: `${i}.pdf`, loai: 'application/pdf' }));
    assert.equal((await t.goi('POST', '/phu-huynh/gop-y', { token: an, form: formGopY(goc, sauTep) })).status, 400);
    const lon = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    assert.equal((await t.goi('POST', '/phu-huynh/gop-y', { token: an, form: formGopY(goc, [{ du: lon, ten: 'lon.pdf', loai: 'application/pdf' }]) })).status, 400);
  });

  it('TC-DL-29 · Ý kiến thiếu nội dung kèm tệp minh chứng → 400 và tệp không bị lưu lại trên máy chủ', async () => {
    const truoc = await demTep('phanhoi');
    const r = await t.goi('POST', '/phu-huynh/gop-y', { token: await t.phuHuynh(...PH.AN), form: formGopY({ loaiPhanHoi: 'DichVu', tieuDe: 'Bãi xe' }, [{ du: PDF, ten: 'a.pdf', loai: 'application/pdf' }]) });
    assert.equal(r.status, 400);
    await new Promise((ok) => setTimeout(ok, 100));
    assert.equal(await demTep('phanhoi'), truoc);
  });
});

describe('Lịch dạy (UC_5, UC_6, UC_8, UC_9)', () => {
  it('TC-DL-30 · Tra cứu lịch dạy với ngày sai định dạng / ngày bắt đầu sau ngày kết thúc → 400 (BR05)', async () => {
    const ql = await t.nhanSu(TK.QL);
    assert.equal((await t.goi('GET', '/quan-ly/lich-day?tuNgay=11/11/2026', { token: ql })).status, 400);
    const r = await t.goi('GET', '/quan-ly/lich-day?tuNgay=2026-11-20&denNgay=2026-11-09', { token: ql });
    assert.equal(r.status, 400);
    assert.equal(r.body.fieldErrors.thoiGianDay, M.TC_NGAY_KHONG_HOP_LE);
  });

  it('TC-DL-31 · Đề xuất lịch khi chưa chọn lớp / lớp không tồn tại → 400 "Vui lòng chọn lớp học!" (3.a)', async () => {
    const ql = await t.nhanSu(TK.QL);
    for (const body of [{}, { maLop: 'KHONG-CO' }]) {
      const r = await t.goi('POST', '/quan-ly/quan-ly-lich/de-xuat', { token: ql, body });
      assert.equal(r.status, 400);
      assert.equal(r.body.fieldErrors.maLop, M.TL_CHUA_CHON_LOP);
    }
  });

  it('TC-DL-32 · Đề xuất lịch với khoảng thời gian học ngược (từ ngày > đến ngày) → 400', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/de-xuat', { token: await t.nhanSu(TK.QL), body: { maLop: 'IE65-K13', tuNgay: '2027-03-01', denNgay: '2026-12-01' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.fieldErrors.khoangThoiGian, M.TC_NGAY_KHONG_HOP_LE);
  });

  it('TC-DL-33 · Lưu phương án thiếu ngày học / giờ học / phòng → 400, không tạo buổi nào', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich', { token: await t.nhanSu(TK.QL), body: { maLop: 'IE65-K13', thu: [], maCa: 'CA3' } });
    assert.equal(r.status, 400);
    assert.equal(await models.LichDay.countDocuments({ maLop: 'IE65-K13' }), 0);
  });

  it('TC-DL-34 · Xác nhận lịch tuần không có thay đổi nào / buổi bù thiếu thông tin → 400', async () => {
    const ql = await t.nhanSu(TK.QL);
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { token: ql, body: {} });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.LT_KHONG_THAY_DOI);
    const r2 = await t.goi('POST', '/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { token: ql, body: { buoiBu: [{ maLop: 'GT-A2-08', ngayDay: '2026-11-19' }] } });
    assert.equal(r2.status, 400);
  });

  it('TC-DL-35 · Giáo viên đề xuất thay đổi bỏ trống lý do → 400 "Không được để trống"; lý do 501 ký tự → 400 (BR02)', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ca = (await t.goi('GET', '/giao-vien/ca-du-kien', { token: lan })).body.data[0];
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${ca.maLichDay}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: '  ' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.fieldErrors.lyDoThayDoi, M.GV_TRONG_LY_DO);
    const r2 = await t.goi('POST', `/giao-vien/ca-du-kien/${ca.maLichDay}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: 'l'.repeat(501) } });
    assert.equal(r2.status, 400);
    assert.equal(r2.body.message, M.GV_LY_DO_VUOT_500);
  });

  it('TC-DL-36 · Giáo viên đề xuất ca thay thế không tồn tại → 400, ca vẫn chờ phản hồi', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const ca = (await t.goi('GET', '/giao-vien/ca-du-kien', { token: lan })).body.data[0];
    const r = await t.goi('POST', `/giao-vien/ca-du-kien/${ca.maLichDay}/de-xuat-thay-doi`, { token: lan, body: { lyDoThayDoi: 'Có lịch thi', maCaDeXuat: 'CA7', ngayDeXuat: ca.ngayDay } });
    assert.equal(r.status, 400);
    const pc = (await models.LichDay.findById(ca.maLichDay).lean()).phanCong.find((p) => p.maNhanSu === 'GV-001');
    assert.equal(pc.trangThaiPhanCong, 'ChoXacNhan');
  });

  it('TC-DL-37 · Lưu lịch rảnh không chọn ca nào → 400 "Bạn phải chọn ít nhất 1 ca rảnh…" (5a)', async () => {
    const r = await t.goi('PUT', '/giao-vien/lich-ranh', { token: await t.nhanSu(TK.LAN), body: { cacRanh: [] } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.LR_CHUA_CHON);
  });

  it('TC-DL-38 · Lưu lịch rảnh 5 ô nhưng có ô trùng nhau (thực chất 4 ca) → 400 "Bạn mới chọn 4 ca…" (BR02)', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const cot = (await t.goi('GET', '/giao-vien/lich-ranh', { token: lan })).body.data.cot.map((c) => c.ngay);
    const cacRanh = [cot[0], cot[1], cot[2], cot[3], cot[0]].map((n) => ({ ngayRanh: n, maCa: 'CA1' }));
    const r = await t.goi('PUT', '/giao-vien/lich-ranh', { token: lan, body: { cacRanh } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.LR_CHUA_DU(4));
  });

  it('TC-DL-39 · Lưu lịch rảnh có ca ngoài tuần kế tiếp / ca học không tồn tại → 400, lịch rảnh cũ giữ nguyên', async () => {
    const lan = await t.nhanSu(TK.LAN);
    const lr = (await t.goi('GET', '/giao-vien/lich-ranh', { token: lan })).body.data;
    const cot = lr.cot.map((c) => c.ngay);
    const hopLe = cot.slice(0, 5).map((n) => ({ ngayRanh: n, maCa: 'CA2' }));
    assert.equal((await t.goi('PUT', '/giao-vien/lich-ranh', { token: lan, body: { cacRanh: [...hopLe, { ngayRanh: '2026-11-11', maCa: 'CA1' }] } })).status, 400);
    assert.equal((await t.goi('PUT', '/giao-vien/lich-ranh', { token: lan, body: { cacRanh: [...hopLe, { ngayRanh: cot[6], maCa: 'CA4' }] } })).status, 400);
    const sau = (await t.goi('GET', '/giao-vien/lich-ranh', { token: lan })).body.data;
    assert.equal(sau.soCaDaChon, lr.soCaDaChon);
  });
});

describe('Phụ huynh / Học viên (UC_11, UC_13)', () => {
  it('TC-DL-40 · Từ chối ca học dự kiến không nhập lý do → 400 "Vui lòng nhập lý do từ chối…"; 501 ký tự → 400', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const ca = (await t.goi('GET', '/phu-huynh/lich-du-kien', { token: an })).body.data.caHoc[0];
    const r = await t.goi('POST', `/phu-huynh/lich-du-kien/${ca.maLichDay}/tu-choi`, { token: an, body: { lyDoTuChoi: '' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.message, M.XN_TRONG_LY_DO);
    const r2 = await t.goi('POST', `/phu-huynh/lich-du-kien/${ca.maLichDay}/tu-choi`, { token: an, body: { lyDoTuChoi: 'r'.repeat(501) } });
    assert.equal(r2.status, 400);
    assert.equal(r2.body.message, M.XN_LY_DO_VUOT_500);
  });

  it('TC-DL-41 · Xin nghỉ không chọn lý do / lý do ngoài danh sách / ghi chú 501 ký tự → 400, không ghi nhận báo vắng', async () => {
    const an = await t.phuHuynh(...PH.AN);
    const ca = await models.LichDay.findOne({ maLop: 'GT-A2-08', trangThaiLich: 'DaPhatHanh', ngayDay: new Date('2026-11-16T00:00:00Z') }).lean();
    for (const body of [{}, { lyDoXinNghi: 'DiChoi' }, { lyDoXinNghi: 'NghiOm', ghiChu: 'g'.repeat(501) }]) {
      const r = await t.goi('POST', `/phu-huynh/ca-hoc/${ca._id}/xin-nghi`, { token: an, body });
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40));
    }
    assert.equal((await models.LichDay.findById(ca._id).lean()).yeuCauNghiHoc.length, 0);
  });
});
