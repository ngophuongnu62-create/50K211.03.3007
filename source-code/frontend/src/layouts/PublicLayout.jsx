/** Khung trang công khai (MH01–MH03): thanh tiêu đề màu kem + logo. */
import { Outlet } from 'react-router-dom';
import Brand from './Brand';

export default function PublicLayout() {
  return (
    <>
      <header className="topbar"><Brand /></header>
      <Outlet />
    </>
  );
}
