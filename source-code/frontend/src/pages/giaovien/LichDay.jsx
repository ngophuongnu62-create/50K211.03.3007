/**
 * MH26 – Danh sách lịch dạy cá nhân (GV-7-a), MH27 – Chi tiết lịch dạy (GV-7-b)
 * 2.a chưa có lịch (GV-7-c), 2.b không tải được (GV-7-d), 5.a lịch không còn khả dụng (GV-7-e), 5.b không tải được chi tiết (GV-7-f).
 * Chỉ xem (BR03); chỉ lịch của chính giáo viên (BR01).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, Info } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Badge, Button, Empty, Loading, Modal, PageHeader, Seg, Select } from '../../components/ui';
import { congNgay, dauTuan, ddmm, ddmmyyyy, homNay, nhanNgay, thuNgan } from '../../lib/format';
import { useLang } from '../../lib/lang';

export default function LichDay() {
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useLang();
  const [loai, setLoai] = useState('');
  const dsTuan = useMemo(() => {
    const dau = dauTuan(homNay());
    return [-4, -2, 0, 2, 4].map((i) => { const tu = congNgay(dau, 7 * i); return { tu, den: congNgay(tu, 13) }; });
  }, []);
  const [tuan, setTuan] = useState(dsTuan[2].tu);
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState(false);
  const [chiTiet, setChiTiet] = useState(null);

  const khoang = dsTuan.find((x) => x.tu === tuan);
  const tai = useCallback(() => {
    setLoi(false);
    setDs(null);
    api('/giao-vien/lich-day', { query: { tuNgay: khoang.tu, denNgay: khoang.den } }).then((r) => setDs(r.data.ds)).catch(() => setLoi(true));
  }, [khoang]);
  useEffect(() => { tai(); }, [tai]);

  const xem = async (b) => {
    try {
      const { data } = await api(`/giao-vien/lich-day/${b.maLichDay}`);
      setChiTiet(data);
    } catch (e) {
      if (e.status === 404 || e.status === 403) {
        toast({ type: 'error', title: t('Lịch dạy không còn khả dụng!'), text: t('Lịch đã bị hủy hoặc không còn thuộc phân công của bạn. Danh sách đã được tải lại.') });
        tai();
      } else toast({ type: 'error', title: t('Không tải được chi tiết lịch. Vui lòng thử lại!'), text: t('Danh sách hiện tại được giữ nguyên.') });
    }
  };

  const loc = (ds || []).filter((b) => !loai || b.loaiLich === loai);
  return (
    <>
      <PageHeader crumbs={[{ label: t('Trang chủ'), to: '/giao-vien' }, { label: t('Lịch dạy cá nhân') }]}
        title={t('Lịch dạy cá nhân')} sub={t('Lịch dự kiến đã gửi để xác nhận và lịch chính thức đã phát hành.')} />
      <div className="row between">
        <Seg cream value={loai} onChange={setLoai} items={[{ key: '', label: t('Tất cả') }, { key: 'DuKien', label: t('Dự kiến') }, { key: 'ChinhThuc', label: t('Chính thức') }]} />
        <div style={{ width: 260 }}>
          <Select value={tuan} onChange={setTuan} options={dsTuan.map((x) => ({ value: x.tu, label: `${t('Tuần')} ${ddmm(x.tu)} – ${ddmmyyyy(x.den)}` }))} />
        </div>
      </div>
      <div className="card flush" style={{ marginTop: 24 }}>
        {loi ? (
          <div style={{ padding: '32px 0' }}>
            <Empty cream icon={AlertTriangle} title={t('Không tải được danh sách lịch. Vui lòng thử lại!')} action={<Button onClick={tai}>{t('Tải lại')}</Button>} />
          </div>
        ) : !ds ? <Loading /> : !loc.length ? (
          <div style={{ padding: '32px 0' }}>
            <Empty cream icon={Calendar} title={t('Bạn chưa có lịch dạy được phân công!')} text={<span style={{ display: 'inline-block', maxWidth: 420 }}>{t('Lịch sẽ xuất hiện khi Quản lý gửi lịch dự kiến hoặc phát hành lịch chính thức.')}</span>} />
          </div>
        ) : (
          <table className="table gray-head">
            <thead><tr><th style={{ width: 252 }}>{t('Lớp học')}</th><th style={{ width: 130 }}>{t('Môn học')}</th><th style={{ width: 150 }}>{t('Ngày học')}</th><th style={{ width: 150 }}>{t('Giờ học')}</th><th style={{ width: 100 }}>{t('Phòng')}</th><th>{t('Trạng thái')}</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {loc.map((b) => (
                <tr key={b.maLichDay} style={{ height: 58 }}>
                  <td className="cell-main">{b.tenLop}</td>
                  <td>{b.monHoc}</td>
                  <td>{thuNgan(b.ngayDay)}, {ddmm(b.ngayDay)}</td>
                  <td>{b.gioBatDau} – {b.gioKetThuc}</td>
                  <td>{b.tenPhong}</td>
                  <td><span className={`badge badge-${b.loaiLich === 'ChinhThuc' ? 'green' : 'gray'}`}>{t(b.loaiLich === 'ChinhThuc' ? 'Chính thức' : 'Dự kiến')}</span></td>
                  <td className="t-right"><button type="button" className="btn-link" onClick={() => xem(b)}>{t('Xem chi tiết')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {chiTiet && (
        <Modal open style={{ width: 500 }} onClose={() => setChiTiet(null)} title={chiTiet.tenLop} sub={t('Chi tiết lịch dạy')}
          footer={chiTiet.loaiLich === 'DuKien' && chiTiet.coThePhanHoi ? <>
            <Button variant="outline" onClick={() => setChiTiet(null)}>{t('Đóng')}</Button>
            <Button variant="outline" onClick={() => nav(`/giao-vien/phan-hoi-lich-day/${chiTiet.maLichDay}`, { state: { cheDo: 'deXuat' } })}>{t('Đề xuất thay đổi')}</Button>
            <Button onClick={() => nav(`/giao-vien/phan-hoi-lich-day/${chiTiet.maLichDay}`)}>{t('Xác nhận lịch dạy')}</Button>
          </> : <Button variant="outline" onClick={() => setChiTiet(null)}>{t('Đóng')}</Button>}>
          <dl className="kv kv-figma" style={{ gridTemplateColumns: '130px 1fr', columnGap: 12, rowGap: 16 }}>
            <dt>{t('Lớp học')}</dt><dd>{chiTiet.tenLop}</dd>
            <dt>{t('Môn học')}</dt><dd>{chiTiet.monHoc}</dd>
            <dt>{t('Ngày học')}</dt><dd>{nhanNgay(chiTiet.ngayDay)}</dd>
            <dt>{t('Giờ học')}</dt><dd>{chiTiet.tenCa} · {chiTiet.gioBatDau} – {chiTiet.gioKetThuc}</dd>
            <dt>{t('Phòng học')}</dt><dd>{chiTiet.tenPhong}</dd>
            <dt>{t('Trạng thái')}</dt><dd>{chiTiet.loaiLich === 'ChinhThuc' ? <Badge tone="green">{t('Chính thức')}</Badge> : <Badge tone="gray">{t('Dự kiến')}</Badge>}</dd>
          </dl>
          {chiTiet.loaiLich === 'DuKien' && (
            <div className="alert" style={{ marginTop: 16, background: 'var(--cream-100)', borderColor: 'var(--border)', color: 'var(--ink-700)' }}>
              <Info size={20} color="var(--ink-400)" /><div className="grow t-13" style={{ lineHeight: '19px' }}>{t('Lịch dự kiến cần phản hồi trong 24 giờ. Bấm “Xác nhận lịch dạy” hoặc “Đề xuất thay đổi” để chuyển sang màn hình Phản hồi lịch dạy.')}</div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
