/**
 * Khung màn hình Quản lý (MH04–MH24) và Giáo viên / Trợ giảng (MH25–MH31):
 * thanh tiêu đề (chuông thông báo, tài khoản), menu đỏ bên trái, mục đang chọn nền trắng.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarCheck, CalendarClock, CalendarDays, ChevronDown, Clock, DoorOpen, Globe, LayoutGrid, LogOut,
  MessageSquare, Search, Send, User, Users,
} from 'lucide-react';
import Brand from './Brand';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { gioNgay, NHAN_HINH_THUC, NHAN_LOAI_NHAN_SU, vietTat } from '../lib/format';
import { useLang } from '../lib/lang';
import { Modal } from '../components/ui';

const MENU = {
  QuanLy: {
    nhan: 'QUẢN LÝ',
    muc: [
      { to: '/quan-ly', label: 'Trang chủ', icon: LayoutGrid, end: true },
      { to: '/quan-ly/phong-hoc', label: 'Phòng học', icon: DoorOpen },
      { to: '/quan-ly/ho-so-giao-vien', label: 'Hồ sơ giáo viên', icon: Users },
      { to: '/quan-ly/phan-hoi', label: 'Phản hồi & yêu cầu', icon: MessageSquare, dem: 'phanHoi' },
      { to: '/quan-ly/tra-cuu-lich-day', label: 'Tra cứu lịch dạy', icon: Search },
      { to: '/quan-ly/quan-ly-lich', label: 'Quản lý lịch dạy', icon: CalendarClock },
    ],
  },
  GiaoVien: {
    nhan: 'GIÁO VIÊN / TRỢ GIẢNG',
    muc: [
      { to: '/giao-vien', label: 'Trang chủ', icon: LayoutGrid, end: true },
      { to: '/giao-vien/lich-day', label: 'Lịch dạy cá nhân', icon: CalendarDays },
      { to: '/giao-vien/phan-hoi-lich-day', label: 'Phản hồi lịch dạy', icon: CalendarCheck, dem: 'caDuKien' },
      { to: '/giao-vien/lich-ranh', label: 'Cập nhật lịch rảnh', icon: Clock },
      { to: '/giao-vien/yeu-cau', label: 'Phản hồi / yêu cầu', icon: Send },
    ],
  },
};

function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

/** Chu kỳ hỏi thông báo mới – NFR UC_13: Quản lý nhận thông báo đẩy tức thì khi học viên báo vắng */
const CHU_KY_THONG_BAO = 10000;

export function ThongBaoChuong({ t = (s) => s, onMoi }) {
  const [mo, setMo] = useState(false);
  const [ds, setDs] = useState([]);
  const ref = useRef(null);
  const daThay = useRef(null); // mã thông báo đã có; null = chưa tải lần đầu
  const toast = useToast();
  useClickOutside(ref, () => setMo(false));
  useEffect(() => {
    let huy = false;
    const tai = () => api('/thong-bao').then((r) => {
      if (huy) return;
      const moi = daThay.current ? r.data.filter((x) => !daThay.current.has(x.maThongBao)) : [];
      daThay.current = new Set(r.data.map((x) => x.maThongBao));
      setDs(r.data);
      if (!moi.length) return;
      // Đẩy ngay: thông báo nổi trong trang + thông báo của trình duyệt khi người dùng đã cho phép
      for (const x of moi.slice(0, 3)) {
        toast({ type: x.loaiThongBao === 'BaoVang' ? 'warning' : 'success', title: x.tieuDe, text: x.noiDung, thoiGian: 8000 });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          try { new Notification(x.tieuDe, { body: x.noiDung, tag: x.maThongBao }); } catch { /* trình duyệt không hỗ trợ */ }
        }
      }
      onMoi?.();
    }).catch(() => {});
    tai();
    const h = setInterval(() => { if (!document.hidden || typeof Notification !== 'undefined') tai(); }, CHU_KY_THONG_BAO);
    const khiQuayLai = () => { if (!document.hidden) tai(); };
    document.addEventListener('visibilitychange', khiQuayLai);
    return () => { huy = true; clearInterval(h); document.removeEventListener('visibilitychange', khiQuayLai); };
  }, [toast, onMoi]);
  const moChuong = () => {
    setMo((m) => !m);
    // Xin quyền thông báo trình duyệt khi người dùng chủ động bấm chuông (không làm phiền khi vừa mở trang)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };
  const coMoi = ds.some((x) => Date.now() - new Date(x.thoiDiemGui).getTime() < 24 * 3600 * 1000);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={moChuong} aria-label={t('Thông báo')}>
        <Bell size={18} />
        {coMoi && <span className="dot" />}
      </button>
      {mo && (
        <div className="select-pop" style={{ left: 'auto', right: 0, width: 360, top: 44, padding: 8 }}>
          <div className="t-14 w-600" style={{ padding: '6px 8px 10px' }}>{t('Thông báo')}</div>
          {!ds.length && <div className="c-muted t-13" style={{ padding: 8 }}>{t('Chưa có thông báo')}</div>}
          {ds.slice(0, 8).map((x) => (
            <div key={x.maThongBao} style={{ padding: '10px 8px', borderTop: '1px solid var(--line)' }}>
              <div className="t-13 w-600">{x.tieuDe}</div>
              <div className="t-12 c-ink-600 mt-4">{x.noiDung}</div>
              <div className="t-11 c-muted mt-4">{gioNgay(x.thoiDiemGui)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StaffLayout({ vaiTro }) {
  const { phien, dangXuat } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const laGV = vaiTro === 'GiaoVien';
  const menu = MENU[laGV ? 'GiaoVien' : 'QuanLy'];
  const nd = phien?.nguoiDung || {};
  const [dem, setDem] = useState({});
  const [moMenu, setMoMenu] = useState(false);
  const [moTaiKhoan, setMoTaiKhoan] = useState(false);
  const refMenu = useRef(null);
  useClickOutside(refMenu, () => setMoMenu(false));

  const taiDem = useCallback(() => {
    if (laGV) api('/giao-vien/ca-du-kien').then((r) => setDem({ caDuKien: r.data.length })).catch(() => {});
    else api('/quan-ly/phan-hoi').then((r) => setDem({ phanHoi: r.data.dem.ChoXuLy || 0 })).catch(() => {});
  }, [laGV]);
  useEffect(() => { taiDem(); }, [taiDem]);

  const thoat = () => {
    dangXuat();
    nav('/');
  };
  const vaiTroNhan = laGV
    ? `${NHAN_LOAI_NHAN_SU[nd.vaiTro] || 'Giáo viên'} · ${NHAN_HINH_THUC[nd.hinhThucLamViec] || ''}`
    : 'Quản lý trung tâm';

  return (
    <>
      <header className="topbar">
        <div className="brand-block row"><Brand sub="Quản lý lịch dạy" /></div>
        <div className="topbar-right">
          {laGV && (
            <div className="lang-toggle" role="group" aria-label="Ngôn ngữ">
              <button className={lang === 'vi' ? 'on' : ''} onClick={() => setLang('vi')}>VI</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
          )}
          <ThongBaoChuong t={t} onMoi={taiDem} />
          <div className="vsep" />
          <div ref={refMenu} style={{ position: 'relative' }}>
            <button className="user-chip" onClick={() => setMoMenu((m) => !m)} aria-haspopup="menu" aria-expanded={moMenu}>
              <span className={`avatar ${laGV ? 'gray' : ''}`}>{vietTat(nd.hoTen)}</span>
              <span>
                <div className="user-name">{nd.hoTen}</div>
                <div className="user-role">{vaiTroNhan}</div>
              </span>
              <ChevronDown size={16} color="var(--ink-500)" />
            </button>
            {moMenu && (
              <div className="select-pop menu-tk" role="menu" style={{ left: 'auto', right: 0, width: 280, top: 48 }}>
                <div style={{ padding: '10px 12px' }}>
                  <div className="t-14 w-600" style={{ lineHeight: '17px' }}>{nd.hoTen}</div>
                  <div className="t-12 c-muted" style={{ marginTop: 2, lineHeight: '15px' }}>{vaiTroNhan}</div>
                  {nd.email && <div className="t-12 c-muted" style={{ marginTop: 2, lineHeight: '15px' }}>{nd.email}</div>}
                </div>
                <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                <div className="select-opt" role="menuitem" onClick={() => { setMoTaiKhoan(true); setMoMenu(false); }}>
                  <span className="row" style={{ gap: 10 }}><User size={18} />{t('Thông tin tài khoản')}</span>
                </div>
                {laGV && (
                  <div className="select-opt" role="menuitem" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}>
                    <span className="row" style={{ gap: 10 }}><Globe size={18} />{t('Ngôn ngữ')}</span>
                    <span className="t-13 c-muted w-500">{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>
                  </div>
                )}
                <div className="select-opt" role="menuitem" onClick={thoat} style={{ color: 'var(--brand-700)' }}>
                  <span className="row" style={{ gap: 10 }}><LogOut size={18} />{t('Đăng xuất')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <nav>
            <div className="sidebar-label">{t(menu.nhan)}</div>
            {menu.muc.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <m.icon size={20} />
                <span>{t(m.label)}</span>
                {m.dem && dem[m.dem] > 0 && <span className="nav-badge">{dem[m.dem]}</span>}
              </NavLink>
            ))}
          </nav>
          <button className="nav-item" onClick={thoat}><LogOut size={20} /><span>{t('Đăng xuất')}</span></button>
        </aside>
        <main className="content">
          <div className="content-inner">
            <Outlet context={{ capNhatDem: (k, v) => setDem((d) => ({ ...d, [k]: v })) }} />
          </div>
        </main>
      </div>
      <Modal open={moTaiKhoan} onClose={() => setMoTaiKhoan(false)} title={t('Thông tin tài khoản')}>
        <dl className="kv">
          <dt>Họ và tên</dt><dd>{nd.hoTen}</dd>
          <dt>Mã người dùng</dt><dd>{nd.ma}</dd>
          <dt>Vai trò</dt><dd>{vaiTroNhan}</dd>
          {nd.email && <><dt>Email</dt><dd>{nd.email}</dd></>}
        </dl>
      </Modal>
    </>
  );
}
