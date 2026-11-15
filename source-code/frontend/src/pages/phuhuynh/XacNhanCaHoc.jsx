/**
 * MH35 – Lịch học dự kiến cần xác nhận (PH-11-a), MH36 – Biểu mẫu từ chối ca học (PH-11-d)
 * Hộp thoại xác nhận (PH-11-b, PH-11-i), thành công (PH-11-c, PH-11-g, PH-11-j),
 * 3a.5a bỏ trống / vượt 500 ký tự (PH-11-e, PH-11-f), 5a quá hạn 24 giờ (PH-11-h). Mỗi ca chỉ phản hồi một lần (BR01).
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Clock, Send } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, Empty, Field, Loading, Modal, PageHeader, TextArea, ThongBaoModal } from '../../components/ui';
import { congNgay, dauTuan, ddmm, ddmmyyyy, hanChot, thuCua } from '../../lib/format';

const nhanNgayDu = (s) => `${thuCua(s)} ${ddmmyyyy(s)}`;

export default function XacNhanCaHoc() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [loi, setLoi] = useState(null);
  const [hoi, setHoi] = useState(null); // { tatCa: bool, ca }
  const [tuChoi, setTuChoi] = useState(null);
  const [dang, setDang] = useState(false);

  const tai = useCallback(() => api('/phu-huynh/lich-du-kien').then((r) => setD(r.data)).catch((e) => setLoi(e.message)), []);
  useEffect(() => { tai(); }, [tai]);
  // PH-11-h (BR03): đang mở trang mà hết hạn 24 giờ → tải lại để khóa phản hồi, hiện "Đã quá thời hạn"
  useEffect(() => {
    if (!d?.hanChot || !d.soCaChuaPhanHoi) return undefined;
    const conLai = new Date(d.hanChot).getTime() - Date.now();
    if (conLai > 2147483647) return undefined;
    const h = setTimeout(tai, Math.max(0, conLai) + 1000);
    return () => clearTimeout(h);
  }, [d?.hanChot, d?.soCaChuaPhanHoi, tai]);

  if (loi) return <Alert type="error">{loi}</Alert>;
  if (!d) return <Loading />;
  const ds = d.caHoc;
  const chuaPhanHoi = ds.filter((c) => !c.ketQua && !c.daKhoa);
  const daKhoa = ds.length > 0 && ds.every((c) => c.ketQua || c.daKhoa) && ds.some((c) => c.daKhoa);
  const tuanDau = ds.length ? dauTuan(ds[0].ngayDay) : null;
  const tuanCuoi = ds.length ? congNgay(dauTuan(ds[ds.length - 1].ngayDay), 6) : null;

  const dongY = async () => {
    setDang(true);
    try {
      const { message } = hoi.tatCa
        ? await api('/phu-huynh/lich-du-kien/xac-nhan-tat-ca', { method: 'POST' })
        : await api(`/phu-huynh/lich-du-kien/${hoi.ca.maLichDay}/xac-nhan`, { method: 'POST' });
      toast({ title: message, text: hoi.tatCa ? 'Kết quả đã chuyển về Quản lý. Các nút phản hồi được ẩn.' : 'Kết quả đã chuyển về Quản lý. Nút phản hồi của ca này được ẩn.' });
      setHoi(null);
      tai();
    } catch (e) {
      toast({ type: 'error', title: e.message, text: e.status === 403 ? 'Tính năng phản hồi đã bị khóa. Hãy liên hệ trung tâm để được giải quyết thắc mắc.' : undefined });
      setHoi(null);
      tai();
    } finally {
      setDang(false);
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Xác nhận ca học' }]} title="Xác nhận ca học dự kiến"
        sub={tuanDau ? `Lịch dự kiến tuần ${ddmm(tuanDau)} – ${ddmmyyyy(tuanCuoi)} do trung tâm gửi. Mỗi ca chỉ phản hồi một lần.` : 'Mỗi ca chỉ phản hồi một lần.'} />
      {daKhoa ? (<>
        {/* PH-11-h (Figma): hàng hạn chót chỉ còn nút "Xác nhận tất cả" bị khóa */}
        <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 24 }}>
          <Button disabled style={{ background: '#e9ecef', color: 'var(--ink-300)' }}>Xác nhận tất cả</Button>
        </div>
        <div style={{ marginBottom: 24 }}>
          <Alert type="error" title="Đã quá thời hạn phản hồi lịch học">Tính năng phản hồi đã bị khóa. Hãy liên hệ trung tâm để được giải quyết thắc mắc.</Alert>
        </div>
      </>) : chuaPhanHoi.length > 0 && (
        <div className="row between" style={{ marginBottom: 24 }}>
          <div className="row gap-12">
            <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--ink-700)' }}><Clock size={13} />Còn {d.conLaiGio} giờ để phản hồi</span>
            <span className="t-13 c-muted">Hạn chót {hanChot(d.hanChot)}</span>
          </div>
          <Button onClick={() => setHoi({ tatCa: true })}>Xác nhận tất cả ({chuaPhanHoi.length} ca{chuaPhanHoi.length < ds.length ? ' còn lại' : ''})</Button>
        </div>
      )}
      {!ds.length && <section className="card" style={{ padding: 0 }}><Empty cream icon={CalendarCheck} title="Không có ca học nào cần xác nhận." /></section>}
      <div className="col gap-24">
        {ds.map((c) => (
          <section key={c.maLichDay} className="card row" style={{ padding: '20px 24px', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 300, flex: 'none' }}>
              <div className="t-16 w-600" style={{ lineHeight: '19px' }}>{c.tenLop}</div>
              <div className="t-13 c-muted mt-4" style={{ lineHeight: '16px' }}>Giáo viên {c.tenGiaoVien || '—'}</div>
            </div>
            {/* Figma PH-11: 3 cột chia đều phần còn lại bên cạnh nút/nhãn */}
            <div style={{ flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap' }}><div className="pa-lbl">Ngày học</div><div className="pa-val">{nhanNgayDu(c.ngayDay)}</div></div>
            <div style={{ flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap' }}><div className="pa-lbl">Ca học</div><div className="pa-val">{c.gioHoc}</div></div>
            <div style={{ flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap' }}><div className="pa-lbl">Phòng</div><div className="pa-val">{c.tenPhong}</div></div>
            <div className="row gap-8">
              {c.ketQua === 'XacNhan' ? <Badge tone="green">Đã xác nhận ca học</Badge>
                : c.ketQua === 'TuChoi' ? <Badge tone="red">Từ chối xác nhận</Badge>
                  : c.daKhoa ? <>
                    {/* PH-11-h (Figma): nút phản hồi hiển thị nhưng bị khóa */}
                    <Button disabled>Từ chối ca học</Button>
                    <Button disabled>Xác nhận ca học</Button>
                  </> : <>
                    <Button variant="outline" onClick={() => setTuChoi(c)}>Từ chối ca học</Button>
                    <Button onClick={() => setHoi({ tatCa: false, ca: c })}>Xác nhận ca học</Button>
                  </>}
            </div>
          </section>
        ))}
      </div>

      {/* PH-11-b / PH-11-i (Figma): hộp thoại 480px, biểu tượng lịch trong vòng tròn hồng */}
      <ThongBaoModal open={!!hoi} tone="pink" onClose={() => setHoi(null)}
        title={hoi?.tatCa ? `Bạn xác nhận tham gia tất cả ${chuaPhanHoi.length} ca học trong tuần?` : 'Bạn xác nhận tham gia ca học này?'}
        text={hoi && !hoi.tatCa ? `${hoi.ca.tenLop} · ${nhanNgayDu(hoi.ca.ngayDay)} · ${hoi.ca.tenCa} (${hoi.ca.gioHoc.split(' · ')[1] || hoi.ca.gioHoc}) · ${hoi.ca.tenPhong}` : undefined}
        footer={<><Button variant="outline" onClick={() => setHoi(null)}>Hủy</Button><Button loading={dang} onClick={dongY}>Đồng ý</Button></>}>
        {hoi?.tatCa && (
          <ul className="tb-text" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', maxHeight: 260, overflow: 'auto' }}>
            {chuaPhanHoi.map((c) => <li key={c.maLichDay}>{c.tenLop} · {thuCua(c.ngayDay)} {ddmm(c.ngayDay)} · {c.tenCa}</li>)}
          </ul>
        )}
      </ThongBaoModal>
      {tuChoi && <TuChoi ca={tuChoi} onClose={() => setTuChoi(null)} onXong={(msg) => {
        toast({ title: msg, text: 'Quản lý sẽ điều chỉnh lại lịch học dự kiến.' });
        setTuChoi(null);
        tai();
      }} />}
    </>
  );
}

/** MH36 – Biểu mẫu từ chối ca học */
function TuChoi({ ca, onClose, onXong }) {
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState(null);
  const [dang, setDang] = useState(false);
  const gui = async () => {
    setLoi(null);
    if (!lyDo.trim()) { setLoi('Vui lòng nhập lý do từ chối xác nhận lịch học'); return; }
    // PH-11-f (Figma): cho nhập quá 500 ký tự để báo lỗi "509 / 500" thay vì chặn cứng
    if (lyDo.length > 500) { setLoi('Lý do từ chối không được vượt quá 500 ký tự'); return; }
    setDang(true);
    try {
      const { message } = await api(`/phu-huynh/lich-du-kien/${ca.maLichDay}/tu-choi`, { method: 'POST', body: { lyDoTuChoi: lyDo } });
      onXong(message);
    } catch (e) {
      setLoi(e.fieldErrors.lyDoTuChoi || e.message);
    } finally {
      setDang(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Từ chối ca học" sub={`${ca.tenLop} · ${nhanNgayDu(ca.ngayDay)} · ${ca.tenCa}`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button icon={Send} loading={dang} onClick={gui}>Gửi phản hồi từ chối</Button></>}>
      <Field label="Lý do từ chối" required error={loi}>
        <TextArea value={lyDo} onChange={(e) => { setLyDo(e.target.value); setLoi(null); }} error={loi} rows={4} maxLength={undefined} style={{ height: 94 }} placeholder="Nhập lý do (tối đa 500 ký tự)" />
      </Field>
    </Modal>
  );
}
