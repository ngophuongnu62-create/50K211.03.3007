/**
 * Gọi API backend. Lỗi trả về theo chuẩn { success:false, code, message, fieldErrors, data }
 * được chuyển thành ApiError với câu thông báo tiếng Việt thân thiện để màn hình hiển thị.
 *
 * Gia cố vận hành thực tế:
 *  - Quá thời gian chờ (30 giây, tải tệp 2 phút) → hủy yêu cầu, báo "Máy chủ phản hồi quá lâu…".
 *  - Mất mạng / máy chủ tắt / proxy trả trang HTML lỗi → câu thông báo dễ hiểu, không lộ lỗi kỹ thuật.
 *  - Yêu cầu đọc (GET) gặp lỗi mạng hoặc 502/503/504 được thử lại 1 lần sau 1 giây.
 *  - 401 khi đang đăng nhập → kết thúc phiên; 403 PHAI_DOI_MAT_KHAU → chuyển sang màn hình đổi mật khẩu.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const THOI_GIAN_CHO_MS = 30000;
const THOI_GIAN_CHO_TEP_MS = 120000;

const THONG_BAO = {
  MAT_KET_NOI: 'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại!',
  QUA_THOI_GIAN: 'Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút!',
  BAO_TRI: 'Hệ thống đang bận hoặc đang bảo trì. Vui lòng thử lại sau ít phút!',
  LOI_HE_THONG: 'Đã có lỗi xảy ra. Vui lòng thử lại!',
  QUA_LON: 'Dữ liệu hoặc tệp gửi lên quá lớn. Vui lòng giảm dung lượng và thử lại!',
  HET_PHIEN: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  QUA_NHIEU: 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.',
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || THONG_BAO.LOI_HE_THONG);
    this.status = status;
    this.code = body?.code;
    this.fieldErrors = body?.fieldErrors || {};
    this.data = body?.data;
    /** Mã tra cứu nhật ký máy chủ (lỗi 5xx) – người dùng báo lại cho bộ phận kỹ thuật */
    this.maYeuCau = body?.maYeuCau;
  }
}

let token = null;
let khiHetPhien = null;
let khiPhaiDoiMatKhau = null;

export function datToken(t) {
  token = t;
}

export function khiPhienHetHan(fn) {
  khiHetPhien = fn;
}

export function khiCanDoiMatKhau(fn) {
  khiPhaiDoiMatKhau = fn;
}

const cho = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

/** Câu thông báo khi máy chủ không trả JSON chuẩn (proxy, máy chủ tắt, trang lỗi HTML) */
function thongBaoTheoMa(status) {
  if (status === 401) return THONG_BAO.HET_PHIEN;
  if (status === 413) return THONG_BAO.QUA_LON;
  if (status === 429) return THONG_BAO.QUA_NHIEU;
  if ([502, 503, 504].includes(status)) return THONG_BAO.BAO_TRI;
  return THONG_BAO.LOI_HE_THONG;
}

async function guiMotLan(url, init, thoiGianCho) {
  const huy = new AbortController();
  const hen = setTimeout(() => huy.abort(), thoiGianCho);
  try {
    return await fetch(url, { ...init, signal: huy.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new ApiError(0, { code: 'QUA_THOI_GIAN', message: THONG_BAO.QUA_THOI_GIAN });
    throw new ApiError(0, { code: 'MAT_KET_NOI', message: THONG_BAO.MAT_KET_NOI });
  } finally {
    clearTimeout(hen);
  }
}

export async function api(path, { method = 'GET', body, form, query } = {}) {
  const url = new URL(`${BASE}/api${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const init = { method, headers, body: payload };
  const thoiGianCho = form ? THOI_GIAN_CHO_TEP_MS : THOI_GIAN_CHO_MS;
  const laDoc = method === 'GET';

  let res;
  try {
    res = await guiMotLan(url, init, thoiGianCho);
    // Chỉ thử lại yêu cầu đọc: an toàn vì không làm thay đổi dữ liệu
    if (laDoc && [502, 503, 504].includes(res.status)) {
      await cho(1000);
      res = await guiMotLan(url, init, thoiGianCho);
    }
  } catch (err) {
    if (!laDoc || err.code === 'QUA_THOI_GIAN') throw err;
    await cho(1000);
    res = await guiMotLan(url, init, thoiGianCho);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const loi = new ApiError(res.status, json?.message ? json : { ...json, message: thongBaoTheoMa(res.status) });
    if (res.status === 401 && token && khiHetPhien) khiHetPhien(loi.message);
    if (res.status === 403 && loi.code === 'PHAI_DOI_MAT_KHAU' && khiPhaiDoiMatKhau) khiPhaiDoiMatKhau();
    if (res.status >= 500 && loi.maYeuCau) loi.message = `${loi.message} (Mã tra cứu: ${loi.maYeuCau.slice(0, 8)})`;
    throw loi;
  }
  return { data: json.data, message: json.message };
}

/** Đường dẫn đầy đủ tới tệp tải lên (ảnh bằng cấp, tệp minh chứng) */
export const duongDanTep = (p) => (!p ? p : p.startsWith('http') ? p : `${BASE}${p}`);
