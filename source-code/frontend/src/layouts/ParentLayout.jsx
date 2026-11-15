/** Khung Cổng Phụ huynh / Học viên (MH32–MH40): thanh điều hướng ngang, thông tin học viên trong phiên. */
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import { useAuth } from '../auth/AuthContext';
/** Học viên: viết tắt theo tên gọi (hai chữ cuối) – "Nguyễn Minh An" → "MA" (Figma PH-12) */
const vietTatTen = (ten = '') => ten.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();

const NAV = [
  { to: '/phu-huynh/lich-hoc', label: 'Theo dõi lịch học' },
  { to: '/phu-huynh/xac-nhan-ca-hoc', label: 'Xác nhận ca học' },
  { to: '/phu-huynh/gui-y-kien', label: 'Gửi ý kiến' },
  { to: '/phu-huynh/tra-cuu-phieu', label: 'Tra cứu phiếu' },
];

export default function ParentLayout() {
  const { phien, dangXuat } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const hv = phien?.hocVien || {};
  const nhieuLop = (hv.dsLop || []).length > 1;
  const doiHocVien = () => {
    dangXuat();
    nav('/phu-huynh/dang-nhap');
  };
  return (
    <>
      <header className="topbar" style={{ justifyContent: 'space-between' }}>
        <Brand sub="Cổng Phụ huynh / Học viên" />
        <nav className="ph-nav">
          {NAV.map((n) => {
            // "Theo dõi lịch học": học nhiều lớp thì vào Chọn lớp (MH33), một lớp thì vào Thời khóa biểu (MH32)
            const laLichHoc = n.to === '/phu-huynh/lich-hoc';
            const den = laLichHoc && nhieuLop ? '/phu-huynh/chon-lop' : n.to;
            // Figma PH-14-e: trang Lịch sử phản hồi thuộc mục "Tra cứu phiếu"
            const on = laLichHoc ? /^\/phu-huynh\/(lich-hoc|chon-lop)/.test(loc.pathname)
              : n.to === '/phu-huynh/tra-cuu-phieu' ? /^\/phu-huynh\/(tra-cuu-phieu|lich-su-phan-hoi)/.test(loc.pathname)
                : loc.pathname.startsWith(n.to);
            return <NavLink key={n.to} to={den} className={on ? 'on' : ''}>{n.label}</NavLink>;
          })}
        </nav>
        <div className="row gap-12" style={{ marginRight: 24 }}>
          <div className="ph-chip">
            <span className="avatar gray" style={{ width: 28, height: 28, fontSize: 11 }}>{vietTatTen(hv.tenHocVien)}</span>
            <div>
              <div className="user-name">{hv.tenHocVien}</div>
              <div className="user-role">{hv.soDienThoaiAn}</div>
            </div>
          </div>
          <button className="btn-link" onClick={doiHocVien}>Đổi học viên</button>
        </div>
      </header>
      <main className="ph-content">
        <Outlet />
      </main>
    </>
  );
}
