/** MH28 – Danh sách ca dạy dự kiến (GV-8-a); sau khi phản hồi (GV-8-c, GV-8-d) */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useToastChuyenTrang } from '../../components/Toast';
import { Alert, Badge, Button, Empty, Loading, PageHeader } from '../../components/ui';
import { ddmm, thuCua } from '../../lib/format';
import { useLang } from '../../lib/lang';
import { NhanConLai } from './TrangChu';

export default function CaDuKien() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t } = useLang();
  const ctx = useOutletContext() || {};
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState(null);
  const [vuaPhanHoi] = useState(loc.state?.vuaPhanHoi || null); // { buoi, trangThai }

  useToastChuyenTrang();
  useEffect(() => {
    api('/giao-vien/ca-du-kien').then((r) => { setDs(r.data); ctx.capNhatDem?.('caDuKien', r.data.length); }).catch((e) => setLoi(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hang = ds ? [...ds] : [];
  if (vuaPhanHoi && ds && !hang.some((b) => b.maLichDay === vuaPhanHoi.buoi.maLichDay)) {
    hang.push({ ...vuaPhanHoi.buoi, daPhanHoi: vuaPhanHoi.trangThai });
    hang.sort((a, b) => a.ngayDay.localeCompare(b.ngayDay) || a.maCa.localeCompare(b.maCa));
  }

  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ'), to: '/giao-vien' }, { label: t('Phản hồi lịch dạy') }]}
        title={t('Phản hồi lịch dạy được phân công')} sub={t('Xác nhận hoặc đề xuất thay đổi trong vòng 24 giờ kể từ khi Quản lý gửi lịch dự kiến.')} />
      {loi && <Alert type="error">{loi}</Alert>}
      <div className="card flush">
        {!ds && !loi && <Loading />}
        {ds && !hang.length && <div style={{ padding: '56px 0' }}><Empty cream icon={CalendarCheck} title={t('Không có ca dạy dự kiến nào cần phản hồi.')} /></div>}
        {hang.length > 0 && (
          <table className="table gray-head">
            <thead><tr><th>{t('Ca dạy')}</th><th>{t('Lớp')}</th><th>{t('Phòng')}</th><th>{t('Thời hạn')}</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {hang.map((b) => (
                <tr key={b.maLichDay} className={vuaPhanHoi?.buoi.maLichDay === b.maLichDay ? 'selected' : ''}>
                  <td>
                    <div className="cell-main">{b.tenCa} · {b.gioBatDau} – {b.gioKetThuc}</div>
                    <div className="cell-sub">{thuCua(b.ngayDay)} {ddmm(b.ngayDay)} · {t('Tuần')} {b.tuan}</div>
                  </td>
                  <td>{b.tenLop}</td>
                  <td>{b.tenPhong}</td>
                  <td>
                    {b.daPhanHoi === 'DaXacNhan' ? <Badge tone="green">{t('Đã xác nhận')}</Badge>
                      : b.daPhanHoi === 'DeXuatThayDoi' ? <Badge tone="amber">{t('Chờ xử lý')}</Badge>
                        : <NhanConLai b={b} />}
                  </td>
                  <td className="t-right">
                    {b.daPhanHoi
                      ? <Button variant="outline" size="sm" onClick={() => nav(`/giao-vien/phan-hoi-lich-day/${b.maLichDay}`)}>{t('Xem')}</Button>
                      : <Button variant="outline" size="sm" onClick={() => nav(`/giao-vien/phan-hoi-lich-day/${b.maLichDay}`)}>{t('Gửi phản hồi lịch dạy')}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
