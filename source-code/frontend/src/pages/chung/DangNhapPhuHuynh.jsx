/**
 * MH03 – Đăng nhập Phụ huynh / Học viên (C-06): Họ tên học viên + Số điện thoại, không cần mật khẩu.
 * Ngoại lệ 1.a.2a (C-07): để trống; 1.a.3a (C-08): không khớp – giữ nguyên dữ liệu đã nhập.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, User } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Field, TextInput } from '../../components/ui';
import LoginPanel from './LoginPanel';

const THIEU = 'Vui lòng nhập đầy đủ Họ và tên và Số điện thoại trước khi tra cứu!';

export default function DangNhapPhuHuynh() {
  const { dangNhapPhuHuynh, lyDoKetThuc } = useAuth();
  const dangGuiRef = useRef(false);
  const nav = useNavigate();
  const [ten, setTen] = useState('');
  const [sdt, setSdt] = useState('');
  const [loi, setLoi] = useState('');
  const [thieu, setThieu] = useState({});
  const [dangGui, setDangGui] = useState(false);

  const gui = async (e) => {
    e.preventDefault();
    if (dangGuiRef.current) return; // chống bấm đúp / nhấn Enter liên tục
    const t = { ten: !ten.trim(), sdt: !sdt.trim() };
    setThieu(t);
    if (t.ten || t.sdt) {
      setLoi(THIEU);
      return;
    }
    dangGuiRef.current = true;
    setDangGui(true);
    setLoi('');
    try {
      const data = await dangNhapPhuHuynh(ten.trim(), sdt.trim());
      nav(data.hocVien.dsLop.length > 1 ? '/phu-huynh/chon-lop' : '/phu-huynh/lich-hoc', { replace: true });
    } catch (err) {
      setLoi(err.message);
      if (err.status === 401) setThieu({ ten: true, sdt: true });
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  };

  return (
    <div className="login-shell">
      <LoginPanel dong1="Cổng thông tin" dong2="Phụ huynh / Học viên" moTa="Xem thời khóa biểu, xác nhận ca học, xin nghỉ học và gửi ý kiến cho trung tâm." />
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={gui} noValidate>
          <Link to="/" className="back-link"><ArrowLeft size={16} />Chọn lại đối tượng</Link>
          <h2 style={{ marginTop: 24, fontSize: 26, lineHeight: '31px', fontWeight: 700, whiteSpace: 'nowrap' }}>Đăng nhập Phụ huynh / Học viên</h2>
          <p className="t-15 c-muted" style={{ marginTop: 8, lineHeight: '18px', whiteSpace: 'nowrap' }}>Dùng họ tên học viên và số điện thoại đã đăng ký. Không cần mật khẩu.</p>
          {loi && <div style={{ marginTop: 24 }}><Alert type="error">{loi}</Alert></div>}
          {!loi && lyDoKetThuc && <div style={{ marginTop: 24 }}><Alert type="warning">{lyDoKetThuc}</Alert></div>}
          <div className="col gap-24" style={{ marginTop: 24 }}>
            <Field label="Họ và tên học viên" strong>
              <TextInput size="lg" icon={User} placeholder="VD: Nguyễn Minh An" value={ten} error={thieu.ten} onChange={(e) => setTen(e.target.value)} />
            </Field>
            <Field label="Số điện thoại" strong>
              <TextInput size="lg" icon={Phone} placeholder="Số điện thoại đã đăng ký" value={sdt} error={thieu.sdt} inputMode="tel" onChange={(e) => setSdt(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" size="lg" block loading={dangGui} style={{ marginTop: 24 }}>Đăng nhập</Button>
          <p className="t-13 c-muted" style={{ marginTop: 24, lineHeight: '16px' }}>
            Nhân sự Broadway? <Link to="/dang-nhap/quan-ly" style={{ color: 'inherit' }}>Đăng nhập tại đây</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
