/**
 * Phiên đăng nhập (UC_1).
 * - Nhân sự: lưu trong localStorage cho đến khi đăng xuất.
 * - Phụ huynh / Học viên: lưu trong sessionStorage – chỉ trong phiên làm việc (BR04).
 * - Tài khoản đang dùng mật khẩu tạm (mustChangePassword) bị chuyển sang màn hình đổi mật khẩu.
 * - Phiên hết hạn / bị vô hiệu: ghi lại lý do để màn hình đăng nhập thông báo cho người dùng.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, datToken, khiCanDoiMatKhau, khiPhienHetHan } from '../api/client';

const AuthContext = createContext(null);
const KHOA = 'broadway.phien';

function docPhien() {
  try {
    return JSON.parse(localStorage.getItem(KHOA) || sessionStorage.getItem(KHOA) || 'null');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [phien, setPhien] = useState(() => {
    const p = docPhien();
    if (p?.token) datToken(p.token);
    return p;
  });

  const luu = useCallback((p, tamThoi) => {
    localStorage.removeItem(KHOA);
    sessionStorage.removeItem(KHOA);
    if (p) (tamThoi ? sessionStorage : localStorage).setItem(KHOA, JSON.stringify(p));
    datToken(p?.token || null);
    setPhien(p);
  }, []);

  const [lyDoKetThuc, setLyDoKetThuc] = useState('');
  const [vaiTroCuoi, setVaiTroCuoi] = useState(null);
  const dangXuat = useCallback(() => {
    setLyDoKetThuc('');
    luu(null);
  }, [luu]);

  useEffect(() => {
    khiPhienHetHan((lyDo) => {
      setVaiTroCuoi(docPhien()?.vaiTro || null);
      setLyDoKetThuc(lyDo || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      luu(null);
    });
    khiCanDoiMatKhau(() => {
      const p = docPhien();
      if (p?.nguoiDung && !p.nguoiDung.mustChangePassword) luu({ ...p, nguoiDung: { ...p.nguoiDung, mustChangePassword: true } }, false);
    });
  }, [luu]);

  const dangNhapNhanSu = useCallback(async (tenDangNhap, matKhau) => {
    const { data } = await api('/auth/dang-nhap', { method: 'POST', body: { tenDangNhap, matKhau } });
    setLyDoKetThuc('');
    luu({ token: data.token, vaiTro: data.nguoiDung.vaiTro, nguoiDung: data.nguoiDung }, false);
    return data;
  }, [luu]);

  /** Đổi mật khẩu: nhận token mới (mọi token cũ bị vô hiệu ở máy chủ) */
  const doiMatKhau = useCallback(async (body) => {
    const { data } = await api('/auth/doi-mat-khau', { method: 'POST', body });
    luu({ token: data.token, vaiTro: data.nguoiDung.vaiTro, nguoiDung: data.nguoiDung }, false);
    return data;
  }, [luu]);

  const dangNhapPhuHuynh = useCallback(async (hoTen, soDienThoai) => {
    const { data } = await api('/auth/phu-huynh/dang-nhap', { method: 'POST', body: { hoTen, soDienThoai } });
    setLyDoKetThuc('');
    luu({ token: data.token, vaiTro: 'PhuHuynhHocVien', hocVien: data.hocVien }, true);
    return data;
  }, [luu]);

  const value = useMemo(
    () => ({ phien, dangNhapNhanSu, dangNhapPhuHuynh, dangXuat, doiMatKhau, lyDoKetThuc, vaiTroCuoi }),
    [phien, dangNhapNhanSu, dangNhapPhuHuynh, dangXuat, doiMatKhau, lyDoKetThuc, vaiTroCuoi],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
