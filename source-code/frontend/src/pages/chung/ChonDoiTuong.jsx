/** MH01 – Chọn đối tượng sử dụng (C-01) */
import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, Phone, Shield, Users } from 'lucide-react';

const THE = [
  {
    icon: Users,
    tieuDe: 'Phụ huynh / Học viên',
    moTa: 'Đăng nhập bằng Họ tên học viên và Số điện thoại. Không cần mật khẩu.',
    nut: 'Vào cổng Phụ huynh / Học viên',
    to: '/phu-huynh/dang-nhap',
  },
  {
    icon: Shield,
    tieuDe: 'Quản lý',
    moTa: 'Lập lịch, phân công giáo viên, phê duyệt lịch và xử lý phản hồi.',
    nut: 'Đăng nhập Quản lý',
    to: '/dang-nhap/quan-ly',
  },
  {
    icon: GraduationCap,
    tieuDe: 'Giáo viên / Trợ giảng',
    moTa: 'Xem lịch dạy, xác nhận ca dạy, cập nhật lịch rảnh và gửi yêu cầu.',
    nut: 'Đăng nhập Giáo viên / Trợ giảng',
    to: '/dang-nhap/giao-vien',
  },
];

export default function ChonDoiTuong() {
  const nav = useNavigate();
  return (
    <div className="col center" style={{ minHeight: 'calc(100vh - 64px)', padding: '48px 24px' }}>
      <div style={{ width: 1180, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="t-32">Bạn sử dụng hệ thống với vai trò nào?</h1>
          <p className="t-16 c-muted" style={{ marginTop: 12 }}>Chọn đúng đối tượng để vào các chức năng phù hợp.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 40 }}>
          {THE.map((t) => (
            <div key={t.tieuDe} className="card" style={{ padding: 32, borderRadius: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--pink-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <t.icon size={22} color="var(--brand)" />
              </div>
              <h2 className="t-22" style={{ fontSize: 22, fontWeight: 700, marginTop: 24 }}>{t.tieuDe}</h2>
              <p className="t-15 c-ink-600" style={{ marginTop: 10, lineHeight: 1.55, minHeight: 46 }}>{t.moTa}</p>
              <button className="btn btn-primary lg block" style={{ marginTop: 24 }} onClick={() => nav(t.to)}>
                {t.nut}<ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
        <a href="tel:02363888999" className="row center gap-8 t-13 c-ink-600" style={{ marginTop: 40 }}>
          <Phone size={15} />Cần hỗ trợ? Hotline 0236 3 888 999
        </a>
      </div>
    </div>
  );
}
