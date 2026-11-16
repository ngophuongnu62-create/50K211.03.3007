/**
 * MH29 – Chi tiết ca dạy và gửi phản hồi (GV-8-b)
 * 5a.1.A bỏ trống lý do (GV-8-e), 5a.1.B ca đề xuất trùng ca hiện tại (GV-8-f), BR03 quá 24 giờ (GV-8-g)
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, Field, Loading, PageHeader, Select, TextArea } from '../../components/ui';
import { ddmm, nhanNgay, thuCua } from '../../lib/format';
import { useLang } from '../../lib/lang';

export default function ChiTietCaDuKien() {
  const { maLichDay } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { t } = useLang();
  const [b, setB] = useState(null);
  const [lyDo, setLyDo] = useState('');
  const [caThayThe, setCaThayThe] = useState('');
  const [loi, setLoi] = useState({});
  const [dang, setDang] = useState('');

  useEffect(() => {
    api(`/giao-vien/ca-du-kien/${maLichDay}`).then((r) => setB(r.data)).catch((e) => {
      toast({ type: 'error', title: e.message });
      nav('/giao-vien/phan-hoi-lich-day', { replace: true });
    });
  }, [maLichDay, nav, toast]);

  // Figma GV-8-g (BR03): đang mở trang mà hết hạn 24 giờ → tự chuyển sang trạng thái quá hạn, khóa phản hồi
  useEffect(() => {
    if (!b?.coThePhanHoi || !b.hanPhanHoi) return undefined;
    const conLai = new Date(b.hanPhanHoi).getTime() - Date.now();
    if (conLai > 2147483647) return undefined;
    const h = setTimeout(() => setB((x) => ({ ...x, coThePhanHoi: false, quaHan: true })), Math.max(0, conLai));
    return () => clearTimeout(h);
  }, [b?.coThePhanHoi, b?.hanPhanHoi]);

  useEffect(() => {
    if (b && loc.state?.cheDo === 'deXuat') document.getElementById('ly-do-thay-doi')?.focus();
  }, [b, loc.state]);

  if (!b) return <Loading />;
  // Quá hạn 24 giờ: còn "Chờ xác nhận" nhưng hết hạn, hoặc hệ thống đã đánh dấu "Hết hạn" (BR03)
  const quaHan = b.quaHan ?? (b.trangThaiPhanCong === 'HetHan' || (b.trangThaiPhanCong === 'ChoXacNhan' && !b.coThePhanHoi));
  const daPhanHoi = !quaHan && b.trangThaiPhanCong !== 'ChoXacNhan';
  const khoa = quaHan || daPhanHoi;
  const caHienTai = { value: `${b.ngayDay}|${b.maCa}`, label: `${thuCua(b.ngayDay)} ${ddmm(b.ngayDay)} · ${b.gioHoc}` };
  const dsCa = [caHienTai, ...(b.caThayThe || []).map((c) => ({ value: `${c.ngayDeXuat}|${c.maCaDeXuat}`, label: c.nhan }))];

  const veDanhSach = (trangThai, toastTb) => nav('/giao-vien/phan-hoi-lich-day', { state: { vuaPhanHoi: { buoi: b, trangThai }, toast: toastTb } });

  const xacNhan = async () => {
    setDang('xacNhan');
    try {
      const { message } = await api(`/giao-vien/ca-du-kien/${maLichDay}/xac-nhan`, { method: 'POST' });
      veDanhSach('DaXacNhan', { title: t(message === 'Đã xác nhận thành công' ? 'Đã xác nhận thành công' : message), text: `${t('Quản lý đã nhận thông báo xác nhận ca')} ${thuCua(b.ngayDay)} ${ddmm(b.ngayDay)}.` });
    } catch (e) {
      toast({ type: 'error', title: e.message });
      if (e.status === 403) setB((x) => ({ ...x, coThePhanHoi: false, quaHan: true }));
    } finally {
      setDang('');
    }
  };

  const guiDeXuat = async () => {
    setLoi({});
    if (!lyDo.trim()) { setLoi({ lyDoThayDoi: 'Không được để trống' }); return; }
    // Sơ đồ hoạt động UC_8: nhánh "Lý do vượt quá 500 ký tự?" – cho nhập quá để báo lỗi thay vì chặn cứng
    if (lyDo.length > 500) { setLoi({ lyDoThayDoi: 'Lý do thay đổi không được vượt quá 500 ký tự' }); return; }
    if (caThayThe === caHienTai.value) { setLoi({ maCaDeXuat: 'Ca dạy đề xuất không được trùng với ca dạy hiện tại!' }); return; }
    const [ngayDeXuat, maCaDeXuat] = caThayThe ? caThayThe.split('|') : [];
    setDang('gui');
    try {
      const { message } = await api(`/giao-vien/ca-du-kien/${maLichDay}/de-xuat-thay-doi`, { method: 'POST', body: { lyDoThayDoi: lyDo, ngayDeXuat, maCaDeXuat } });
      veDanhSach('DeXuatThayDoi', { title: t(message), text: t('Phản hồi được lưu ở trạng thái “Chờ xử lý” và đã thông báo cho Quản lý.') });
    } catch (e) {
      if (Object.keys(e.fieldErrors).length) setLoi(e.fieldErrors);
      else toast({ type: 'error', title: e.message }); // nội dung đã nhập được giữ nguyên
      if (e.status === 403) setB((x) => ({ ...x, coThePhanHoi: false, quaHan: true }));
    } finally {
      setDang('');
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ'), to: '/giao-vien' }, { label: t('Phản hồi lịch dạy'), to: '/giao-vien/phan-hoi-lich-day' }, { label: t('Chi tiết ca dạy') }]}
        title={t('Chi tiết ca dạy và gửi phản hồi')} sub={b.tenLop} />
      <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
        <section className="card" style={{ width: 420, flex: 'none', padding: 24 }}>
          <div className="row between">
            <div className="card-title">{t('Thông tin ca dạy')}</div>
            <Badge tone="blue">{t('Chờ GV xác nhận')}</Badge>
          </div>
          <div style={{ height: 1, background: 'var(--line)', margin: '16px 0' }} />
          <dl className="kv kv-figma" style={{ gridTemplateColumns: '90px 1fr', columnGap: 12, rowGap: 16 }}>
            <dt>{t('Lớp')}</dt><dd>{b.tenLop}</dd>
            <dt>{t('Ca dạy')}</dt><dd>{b.gioHoc}</dd>
            <dt>{t('Ngày')}</dt><dd>{nhanNgay(b.ngayDay)} · {t('Tuần')} {b.tuan}</dd>
            <dt>{t('Phòng')}</dt><dd>{b.tenPhong}</dd>
          </dl>
          <div style={{ marginTop: 16 }}>
            {quaHan ? <Badge tone="red" icon={Clock}>{t('Quá hạn')}</Badge>
              : daPhanHoi ? <Badge tone={b.trangThaiPhanCong === 'DaXacNhan' ? 'green' : 'gray'}>{t(b.trangThaiPhanCong === 'DaXacNhan' ? 'Đã xác nhận' : 'Chờ xử lý')}</Badge>
                : <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--ink-700)' }}><Clock size={13} />{t('Còn')} {b.conLaiGio} {t('giờ')} {t('để phản hồi')}</span>}
          </div>
        </section>

        <section className="card grow" style={{ padding: 24 }}>
          {!quaHan && <div className="card-title">{t('Đồng ý với lịch này?')}</div>}
          {quaHan && (
            <div>
              <Alert type="error" title={t('Đã quá thời hạn gửi phản hồi')}>{t('Tính năng phản hồi của ca dạy này đã bị khóa. Vui lòng liên hệ Quản lý nếu cần thay đổi.')}</Alert>
            </div>
          )}
          {daPhanHoi && !quaHan && <div style={{ marginTop: 18 }}><Alert type="info">{t('Bạn đã phản hồi ca dạy này.')}</Alert></div>}
          <Button block size={quaHan ? undefined : 'lg'} loading={dang === 'xacNhan'} disabled={khoa} onClick={xacNhan} style={{ marginTop: 18 }}>
            {t('Xác nhận duyệt lịch dạy')}
          </Button>
          {!khoa && (
            <>
              <div className="hoac"><span>{t('hoặc đề xuất thay đổi')}</span></div>
              <Field label={t('Lý do thay đổi')} required error={loi.lyDoThayDoi && t(loi.lyDoThayDoi)}>
                <TextArea id="ly-do-thay-doi" value={lyDo} error={loi.lyDoThayDoi} placeholder={t('Nhập lý do (tối đa 500 ký tự)')} rows={4} maxLength={undefined}
                  onChange={(e) => { setLyDo(e.target.value); setLoi((l) => ({ ...l, lyDoThayDoi: undefined })); }} />
              </Field>
              <div style={{ marginTop: 18 }}>
                <Field label={<>{t('Ca dạy đề xuất thay thế')} <span className="c-muted t-12" style={{ fontWeight: 400 }}>{t('(không bắt buộc)')}</span></>} error={loi.maCaDeXuat}>
                  <Select value={caThayThe} onChange={(v) => { setCaThayThe(v); setLoi((l) => ({ ...l, maCaDeXuat: undefined })); }}
                    placeholder={t('Chọn ca dạy thay thế')} error={loi.maCaDeXuat} options={dsCa} />
                </Field>
              </div>
              <Button block variant="outline" loading={dang === 'gui'} onClick={guiDeXuat} style={{ marginTop: 18 }}>{t('Gửi phản hồi')}</Button>
            </>
          )}
          {khoa && quaHan && <Button block disabled style={{ marginTop: 18 }}>{t('Gửi phản hồi')}</Button>}
        </section>
      </div>
    </>
  );
}
