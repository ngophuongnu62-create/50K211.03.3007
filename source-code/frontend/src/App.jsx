/** Định tuyến theo vai trò (Hình 2.2 – sơ đồ use case; mục 6.1 – luồng màn hình). */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import StaffLayout from './layouts/StaffLayout';
import ParentLayout from './layouts/ParentLayout';
import ChonDoiTuong from './pages/chung/ChonDoiTuong';
import DangNhapNhanSu from './pages/chung/DangNhapNhanSu';
import DangNhapPhuHuynh from './pages/chung/DangNhapPhuHuynh';
import DoiMatKhau from './pages/chung/DoiMatKhau';
import * as QL from './pages/quanly';
import * as GV from './pages/giaovien';
import * as PH from './pages/phuhuynh';

const TRANG_CHU = { QuanLy: '/quan-ly', GiaoVien: '/giao-vien', TroGiang: '/giao-vien', PhuHuynhHocVien: '/phu-huynh/lich-hoc' };

/** Chỉ cho vào khi đã đăng nhập đúng vai trò (UC_1 BR03) */
function YeuCau({ vaiTro, children, dangNhap }) {
  const { phien } = useAuth();
  if (!phien) return <Navigate to={dangNhap} replace />;
  // Mật khẩu tạm: bắt buộc đổi trước khi vào bất kỳ chức năng nào
  if (phien.nguoiDung?.mustChangePassword) return <Navigate to="/doi-mat-khau" replace />;
  if (!vaiTro.includes(phien.vaiTro)) return <Navigate to={TRANG_CHU[phien.vaiTro] || '/'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<ChonDoiTuong />} />
        <Route path="dang-nhap/:doiTuong" element={<DangNhapNhanSu />} />
        <Route path="phu-huynh/dang-nhap" element={<DangNhapPhuHuynh />} />
        <Route path="doi-mat-khau" element={<DoiMatKhau />} />
      </Route>

      <Route path="quan-ly" element={<YeuCau vaiTro={['QuanLy']} dangNhap="/dang-nhap/quan-ly"><StaffLayout vaiTro="QuanLy" /></YeuCau>}>
        <Route index element={<QL.TrangChu />} />
        <Route path="phong-hoc" element={<QL.PhongHoc />} />
        <Route path="ho-so-giao-vien" element={<QL.HoSoDanhSach />} />
        <Route path="ho-so-giao-vien/them" element={<QL.HoSoForm />} />
        <Route path="ho-so-giao-vien/:maNhanSu" element={<QL.HoSoChiTiet />} />
        <Route path="ho-so-giao-vien/:maNhanSu/sua" element={<QL.HoSoForm />} />
        <Route path="phan-hoi" element={<QL.PhanHoiDanhSach />} />
        <Route path="phan-hoi/:maPhanHoi" element={<QL.PhanHoiChiTiet />} />
        <Route path="tra-cuu-lich-day" element={<QL.TraCuuLich />} />
        <Route path="quan-ly-lich" element={<QL.QuanLyLich />} />
        <Route path="quan-ly-lich/tao" element={<QL.TaoLich />} />
        <Route path="quan-ly-lich/tuan-toi" element={<QL.LichTuanToi />} />
        <Route path="quan-ly-lich/:maLop/phan-cong" element={<QL.PhanCong />} />
        <Route path="quan-ly-lich/:maLop/phe-duyet" element={<QL.PheDuyet />} />
      </Route>

      <Route path="giao-vien" element={<YeuCau vaiTro={['GiaoVien', 'TroGiang']} dangNhap="/dang-nhap/giao-vien"><StaffLayout vaiTro="GiaoVien" /></YeuCau>}>
        <Route index element={<GV.TrangChu />} />
        <Route path="lich-day" element={<GV.LichDay />} />
        <Route path="phan-hoi-lich-day" element={<GV.CaDuKien />} />
        <Route path="phan-hoi-lich-day/:maLichDay" element={<GV.ChiTietCaDuKien />} />
        <Route path="lich-ranh" element={<GV.LichRanh />} />
        <Route path="yeu-cau" element={<GV.YeuCau />} />
      </Route>

      <Route path="phu-huynh" element={<YeuCau vaiTro={['PhuHuynhHocVien']} dangNhap="/phu-huynh/dang-nhap"><ParentLayout /></YeuCau>}>
        <Route path="chon-lop" element={<PH.ChonLop />} />
        <Route path="lich-hoc" element={<PH.ThoiKhoaBieu />} />
        <Route path="xac-nhan-ca-hoc" element={<PH.XacNhanCaHoc />} />
        <Route path="gui-y-kien" element={<PH.GuiYKien />} />
        <Route path="tra-cuu-phieu" element={<PH.TraCuuPhieu />} />
        <Route path="lich-su-phan-hoi" element={<PH.LichSuPhanHoi />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
