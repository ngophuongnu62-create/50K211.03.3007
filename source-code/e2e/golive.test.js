/**
 * Ưu tiên 4 – Kiểm thử đầu–cuối trên trình duyệt cho bản triển khai.
 * Chạy trên bản production (Docker Compose) vừa khởi tạo dữ liệu mẫu: BASE_URL=http://localhost:8080 npm test
 * Các bước nối tiếp nhau như một ngày vận hành: Quản lý tạo / phân công / phát hành lịch → Giáo viên phản hồi
 * → Phụ huynh theo dõi, xin nghỉ, xác nhận, gửi ý kiến → Quản lý xử lý phiếu → Phụ huynh thấy tiến độ.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const ANH = path.resolve(__dirname, '../tai-lieu/golive/anh');
const MK = 'Broadway@2026';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');

let browser;
const loiTrang = [];
const ctx = {};

async function moTrang(ten) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    // Chỉ khi chạy thử HTTPS với chứng chỉ CA nội bộ của Caddy (tên miền *.localhost); tên miền thật không cần
    ignoreHTTPSErrors: process.env.BO_QUA_LOI_CHUNG_CHI === '1',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => loiTrang.push(`${ten}: ${e.message}`));
  page.setDefaultTimeout(15000);
  ctx[ten] = page;
  return page;
}
const chup = (page, ten) => page.screenshot({ path: path.join(ANH, `${ten}.png`) });
const nut = (page, ten, exact = true) => page.getByRole('button', { name: ten, exact });
const toast = (page, chu) => page.locator('.toast', { hasText: chu }).first().waitFor();

async function dangNhapNhanSu(page, doiTuong, ten, mk = MK) {
  await page.goto(`${BASE}/dang-nhap/${doiTuong}`);
  await page.getByPlaceholder('Nhập tên đăng nhập').fill(ten);
  await page.getByPlaceholder('Nhập mật khẩu').fill(mk);
  await nut(page, 'Đăng nhập').click();
}

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

describe('Hệ thống và đăng nhập', () => {
  it('TC-HT-01 · Mở địa chỉ triển khai: trang chọn đối tượng hiển thị đủ 3 cổng → Phụ huynh / Học viên, Quản lý, Giáo viên / Trợ giảng', async () => {
    const page = await moTrang('khach');
    await page.goto(BASE);
    await page.getByText('Bạn sử dụng hệ thống với vai trò nào?').waitFor();
    for (const t of ['Vào cổng Phụ huynh / Học viên', 'Đăng nhập Quản lý', 'Đăng nhập Giáo viên / Trợ giảng']) await nut(page, t, false).waitFor();
    await chup(page, '01-chon-doi-tuong');
  });

  it('TC-HT-02 · Mở thẳng đường dẫn sâu /quan-ly/quan-ly-lich khi chưa đăng nhập → chuyển về trang đăng nhập Quản lý', async () => {
    const page = ctx.khach;
    await page.goto(`${BASE}/quan-ly/quan-ly-lich`);
    await page.waitForURL(/\/dang-nhap\/quan-ly$/);
  });

  it('TC-HT-03 · API không tồn tại trả JSON 404; kiểm tra sức khỏe (máy chủ + CSDL) trả "ok"', async () => {
    const page = ctx.khach;
    const r404 = await page.request.get(`${BASE}/api/khong-co`);
    assert.equal(r404.status(), 404);
    assert.equal((await r404.json()).success, false);
    const sk = await page.request.get(`${BASE}/api/suc-khoe`);
    assert.equal((await sk.json()).data.trangThai, 'ok');
  });

  it('TC-QL-01 · Quản lý đăng nhập sai mật khẩu → báo "Tên đăng nhập hoặc mật khẩu không chính xác…"', async () => {
    const page = await moTrang('ql');
    await dangNhapNhanSu(page, 'quan-ly', 'quanly', 'saimatkhau1');
    await page.getByText('Tên đăng nhập hoặc mật khẩu không chính xác').waitFor();
    await chup(page, '02-dang-nhap-sai');
  });

  it('TC-QL-02 · Quản lý đăng nhập đúng → Trang chủ "Xin chào, Trần Thu Trang" kèm cảnh báo xung đột', async () => {
    const page = ctx.ql;
    await dangNhapNhanSu(page, 'quan-ly', 'quanly');
    await page.getByText('Xin chào, Trần Thu Trang').waitFor();
    await page.getByText('Cảnh báo xung đột lịch dạy').waitFor();
    await chup(page, '03-trang-chu-quan-ly');
  });
});

describe('Quản lý vận hành lịch dạy', () => {
  it('TC-QL-03 · Tạo lịch dạy mới cho IELTS 6.5 – K13: đề xuất phương án, lưu → "Tạo lịch dạy thành công!", lịch ở trạng thái Nháp', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly/quan-ly-lich/tao`);
    await page.locator('.select-trigger').first().click();
    await page.locator('.select-opt', { hasText: 'IELTS 6.5 – K13' }).click();
    await nut(page, 'Đề xuất lịch').click();
    await page.locator('.pa-card').first().waitFor();
    await chup(page, '04-phuong-an-de-xuat');
    await nut(page, 'Lưu').click();
    await page.getByText('Tạo lịch dạy thành công!').waitFor();
    await nut(page, 'Duyệt lịch dạy').click();
    await page.waitForURL(/\/quan-ly\/quan-ly-lich$/);
    await page.locator('tr', { hasText: 'IELTS 6.5 – K13' }).getByText('Nháp').waitFor();
  });

  it('TC-QL-04 · Phân công giáo viên đề xuất cho IELTS 6.5 – K12 và gửi thông báo → "Gửi phân công lịch dạy thành công!"', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly/quan-ly-lich/IE65-K12/phan-cong`);
    await page.locator('.gv-card.on', { hasText: 'Phạm Thu Hà' }).waitFor();
    await nut(page, 'Xác nhận giáo viên phân công').click();
    await page.getByText('Giáo viên được phân công').waitFor();
    await nut(page, 'Gửi thông báo cho giáo viên').click();
    await page.getByText('Gửi phân công lịch dạy thành công!').waitFor();
    await chup(page, '05-phan-cong-thanh-cong');
    await nut(page, 'OK').click();
    await page.locator('tr', { hasText: 'IELTS 6.5 – K12' }).getByText('Chờ GV xác nhận').waitFor();
  });

  it('TC-QL-05 · Phê duyệt rồi phát hành lịch Kids Movers – K04 → "Phát hành lịch dạy thành công!", gửi thông báo chính thức', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly/quan-ly-lich/Kids-K04/phe-duyet`);
    await nut(page, 'Phê duyệt').click();
    await page.getByText('Phê duyệt lịch thành công!').waitFor();
    await nut(page, 'OK').click();
    await nut(page, 'Phát hành').click();
    await page.getByText('Phát hành lịch dạy thành công!').waitFor();
    await nut(page, 'OK').click();
    await page.getByText('Gửi thông báo lịch chính thức').waitFor();
    await chup(page, '06-phat-hanh');
  });

  it('TC-QL-06 · Tra cứu lịch dạy với khoảng ngày ngược → báo "Ngày bắt đầu không được lớn hơn ngày kết thúc"; mở chi tiết một lịch', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly/tra-cuu-lich-day`);
    await page.locator('table tbody tr').first().click();
    await page.getByText('Chi tiết lịch dạy').waitFor();
    await nut(page, 'Quay lại').click();
    const o = page.locator('.control', { has: page.locator('.lucide-calendar-days') }).first();
    await o.click();
    const ngay = page.locator('.cal .cal-day');
    await ngay.nth(20).click();
    await ngay.nth(5).click();
    await nut(page, 'Tra cứu').click();
    await page.getByText('Ngày bắt đầu không được lớn hơn ngày kết thúc').waitFor();
  });
});

describe('Giáo viên / Trợ giảng', () => {
  it('TC-GV-01 · Giáo viên Phạm Thu Hà nhận lịch vừa phân công và xác nhận → "Đã xác nhận thành công"', async () => {
    const page = await moTrang('ha');
    await dangNhapNhanSu(page, 'giao-vien', 'gvphamha');
    await page.getByText('Xin chào, Phạm Thu Hà').waitFor();
    await page.goto(`${BASE}/giao-vien/phan-hoi-lich-day`);
    await page.locator('tr', { hasText: 'IELTS 6.5 – K12' }).first().getByRole('button', { name: 'Gửi phản hồi lịch dạy' }).click();
    await nut(page, 'Xác nhận duyệt lịch dạy').click();
    await toast(page, 'Đã xác nhận thành công');
    await chup(page, '07-gv-xac-nhan');
  });

  it('TC-GV-02 · Giáo viên Nguyễn Thị Lan đề xuất thay đổi bỏ trống lý do → "Không được để trống"; nhập lý do → gửi thành công', async () => {
    const page = await moTrang('lan');
    await dangNhapNhanSu(page, 'giao-vien', 'gvnguyenlan');
    await page.getByText('Xin chào, Nguyễn Thị Lan').waitFor();
    await page.goto(`${BASE}/giao-vien/phan-hoi-lich-day`);
    await page.getByRole('button', { name: 'Gửi phản hồi lịch dạy' }).first().click();
    await nut(page, 'Gửi phản hồi').click();
    await page.getByText('Không được để trống').waitFor();
    await page.locator('textarea').fill('Em có lịch thi chứng chỉ, xin đổi sang ca khác cùng tuần.');
    await nut(page, 'Gửi phản hồi').click();
    await toast(page, 'Gửi phản hồi lịch dạy thành công!');
  });

  it('TC-GV-03 · Cập nhật lịch rảnh: chọn 3 ca → "Bạn mới chọn 3 ca…"; chọn đủ 5 ca → "Cập nhật lịch rảnh thành công!" (hoặc báo cổng đã đóng nếu chạy ngoài Thứ Hai 08:00 – Thứ Năm 23:59)', async () => {
    const page = ctx.lan;
    await page.goto(`${BASE}/giao-vien/lich-ranh`);
    await page.locator('.lr-grid').waitFor();
    if (await page.getByText('Hệ thống đã đóng cổng đăng ký lịch rảnh').isVisible()) {
      await chup(page, '08-lich-ranh-cong-dong');
      return;
    }
    await nut(page, 'Bỏ chọn tất cả').click();
    const o = page.locator('.lr-o');
    for (const i of [7, 8, 9]) await o.nth(i).click();
    await nut(page, 'Lưu cập nhật').click();
    await page.getByText('Bạn mới chọn 3 ca').waitFor();
    for (const i of [10, 11]) await o.nth(i).click();
    await nut(page, 'Lưu cập nhật').click();
    await toast(page, 'Cập nhật lịch rảnh thành công!');
    await chup(page, '08-lich-ranh');
  });

  it('TC-GV-04 · Chuyển ngôn ngữ sang EN → menu hiển thị tiếng Anh ("My schedule")', async () => {
    const page = ctx.lan;
    await page.locator('.lang-toggle').getByText('EN', { exact: true }).click();
    await page.getByText('My schedule').waitFor();
    await page.locator('.lang-toggle').getByText('VI', { exact: true }).click();
    await page.getByText('Lịch dạy cá nhân').first().waitFor();
  });

  it('TC-HT-04 · Giáo viên mở trang của Quản lý (/quan-ly/ho-so-giao-vien) → bị chuyển về Trang chủ Giáo viên', async () => {
    const page = ctx.lan;
    await page.goto(`${BASE}/quan-ly/ho-so-giao-vien`);
    await page.waitForURL(/\/giao-vien$/);
  });
});

describe('Phụ huynh / Học viên', () => {
  it('TC-PH-01 · Phụ huynh nhập sai số điện thoại → báo "Thông tin Tên học viên hoặc Số điện thoại không chính xác…"', async () => {
    const page = await moTrang('an');
    await page.goto(`${BASE}/phu-huynh/dang-nhap`);
    await page.getByPlaceholder('VD: Nguyễn Minh An').fill('Nguyễn Minh An');
    await page.getByPlaceholder('Số điện thoại đã đăng ký').fill('0905000999');
    await nut(page, 'Đăng nhập').click();
    await page.getByText('Thông tin Tên học viên hoặc Số điện thoại không chính xác').waitFor();
  });

  it('TC-PH-02 · Học viên học 3 lớp đăng nhập → màn hình Chọn lớp → xem thời khóa biểu Giao tiếp A2 – K08', async () => {
    const page = ctx.an;
    await page.getByPlaceholder('Số điện thoại đã đăng ký').fill('0905 000 456');
    await nut(page, 'Đăng nhập').click();
    await page.waitForURL(/\/phu-huynh\/chon-lop$/);
    await page.getByText('Học viên Nguyễn Minh An đang theo học 3 lớp.').waitFor();
    await chup(page, '09-chon-lop');
    await page.locator('section', { hasText: 'Giao tiếp A2 – K08' }).getByRole('button', { name: 'Xem thời khóa biểu' }).click();
    await page.locator('.tkb-grid').waitFor();
    await page.getByText('Giao tiếp A2 – K08 · Lịch này đã được phê duyệt và phát hành').waitFor();
  });

  it('TC-PH-03 · Xin nghỉ một ca tuần sau → "Gửi yêu cầu xin nghỉ thành công", ca hiển thị "Báo vắng"', async () => {
    const page = ctx.an;
    await page.getByRole('button', { name: 'Tuần sau' }).click();
    await page.locator('.tkb-o.co').first().waitFor();
    await page.locator('.tkb-o.co').first().click();
    await page.getByText('Chi tiết ca học').waitFor();
    await nut(page, 'Xin nghỉ ca này').click();
    await page.getByText('Thông tin ca học được điền sẵn').waitFor();
    await page.locator('.modal .select-trigger').click();
    await page.locator('.select-opt', { hasText: 'Nghỉ ốm' }).click();
    await page.locator('.modal textarea').fill('Bé bị sốt, gia đình xin cho nghỉ buổi này.');
    await nut(page, 'Gửi yêu cầu').click();
    await toast(page, 'Gửi yêu cầu xin nghỉ thành công');
    await page.locator('.tkb-o.co', { hasText: 'Báo vắng' }).first().waitFor();
    await chup(page, '10-xin-nghi');
  });

  it('TC-PH-04 · Xác nhận một ca học dự kiến → thành công; từ chối ca khác bỏ trống lý do → báo lỗi, nhập lý do → gửi thành công', async () => {
    const page = ctx.an;
    await page.goto(`${BASE}/phu-huynh/xac-nhan-ca-hoc`);
    await nut(page, 'Xác nhận ca học').first().click();
    await nut(page, 'Đồng ý').click();
    await toast(page, 'Xác nhận tham gia ca học thành công');
    await page.getByText('Đã xác nhận ca học').first().waitFor();
    await nut(page, 'Từ chối ca học').first().click();
    await nut(page, 'Gửi phản hồi từ chối').click();
    await page.getByText('Vui lòng nhập lý do từ chối xác nhận lịch học').waitFor();
    await page.locator('.modal textarea').fill('Học viên có lịch thi học kỳ ở trường vào buổi này.');
    await nut(page, 'Gửi phản hồi từ chối').click();
    await toast(page, 'Đã gửi phản hồi từ chối xác nhận ca học thành công');
    await chup(page, '11-xac-nhan-ca-hoc');
  });

  it('TC-PH-05 · Gửi ý kiến kèm ảnh minh chứng → "Gửi thành công" kèm mã phiếu → Tra cứu tiến độ hiển thị "Đã tiếp nhận"', async () => {
    const page = ctx.an;
    await page.goto(`${BASE}/phu-huynh/gui-y-kien`);
    await page.getByRole('radio', { name: 'Cơ sở vật chất' }).click();
    await page.getByPlaceholder('Nhập tiêu đề').fill('Phòng P.102 thiếu máy chiếu (kiểm thử golive)');
    await page.locator('textarea').fill('Hai buổi gần đây máy chiếu phòng P.102 không hoạt động, mong trung tâm kiểm tra giúp.');
    await page.locator('input[type=file]').setInputFiles({ name: 'may-chieu.png', mimeType: 'image/png', buffer: PNG });
    await nut(page, 'Gửi phản hồi').click();
    await page.getByText('Gửi thành công').waitFor();
    ctx.maPhieu = (await page.locator('text=/^PH-\\d{4}-\\d{4}$/').textContent()).trim();
    await chup(page, '12-ma-phieu');
    await nut(page, 'Tra cứu tiến độ').click();
    await page.getByText('Phòng P.102 thiếu máy chiếu (kiểm thử golive)').waitFor();
    await page.locator('.badge', { hasText: 'Đã tiếp nhận' }).waitFor();
  });

  it('TC-QL-07 · Quản lý thấy phiếu mới trong "Phản hồi & yêu cầu", cập nhật "Đang xử lý" → "Cập nhật trạng thái thành công!"', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly/phan-hoi`);
    await page.locator('tr', { hasText: ctx.maPhieu }).click();
    await page.getByText(`Mã phản hồi ${ctx.maPhieu}`).waitFor();
    await nut(page, 'Cập nhật trạng thái').click();
    await page.locator('.modal .select-trigger').click();
    await page.locator('.select-opt', { hasText: 'Đang xử lý' }).click();
    await page.locator('.modal textarea').fill('Đã báo bộ phận kỹ thuật kiểm tra máy chiếu.');
    await nut(page, 'Lưu').click();
    await toast(page, 'Cập nhật trạng thái thành công!');
    await chup(page, '13-ql-xu-ly-phieu');
  });

  it('TC-PH-06 · Phụ huynh tra cứu lại mã phiếu → tiến độ đồng bộ "Đang xử lý", không lộ ghi chú nội bộ của Quản lý', async () => {
    const page = ctx.an;
    await page.goto(`${BASE}/phu-huynh/tra-cuu-phieu?ma=${ctx.maPhieu}`);
    await page.locator('.badge', { hasText: 'Đang xử lý' }).waitFor();
    assert.equal(await page.getByText('Đã báo bộ phận kỹ thuật kiểm tra máy chiếu.').count(), 0);
    await chup(page, '14-tra-cuu-phieu');
  });

  it('TC-PH-07 · Bấm "Đổi học viên" → về trang đăng nhập; mở lại thời khóa biểu → bị chuyển về đăng nhập', async () => {
    const page = ctx.an;
    await page.getByRole('button', { name: 'Đổi học viên' }).click();
    await page.waitForURL(/\/phu-huynh\/dang-nhap$/);
    await page.goto(`${BASE}/phu-huynh/lich-hoc`);
    await page.waitForURL(/\/phu-huynh\/dang-nhap$/);
  });
});

describe('Kết thúc phiên', () => {
  it('TC-HT-05 · Quản lý đăng xuất → về trang chọn đối tượng; quay lại trang quản lý → bị yêu cầu đăng nhập lại', async () => {
    const page = ctx.ql;
    await page.goto(`${BASE}/quan-ly`);
    await page.locator('.sidebar').getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/quan-ly'));
    await page.goto(`${BASE}/quan-ly`);
    await page.waitForURL(/\/dang-nhap\/quan-ly$/);
  });

  it('TC-HT-06 · Không có lỗi JavaScript nào trên mọi trang đã đi qua', () => {
    assert.deepEqual(loiTrang, []);
  });
});
