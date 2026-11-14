/**
 * MH30 – Bảng lịch rảnh tuần kế tiếp (GV-9-a)
 * Thành công (GV-9-b), 5a chưa chọn ca (GV-9-c), 5a.3 chưa đủ 5 ca (GV-9-d), 4b cổng đã đóng (GV-9-e), 4a lưu thất bại (GV-9-f)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Button, Loading, PageHeader, ThongBaoModal } from '../../components/ui';
import { ddmm, ddmmyyyy, gioNgay, ngayCua, thuCua } from '../../lib/format';
import { useLang } from '../../lib/lang';

const khoa = (ngay, maCa) => `${ngay}|${maCa}`;

export default function LichRanh() {
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useLang();
  const [d, setD] = useState(null);
  const [chon, setChon] = useState(new Set());
  const [loi, setLoi] = useState(null);
  const [dong, setDong] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    api('/giao-vien/lich-ranh').then(({ data }) => {
      setD(data);
      setChon(new Set(data.daChon.map((x) => khoa(x.ngayRanh, x.maCa))));
      if (!data.cong.dangMo) setDong(true);
    }).catch((e) => setLoi(e.message));
  }, []);

  if (!d) return loi ? <Alert type="error">{loi}</Alert> : <Loading />;
  const toiThieu = d.toiThieu || 5;
  const du = chon.size >= toiThieu;
  const doi = (k) => {
    if (!d.cong.dangMo) return;
    setLoi(null);
    setChon((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };

  const luu = async () => {
    setLoi(null);
    const cacRanh = [...chon].map((k) => { const [ngayRanh, maCa] = k.split('|'); return { ngayRanh, maCa }; });
    setDangLuu(true);
    try {
      const { message } = await api('/giao-vien/lich-ranh', { method: 'PUT', body: { cacRanh } });
      toast({ title: t(message), text: `${t('Đã lưu')} ${cacRanh.length} ${t('ca rảnh cho tuần')} ${ddmm(d.tuan.tuNgay)} – ${ddmm(d.tuan.denNgay)}.` });
    } catch (e) {
      if (e.status === 403) setDong(true); // 4b
      else if (e.status === 400) setLoi(e.message); // 5a, 5a.3
      else toast({ type: 'error', title: t('Lưu lịch rảnh thất bại'), text: 'Các ô đang chọn được giữ nguyên, lịch đã lưu trước đó không bị mất. Vui lòng thử lại.' }); // 4a
    } finally {
      setDangLuu(false);
    }
  };

  const ngayDong = ngayCua(d.cong.dongLuc);
  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ'), to: '/giao-vien' }, { label: t('Cập nhật lịch rảnh') }]}
        title={t('Cập nhật lịch rảnh')}
        sub={`${t('Tuần kế tiếp')} ${ddmm(d.tuan.tuNgay)} – ${ddmmyyyy(d.tuan.denNgay)} · ${t('Tích chọn các ca bạn có thể đi dạy.')}`}
        actions={<>
          <Button variant="ghost" onClick={() => { setChon(new Set()); setLoi(null); }} disabled={!d.cong.dangMo}>{t('Bỏ chọn tất cả')}</Button>
          <Button icon={Check} loading={dangLuu} onClick={luu} disabled={!d.cong.dangMo}>{t('Lưu cập nhật')}</Button>
        </>}
      />
      <div className="row gap-12" style={{ alignItems: 'center' }}>
        <div className="alert grow" style={{ background: 'var(--cream-50)', border: '1px solid var(--cream-200)', color: 'var(--ink-700)', alignItems: 'center' }}>
          <Info size={18} /><div className="grow t-13">{t('Cổng mở 08:00 Thứ Hai và đóng 23:59 Thứ Năm hằng tuần. Giáo viên / trợ giảng đăng ký tối thiểu 5 ca rảnh mỗi tuần.')}</div>
        </div>
        <div className="card" style={{ padding: '10px 18px', textAlign: 'right', flex: 'none' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: du ? 'var(--green-900)' : 'var(--brand-700)' }}>{chon.size} / {toiThieu} {t('ca')}</div>
          <div className="t-12 c-muted">{t('đã chọn / tối thiểu')}</div>
        </div>
      </div>
      {loi && <div style={{ marginTop: 24 }}><Alert type="error">{loi}</Alert></div>}
      <section className="card" style={{ marginTop: 24, padding: '20px 20px 20px' }}>
        <div className="lr-grid">
          <div className="lr-head" style={{ textAlign: 'left', paddingTop: 0 }}>{t('Ca học').toUpperCase()}</div>
          {d.cot.map((c) => (
            <div key={c.ngay} className="lr-head"><div className="t-13 w-600 c-ink">{t(c.thu)}</div><div className="t-12 c-muted mt-2">{c.nhanNgay}</div></div>
          ))}
          {d.dong.map((r) => (
            <div key={r.maCa} style={{ display: 'contents' }}>
              <div className="lr-ca"><div className="t-14 w-600">{r.tenCa}</div><div className="t-12 c-muted mt-2">{r.gio}</div></div>
              {d.cot.map((c) => {
                const k = khoa(c.ngay, r.maCa);
                const on = chon.has(k);
                return (
                  <button key={k} type="button" role="checkbox" aria-checked={on} aria-label={`${t(c.thu)} ${c.nhanNgay} · ${r.tenCa}`}
                    className={`lr-o ${on ? 'on' : ''}`} onClick={() => doi(k)} disabled={!d.cong.dangMo}>
                    <span className="lr-box">{on && <Check size={12} strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <ThongBaoModal open={dong} tone="warning-red" onClose={() => nav('/giao-vien')}
        title={t('Hệ thống đã đóng cổng đăng ký lịch rảnh cho tuần tiếp theo')}
        text={`${t('Cổng đã đóng lúc')} ${gioNgay(d.cong.dongLuc).split(' ')[1]} ${thuCua(ngayDong)} ${ddmmyyyy(ngayDong)}. ${t('Lịch rảnh đã lưu được giữ nguyên.')}`}
        footer={<Button onClick={() => nav('/giao-vien')}>{t('Về trang chủ')}</Button>} />
    </>
  );
}
