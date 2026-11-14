/** MH25 – Trang chủ Giáo viên / Trợ giảng (GV-00) */
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Send } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Loading, PageHeader, StatCard, useTai } from '../../components/ui';
import { ddmm, ddmmyyyy, gioNgay, nhanBuoiNgan, ngayCua, thuCua } from '../../lib/format';
import { useLang } from '../../lib/lang';

export function NhanConLai({ b }) {
  const { t } = useLang();
  if (b.conLaiGio === undefined || b.conLaiGio === null) return null;
  return b.conLaiGio > 0
    ? <span className="badge badge-g2" style={{ background: 'var(--gray-100)', color: 'var(--ink-700)' }}><Clock size={13} />{t('Còn')} {b.conLaiGio} {t('giờ')}</span>
    : <Badge tone="red" icon={Clock}>{t('Quá hạn')}</Badge>;
}

export default function TrangChu() {
  const nav = useNavigate();
  const { phien } = useAuth();
  const { t } = useLang();
  const { data: d, error } = useTai(() => api('/giao-vien/tong-quan'), []);
  if (error) return <Alert type="error">{error.message}</Alert>;
  if (!d) return <Loading />;
  const cong = d.congLichRanh;
  const ngayDong = ngayCua(cong?.dongLuc);
  const laHomNay = ngayDong === ngayCua(new Date().toISOString());

  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ') }]} title={`${t('Xin chào')}, ${phien.nguoiDung.hoTen}`} sub={d.homNay} />
      <div className="grid-3" style={{ gap: 16, alignItems: 'start' }}>
        <StatCard label={t('Ca dạy tuần này')} value={d.caDayTuanNay} icon={Calendar} />
        <StatCard label={t('Ca dạy chờ bạn xác nhận')} value={d.caChoXacNhan} icon={Clock}>
          <div className="t-12 c-muted" style={{ marginTop: 8 }}>{t('Lịch dự kiến Quản lý vừa gửi · phản hồi trong 24 giờ')}</div>
        </StatCard>
        <StatCard label={t('Yêu cầu đang xử lý')} value={d.yeuCauDangXuLy} icon={Send} />
      </div>

      {cong?.dangMo && (
        <div style={{ marginTop: 28 }}>
          <Alert type="warning" title={`${t('Cổng cập nhật lịch rảnh tuần')} ${ddmm(cong.tuan.tuNgay)} – ${ddmm(cong.tuan.denNgay)} ${t('đang mở')}`}
            action={<Button variant="outline" size="sm" onClick={() => nav('/giao-vien/lich-ranh')}>{t('Cập nhật lịch rảnh')}</Button>}>
            {t('Đóng lúc')} {gioNgay(cong.dongLuc).split(' ')[1]} {thuCua(ngayDong)} {laHomNay ? t('hôm nay') : ddmmyyyy(ngayDong)}. {t('Bạn đã đăng ký')} {cong.soCaDaDangKy} / {t('tối thiểu')} {cong.toiThieu} {t('ca')}.
          </Alert>
        </div>
      )}

      <div className="row gap-16" style={{ marginTop: 28, alignItems: 'stretch' }}>
        <section className="card" style={{ flex: 1, padding: 24 }}>
          <div className="row between">
            <div className="card-title">{t('Lịch dạy hôm nay')}</div>
            <Button variant="link" onClick={() => nav('/giao-vien/lich-day')}>{t('Xem tất cả')}</Button>
          </div>
          <div style={{ marginTop: 6 }}>
            {d.lichDayHomNay.map((b, i) => (
              <div key={b.maLichDay} className="row between" style={{ padding: '14px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div>
                  <div className="t-14 w-600">{b.tenCa} · {b.gioBatDau} – {b.gioKetThuc}</div>
                  <div className="t-13 c-muted mt-2">{b.tenLop} · {b.tenPhong}</div>
                </div>
                {b.loaiLich === 'ChinhThuc' ? <Badge tone="green">{t('Chính thức')}</Badge> : <Badge tone="blue">{t('Dự kiến')}</Badge>}
              </div>
            ))}
            {!d.lichDayHomNay.length && <div className="c-muted t-13" style={{ padding: '14px 0' }}>{t('Hôm nay không có ca dạy.')}</div>}
          </div>
        </section>
        <section className="card" style={{ flex: 1, padding: 24 }}>
          <div className="row between">
            <div className="card-title">{t('Ca dạy chờ xác nhận')}</div>
            <Button variant="link" onClick={() => nav('/giao-vien/phan-hoi-lich-day')}>{t('Phản hồi')}</Button>
          </div>
          <div style={{ marginTop: 6 }}>
            {d.dsCaChoXacNhan.slice(0, 3).map((b, i) => (
              <button key={b.maLichDay} type="button" className="row between list-btn" style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}
                onClick={() => nav(`/giao-vien/phan-hoi-lich-day/${b.maLichDay}`)}>
                <div style={{ textAlign: 'left' }}>
                  <div className="t-14 w-600">{b.tenLop}</div>
                  <div className="t-13 c-muted mt-2">{nhanBuoiNgan(b)}</div>
                </div>
                <NhanConLai b={b} />
              </button>
            ))}
            {!d.dsCaChoXacNhan.length && <div className="c-muted t-13" style={{ padding: '14px 0' }}>{t('Không có ca nào chờ xác nhận.')}</div>}
          </div>
        </section>
      </div>
    </>
  );
}
