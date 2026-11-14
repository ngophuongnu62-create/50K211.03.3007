/**
 * Kiểm thử đầu–cuối TIÊU CHUẨN PRODUCTION – chạy trên bản Docker vừa khởi tạo bằng init-master-data
 * (CSDL chỉ có danh mục gốc + tài khoản Admin với mật khẩu tạm, CHƯA nạp dữ liệu demo):
 *   BASE_URL=http://localhost:8080 ADMIN_MAT_KHAU=<mật khẩu tạm in trong log> node --test production.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const ADMIN = process.env.ADMIN_TEN_DANG_NHAP || 'admin';
const MK_TAM = process.env.ADMIN_MAT_KHAU;
const MK_MOI = process.env.ADMIN_MAT_KHAU_MOI || 'Broadway2026Moi';
const ANH = path.resolve(__dirname, '../tai-lieu/golive/anh');

let browser;
const loiTrang = [];
const trang = {};

async function moTrang(ten) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
    // Chỉ khi chạy thử HTTPS với chứng chỉ CA nội bộ của Caddy (tên miền *.localhost); tên miền thật không cần
    ignoreHTTPSErrors: process.env.BO_QUA_LOI_CHUNG_CHI === '1',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => loiTrang.push(`${ten}: ${e.message}`));
  page.setDefaultTimeout(15000);
  trang[ten] = page;
  return page;
}
const chup = (page, ten) => page.screenshot({ path: path.join(ANH, `${ten}.png`) });
const nut = (page, ten) => page.getByRole('button', { name: ten, exact: true });

async function dangNhap(page, mk) {
  await page.goto(`${BASE}/dang-nhap/quan-ly`);
  await page.getByPlaceholder('Nhập tên đăng nhập').fill(ADMIN);
  await page.getByPlaceholder('Nhập mật khẩu').fill(mk);
  await nut(page, 'Đăng nhập').click();
}
async function dienDoiMatKhau(page, hienTai, moi, xacNhan = moi) {
  await page.getByPlaceholder('Nhập mật khẩu hiện tại', { exact: true }).fill(hienTai);
  await page.getByPlaceholder('Nhập mật khẩu mới', { exact: true }).fill(moi);
  await page.getByPlaceholder('Nhập lại mật khẩu mới', { exact: true }).fill(xacNhan);
}

before(async () => {
  assert.ok(MK_TAM, 'Cần biến ADMIN_MAT_KHAU = mật khẩu tạm của Admin (in trong log khởi động: docker compose logs app)');
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); });

describe('Bảo mật bản triển khai', () => {
  it('TC-SX-E01 · CORS: trang web lạ gọi API → 403 "Địa chỉ truy cập không được phép…"; giao diện chính thức gọi bình thường', async () => {
    const page = await moTrang('cors');
    const la = await page.request.post(`${BASE}/api/auth/dang-nhap`, { headers: { Origin: 'https://trang-gia-mao.example' }, data: { tenDangNhap: ADMIN, matKhau: 'x' } });
    assert.equal(la.status(), 403);
    assert.equal((await la.json()).code, 'NGUON_KHONG_DUOC_PHEP');
    assert.equal(la.headers()['access-control-allow-origin'], undefined);
    const dung = await page.request.get(`${BASE}/api/suc-khoe`, { headers: { Origin: BASE } });
    assert.equal(dung.status(), 200);
  });

  it('TC-SX-E02 · Admin khởi tạo đăng nhập bằng mật khẩu tạm → bị chuyển sang "Đổi mật khẩu tạm", không vào được trang Quản lý', async () => {
    const page = await moTrang('admin');
    await dangNhap(page, MK_TAM);
    await page.waitForURL(`${BASE}/doi-mat-khau`);
    await page.getByRole('heading', { name: 'Đổi mật khẩu tạm' }).waitFor();
    await page.goto(`${BASE}/quan-ly/ho-so-giao-vien`);
    await page.waitForURL(`${BASE}/doi-mat-khau`);
    const api = await page.evaluate(async () => {
      const p = JSON.parse(localStorage.getItem('broadway.phien'));
      const r = await fetch('/api/quan-ly/tong-quan', { headers: { Authorization: `Bearer ${p.token}` } });
      return { status: r.status, body: await r.json() };
    });
    assert.equal(api.status, 403);
    assert.equal(api.body.code, 'PHAI_DOI_MAT_KHAU');
    await chup(page, 'SX-01-doi-mat-khau-tam');
    // Một phiên khác của cùng tài khoản (thiết bị thứ hai) đăng nhập trước khi mật khẩu được đổi
    const may2 = await moTrang('admin-may-2');
    await dangNhap(may2, MK_TAM);
    await may2.waitForURL(`${BASE}/doi-mat-khau`);
  });

  it('TC-SX-E03 · Mật khẩu mới yếu / xác nhận không khớp → báo lỗi tiếng Việt ngay trên biểu mẫu', async () => {
    const page = trang.admin;
    await dienDoiMatKhau(page, MK_TAM, 'abcdefgh');
    await nut(page, 'Đổi mật khẩu').click();
    await page.locator('.alert', { hasText: 'gồm cả chữ cái và chữ số' }).waitFor();
    await dienDoiMatKhau(page, MK_TAM, MK_MOI, `${MK_MOI}x`);
    await nut(page, 'Đổi mật khẩu').click();
    await page.locator('.alert', { hasText: 'Xác nhận mật khẩu mới không khớp' }).waitFor();
    await dienDoiMatKhau(page, 'SaiMatKhau123', MK_MOI);
    await nut(page, 'Đổi mật khẩu').click();
    await page.locator('.alert', { hasText: 'Mật khẩu hiện tại không chính xác' }).waitFor();
    await chup(page, 'SX-02-doi-mat-khau-loi');
  });

  it('TC-SX-E04 · Bấm đúp nút "Đổi mật khẩu" → chỉ 1 yêu cầu được gửi; đổi thành công → vào Trang chủ Quản lý', async () => {
    const page = trang.admin;
    let soYeuCau = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/auth/doi-mat-khau')) soYeuCau += 1; });
    await dienDoiMatKhau(page, MK_TAM, MK_MOI);
    await nut(page, 'Đổi mật khẩu').dblclick();
    await page.waitForURL(`${BASE}/quan-ly`);
    await page.locator('.toast', { hasText: 'Đổi mật khẩu thành công' }).waitFor();
    assert.equal(soYeuCau, 1);
    await chup(page, 'SX-03-doi-mat-khau-thanh-cong');
  });

  it('TC-SX-E05 · Thiết bị thứ hai còn giữ phiên cũ → bị đăng xuất, về trang đăng nhập kèm lý do "Phiên đăng nhập đã hết hiệu lực…"', async () => {
    const page = trang['admin-may-2'];
    await dienDoiMatKhau(page, MK_TAM, 'MotMatKhauKhac2026');
    await nut(page, 'Đổi mật khẩu').click();
    await page.waitForURL(`${BASE}/dang-nhap/quan-ly`);
    await page.locator('.alert', { hasText: 'Phiên đăng nhập đã hết hiệu lực' }).waitFor();
    await chup(page, 'SX-04-phien-cu-bi-vo-hieu');
  });

  it('TC-SX-E06 · Mật khẩu tạm không dùng được nữa; mật khẩu mới đăng nhập thẳng vào Trang chủ', async () => {
    const page = trang['admin-may-2'];
    await dangNhap(page, MK_TAM);
    await page.locator('.alert', { hasText: 'Tên đăng nhập hoặc mật khẩu không chính xác' }).waitFor();
    await dangNhap(page, MK_MOI);
    await page.waitForURL(`${BASE}/quan-ly`);
  });
});

describe('Xử lý lỗi thân thiện trên giao diện', () => {
  it('TC-SX-E07 · Mất kết nối khi đăng nhập → "Không kết nối được máy chủ…"; máy chủ bảo trì (502 trang HTML) → "Hệ thống đang bận…"', async () => {
    const page = await moTrang('mat-mang');
    await page.route('**/api/auth/dang-nhap', (route) => route.abort('internetdisconnected'));
    await dangNhap(page, 'bat-ky-123');
    await page.locator('.alert', { hasText: 'Không kết nối được máy chủ' }).waitFor();
    await page.unroute('**/api/auth/dang-nhap');
    await page.route('**/api/auth/dang-nhap', (route) => route.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502 Bad Gateway</body></html>' }));
    await nut(page, 'Đăng nhập').click();
    await page.locator('.alert', { hasText: 'Hệ thống đang bận hoặc đang bảo trì' }).waitFor();
    await chup(page, 'SX-05-loi-ket-noi');
  });

  it('TC-SX-E08 · Dải cảnh báo "Mất kết nối mạng…" hiện khi thiết bị offline và tự ẩn khi có mạng lại', async () => {
    const page = trang['mat-mang'];
    await page.context().setOffline(true);
    await page.locator('.alert', { hasText: 'Mất kết nối mạng' }).waitFor();
    await page.context().setOffline(false);
    await page.locator('.alert', { hasText: 'Mất kết nối mạng' }).waitFor({ state: 'detached' });
  });

  it('TC-SX-E09 · Không có lỗi JavaScript nào trên mọi trang đã đi qua', () => {
    assert.deepEqual(loiTrang, []);
  });
});
