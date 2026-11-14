/**
 * MH02 – Đăng nhập nhân sự (C-02 Quản lý, C-05 Giáo viên / Trợ giảng)
 * Ngoại lệ 3.a (C-03): thiếu thông tin; 5.a (C-04): sai thông tin.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Field, TextInput } from '../../components/ui';
import LoginPanel from './LoginPanel';

const TIEU_DE = {
  'quan-ly': { tieuDe: 'Đăng nhập Quản lý', phu: 'Dành cho Quản lý trung tâm Broadway.' },
  'giao-vien': { tieuDe: 'Đăng nhập Giáo viên / Trợ giảng', phu: 'Dành cho giáo viên, trợ giảng toàn thời gian và bán thời gian.' },
};
const THIEU = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';

export default function DangNhapNhanSu() {
  const { doiTuong } = useParams();
  const td = TIEU_DE[doiTuong] || TIEU_DE['quan-ly'];
  const { dangNhapNhanSu, lyDoKetThuc } = useAuth();
  const dangGuiRef = useRef(false);
  const nav = useNavigate();
  const [ten, setTen] = useState('');
  const [mk, setMk] = useState('');
  const [hien, setHien] = useState(false);
  const [loi, setLoi] = useState('');
  const [thieu, setThieu] = useState({});
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e) => {
    e.preventDefault();
    if (dangGuiRef.current) return; // chống bấm đúp / nhấn Enter liên tục
    const t = { ten: !ten.trim(), mk: !mk };
    setThieu(t);
    if (t.ten || t.mk) {
      setLoi(THIEU); // ngoại lệ 3.a
      return;
    }
    dangGuiRef.current = true;
    setDangGui(true);
    setLoi('');
    try {
      const data = await dangNhapNhanSu(ten.trim(), mk);
      if (data.nguoiDung.mustChangePassword) nav('/doi-mat-khau', { replace: true });
      else nav(data.nguoiDung.vaiTro === 'QuanLy' ? '/quan-ly' : '/giao-vien', { replace: true });
    } catch (err) {
      setLoi(err.message); // ngoại lệ 5.a
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  };

  return (
    <div className="login-shell">
      <LoginPanel dong1="Quản lý lịch dạy" dong2="và phân công giáo viên" moTa="Lịch rảnh, lịch dạy và yêu cầu đổi lịch tập trung tại một nơi." />
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={gui} noValidate>
          <Link to="/" className="back-link"><ArrowLeft size={16} />Chọn lại đối tượng</Link>
          <h2 className="t-32" style={{ marginTop: 24 }}>{td.tieuDe}</h2>
          <p className="t-15 c-muted" style={{ marginTop: 8 }}>{td.phu}</p>
          {loi && <div style={{ marginTop: 24 }}><Alert type="error">{loi}</Alert></div>}
          {!loi && lyDoKetThuc && <div style={{ marginTop: 24 }}><Alert type="warning">{lyDoKetThuc}</Alert></div>}
          <div className="col gap-24" style={{ marginTop: 24 }}>
            <Field label="Tên đăng nhập" strong>
              <TextInput size="lg" icon={User} placeholder="Nhập tên đăng nhập" value={ten} error={thieu.ten}
                onChange={(e) => setTen(e.target.value)} autoComplete="username" />
            </Field>
            <Field label="Mật khẩu" strong hint="Tối thiểu 8 ký tự">
              <TextInput size="lg" icon={Lock} type={hien ? 'text' : 'password'} placeholder="Nhập mật khẩu" value={mk}
                error={thieu.mk} onChange={(e) => setMk(e.target.value)} autoComplete="current-password"
                right={(
                  <button type="button" className="btn-ghost" style={{ border: 'none', background: 'none', padding: 0, color: 'var(--ink-500)' }}
                    onClick={() => setHien((h) => !h)} aria-label={hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                    {hien ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )} />
            </Field>
          </div>
          <Button type="submit" size="lg" block loading={dangGui} style={{ marginTop: 24 }}>Đăng nhập</Button>
          <p className="t-13 c-ink-600" style={{ marginTop: 24 }}>
            Phụ huynh / Học viên? <Link to="/phu-huynh/dang-nhap">Đăng nhập tại đây</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
