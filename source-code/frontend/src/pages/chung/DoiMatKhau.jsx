/**
 * Đổi mật khẩu – bắt buộc ở lần đăng nhập đầu tiên khi tài khoản đang dùng mật khẩu tạm
 * (tài khoản Admin khởi tạo, tài khoản giáo viên / trợ giảng do Quản lý cấp).
 * Dùng lại bố cục màn hình đăng nhập MH02 (khối giới thiệu bên trái + biểu mẫu bên phải).
 */
import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Field, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import LoginPanel from './LoginPanel';

const THIEU = 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.';
const YEU = 'Mật khẩu mới phải dài 8–64 ký tự, gồm cả chữ cái và chữ số.';
const KHONG_KHOP = 'Xác nhận mật khẩu mới không khớp.';
const duManh = (mk) => mk.length >= 8 && mk.length <= 64 && /\p{L}/u.test(mk) && /\d/.test(mk);

function O({ label, hint, value, onChange, error, hien, autoComplete, placeholder }) {
  return (
    <Field label={label} strong hint={hint} error={typeof error === 'string' ? error : undefined}>
      <TextInput size="lg" icon={Lock} type={hien ? 'text' : 'password'} placeholder={placeholder} value={value}
        error={Boolean(error)} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
    </Field>
  );
}

export default function DoiMatKhau() {
  const { phien, doiMatKhau, dangXuat, vaiTroCuoi } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ matKhauHienTai: '', matKhauMoi: '', xacNhanMatKhau: '' });
  const [hien, setHien] = useState(false);
  const [loi, setLoi] = useState('');
  const [loiTruong, setLoiTruong] = useState({});
  const [dangGui, setDangGui] = useState(false);
  const dangGuiRef = useRef(false);

  if (!phien) {
    // Phiên vừa bị vô hiệu (VD: mật khẩu đã được đổi ở thiết bị khác) → về đúng trang đăng nhập kèm lý do
    const ve = vaiTroCuoi === 'QuanLy' ? '/dang-nhap/quan-ly' : vaiTroCuoi ? '/dang-nhap/giao-vien' : '/';
    return <Navigate to={ve} replace />;
  }
  if (phien.vaiTro === 'PhuHuynhHocVien') return <Navigate to="/" replace />;
  const batBuoc = Boolean(phien.nguoiDung?.mustChangePassword);
  const dat = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const gui = async (e) => {
    e.preventDefault();
    if (dangGuiRef.current) return;
    const thieu = { matKhauHienTai: !f.matKhauHienTai, matKhauMoi: !f.matKhauMoi, xacNhanMatKhau: !f.xacNhanMatKhau };
    if (Object.values(thieu).some(Boolean)) {
      setLoiTruong(thieu);
      setLoi(THIEU);
      return;
    }
    if (!duManh(f.matKhauMoi)) {
      setLoiTruong({ matKhauMoi: YEU });
      setLoi(YEU);
      return;
    }
    if (f.matKhauMoi !== f.xacNhanMatKhau) {
      setLoiTruong({ xacNhanMatKhau: KHONG_KHOP });
      setLoi(KHONG_KHOP);
      return;
    }
    dangGuiRef.current = true;
    setDangGui(true);
    setLoi('');
    setLoiTruong({});
    try {
      const data = await doiMatKhau(f);
      toast({ title: data.message || 'Đổi mật khẩu thành công.' });
      nav(data.nguoiDung.vaiTro === 'QuanLy' ? '/quan-ly' : '/giao-vien', { replace: true });
    } catch (err) {
      setLoi(err.message);
      setLoiTruong(err.fieldErrors || {});
    } finally {
      dangGuiRef.current = false;
      setDangGui(false);
    }
  };

  return (
    <div className="login-shell">
      <LoginPanel dong1="Bảo vệ tài khoản" dong2="trước khi bắt đầu" moTa="Mật khẩu tạm do trung tâm cấp chỉ dùng cho lần đăng nhập đầu tiên. Hãy đặt mật khẩu riêng của bạn." />
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={gui} noValidate>
          <h2 className="t-32">{batBuoc ? 'Đổi mật khẩu tạm' : 'Đổi mật khẩu'}</h2>
          <p className="t-15 c-muted" style={{ marginTop: 8 }}>
            {batBuoc
              ? `Xin chào ${phien.nguoiDung?.hoTen || ''}. Bạn đang dùng mật khẩu tạm, vui lòng đổi mật khẩu để tiếp tục sử dụng hệ thống.`
              : 'Nhập mật khẩu hiện tại và mật khẩu mới.'}
          </p>
          {loi && <div style={{ marginTop: 24 }}><Alert type="error">{loi}</Alert></div>}
          <div className="col gap-24" style={{ marginTop: 24 }}>
            <O label={batBuoc ? 'Mật khẩu tạm (hiện tại)' : 'Mật khẩu hiện tại'} value={f.matKhauHienTai} onChange={dat('matKhauHienTai')}
              error={loiTruong.matKhauHienTai} hien={hien} autoComplete="current-password" placeholder="Nhập mật khẩu hiện tại" />
            <O label="Mật khẩu mới" hint="8–64 ký tự, gồm cả chữ cái và chữ số" value={f.matKhauMoi} onChange={dat('matKhauMoi')}
              error={loiTruong.matKhauMoi} hien={hien} autoComplete="new-password" placeholder="Nhập mật khẩu mới" />
            <O label="Xác nhận mật khẩu mới" value={f.xacNhanMatKhau} onChange={dat('xacNhanMatKhau')}
              error={loiTruong.xacNhanMatKhau} hien={hien} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" />
            <button type="button" className="btn-link" style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={() => setHien((h) => !h)}>
              {hien ? <EyeOff size={16} /> : <Eye size={16} />}{hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            </button>
          </div>
          <Button type="submit" size="lg" block icon={KeyRound} loading={dangGui} style={{ marginTop: 24 }}>Đổi mật khẩu</Button>
          <Button variant="ghost" block icon={LogOut} style={{ marginTop: 12 }} onClick={() => { dangXuat(); nav('/', { replace: true }); }}>Đăng xuất</Button>
        </form>
      </div>
    </div>
  );
}
