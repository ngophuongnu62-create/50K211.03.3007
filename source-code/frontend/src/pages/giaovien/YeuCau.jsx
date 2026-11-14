/**
 * MH31 – Form gửi phản hồi / yêu cầu (GV-10-a)
 * 5a bỏ trống trường bắt buộc (GV-10-b), 7a gửi không thành công (GV-10-c), gửi thành công và tiến độ xử lý (GV-10-d)
 */
import { useEffect, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, Field, Loading, PageHeader, TextArea, TextInput } from '../../components/ui';
import { gioNgayDayDu, MAU_XU_LY, NHAN_LOAI_PHAN_HOI, NHAN_XU_LY } from '../../lib/format';
import { useLang } from '../../lib/lang';

const LOAI = ['DoiLich', 'NghiPhep', 'GopY'];
const TRONG = { loaiPhanHoi: '', tieuDe: '', noiDung: '' };

/** Thanh tiến độ 3 bước: Chờ xử lý → Đang xử lý → Đã xử lý */
export function TienDo({ trangThai, nhan = (s) => s }) {
  const buoc = trangThai === 'ChoXuLy' ? 0 : trangThai === 'DangXuLy' ? 1 : 2;
  const ten = ['Chờ xử lý', 'Đang xử lý', trangThai === 'TuChoi' ? 'Từ chối' : 'Đã xử lý'];
  return (
    <div className="tien-do">
      {ten.map((t, i) => (
        <div key={t} className={`td-buoc ${i <= buoc ? 'on' : ''} ${i === buoc ? 'hien-tai' : ''}`}>
          <span className="td-so">{i + 1}</span><span className="td-ten">{nhan(t)}</span>
          {i < 2 && <span className="td-noi" />}
        </div>
      ))}
    </div>
  );
}

export default function YeuCau() {
  const toast = useToast();
  const { t } = useLang();
  const [f, setF] = useState(TRONG);
  const [loi, setLoi] = useState({});
  const [loiGui, setLoiGui] = useState(false);
  const [ds, setDs] = useState(null);
  const [xem, setXem] = useState(null);
  const [dangGui, setDangGui] = useState(false);

  const tai = () => api('/giao-vien/yeu-cau').then((r) => setDs(r.data)).catch(() => setDs([]));
  useEffect(() => { tai(); }, []);

  const doi = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((x) => ({ ...x, [k]: v })); setLoi((l) => ({ ...l, [k]: undefined })); };

  const gui = async () => {
    setLoiGui(false);
    const thieu = {};
    for (const k of ['loaiPhanHoi', 'tieuDe', 'noiDung']) if (!f[k].trim()) thieu[k] = 'Không được để trống!';
    if (Object.keys(thieu).length) { setLoi(thieu); return; } // 5a
    setDangGui(true);
    try {
      const { data, message } = await api('/giao-vien/yeu-cau', { method: 'POST', body: f });
      toast({ title: t(message), text: t('Yêu cầu được lưu ở trạng thái “Chờ xử lý” và đã chuyển tới Ban quản lý.') });
      setXem(data);
      setF(TRONG);
      tai();
    } catch (e) {
      if (Object.keys(e.fieldErrors).length) setLoi(e.fieldErrors);
      else setLoiGui(true); // 7a: giữ nguyên nội dung
    } finally {
      setDangGui(false);
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ'), to: '/giao-vien' }, { label: t('Phản hồi / yêu cầu') }]}
        title={t('Gửi phản hồi / yêu cầu')} sub={t('Gửi tới Ban quản lý ngay sau khi bấm Gửi.')} />
      <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
        <section className="card grow" style={{ padding: 28 }}>
          {xem ? (
            <>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="card-title">{xem.tieuDe}</div>
                  <div className="t-13 c-muted mt-4">{xem.maPhieu} · {t(NHAN_LOAI_PHAN_HOI[xem.loaiPhanHoi])} · {t('Gửi lúc')} {gioNgayDayDu(xem.thoiGianGui).split(' · ').reverse().join(' ')}</div>
                </div>
                <Badge tone={MAU_XU_LY[xem.trangThaiXuLy]}>{t(NHAN_XU_LY[xem.trangThaiXuLy])}</Badge>
              </div>
              <div className="t-13 w-600" style={{ marginTop: 22 }}>{t('Tiến độ xử lý')}</div>
              <TienDo trangThai={xem.trangThaiXuLy} nhan={t} />
              <hr className="divider" style={{ margin: '16px 0' }} />
              <p className="t-14" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{xem.noiDung}</p>
              {xem.cauTraLoiChinhThuc && (
                <div style={{ marginTop: 16, background: 'var(--cream-50)', borderRadius: 10, padding: 16 }}>
                  <div className="t-13 w-600">{t('Phản hồi của Quản lý')}</div>
                  <p className="t-14" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{xem.cauTraLoiChinhThuc.noiDung}</p>
                </div>
              )}
              <Button variant="outline" icon={Plus} style={{ marginTop: 20 }} onClick={() => setXem(null)}>{t('Gửi yêu cầu mới')}</Button>
            </>
          ) : (
            <>
              <Field label={t('Loại phản hồi / yêu cầu')} required error={loi.loaiPhanHoi && t(loi.loaiPhanHoi)}>
                <div className="grid-3" style={{ gap: 10 }} role="radiogroup">
                  {LOAI.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={f.loaiPhanHoi === l}
                      className={`radio-o ${f.loaiPhanHoi === l ? 'on' : ''} ${loi.loaiPhanHoi ? 'error' : ''}`} onClick={() => doi('loaiPhanHoi')(l)}>
                      <span className="pa-radio" />{t(NHAN_LOAI_PHAN_HOI[l])}
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{ marginTop: 16 }}>
                <Field label={t('Tiêu đề')} required error={loi.tieuDe && t(loi.tieuDe)}>
                  <TextInput value={f.tieuDe} onChange={doi('tieuDe')} placeholder={t('Nhập tiêu đề')} error={loi.tieuDe} maxLength={200} />
                </Field>
              </div>
              <div style={{ marginTop: 16 }}>
                <Field label={t('Nội dung chi tiết')} required error={loi.noiDung && t(loi.noiDung)}>
                  <TextArea value={f.noiDung} onChange={doi('noiDung')} placeholder={t('Mô tả chi tiết yêu cầu')} error={loi.noiDung} rows={6} />
                </Field>
              </div>
              {loiGui && <div style={{ marginTop: 12 }}><Alert type="error" title={t('Gửi phản hồi/yêu cầu không thành công!')}>{t('Nội dung đã nhập được giữ nguyên, vui lòng thử lại.')}</Alert></div>}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <Button icon={Send} loading={dangGui} onClick={gui}>{t('Gửi')}</Button>
              </div>
            </>
          )}
        </section>
        <section className="card" style={{ width: 380, flex: 'none', padding: 24 }}>
          <div className="card-title" style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>{t('Yêu cầu của tôi')}</div>
          {!ds && <Loading />}
          {ds && !ds.length && <div className="c-muted t-13" style={{ paddingTop: 14 }}>{t('Chưa có yêu cầu nào.')}</div>}
          {ds?.map((y, i) => (
            <button key={y.maPhieu} type="button" className="row between list-btn" style={{ borderTop: i ? '1px solid var(--line)' : 'none', padding: '16px 0' }} onClick={() => setXem(y)}>
              <div style={{ textAlign: 'left' }}>
                <div className="t-14 w-500">{y.tieuDe}</div>
                <div className="t-12 c-muted mt-2">{y.maPhieu} · {t(NHAN_LOAI_PHAN_HOI[y.loaiPhanHoi])}</div>
              </div>
              <Badge tone={MAU_XU_LY[y.trangThaiXuLy]}>{t(NHAN_XU_LY[y.trangThaiXuLy])}</Badge>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}
