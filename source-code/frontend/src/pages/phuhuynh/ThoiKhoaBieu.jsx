/**
 * MH32 – Thời khóa biểu (PH-12-a), MH34 – Chi tiết ca học (PH-12-b), MH37 – Biểu mẫu xin nghỉ học (PH-13-a)
 * 2b không tải được (PH-12-d), 2c lịch đang cập nhật (PH-12-e), 4a không tải được chi tiết (PH-12-f),
 * xin nghỉ thành công (PH-13-b), 1a ca đã / đang diễn ra (PH-13-c), 5a chưa đủ trước 2 tiếng (PH-13-d). Chỉ hiển thị lịch đã phát hành (BR02).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, CalendarX2, ChevronLeft, ChevronRight, Clock, RefreshCw, Send } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Button, Empty, Field, Loading, Modal, PageHeader, Select, TextArea } from '../../components/ui';
import { congNgay, ddmm, ddmmyyyy, NHAN_LY_DO_NGHI, thuCua } from '../../lib/format';

export default function ThoiKhoaBieu() {
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const maLop = sp.get('lop') || '';
  const [tuan, setTuan] = useState('');
  const [d, setD] = useState(null);
  const [loi, setLoi] = useState(false);
  const [chon, setChon] = useState(null); // chi tiết ca học
  const [xinNghi, setXinNghi] = useState(null);

  const tai = useCallback(() => {
    setLoi(false);
    api('/phu-huynh/thoi-khoa-bieu', { query: { maLop, tuan } }).then((r) => setD(r.data)).catch(() => setLoi(true));
  }, [maLop, tuan]);
  useEffect(() => { tai(); }, [tai]);

  const moChiTiet = async (b) => {
    try {
      const { data } = await api(`/phu-huynh/ca-hoc/${b.maLichDay}`);
      setChon({ ...data, buoi: b });
    } catch {
      toast({ type: 'error', title: 'Không tải được chi tiết ca học. Vui lòng thử lại!', text: 'Thời khóa biểu hiện tại được giữ nguyên.' }); // 4a (PH-12-f)
    }
  };

  const moXinNghi = async () => {
    try {
      const { data } = await api(`/phu-huynh/ca-hoc/${chon.maLichDay}/xin-nghi`);
      setXinNghi({ ...data, buoi: chon.buoi });
      setChon(null);
    } catch (e) {
      toast({ type: 'error', title: e.message });
    }
  };

  const tenLop = d?.lop?.tenLop || '';
  const doiTuan = (n) => setTuan(congNgay(d.tuan.tuNgay, 7 * n));
  return (
    <>
      <PageHeader crumbs={[{ label: 'Theo dõi lịch học' }]} title="Thời khóa biểu"
        sub={tenLop ? `${tenLop} · ${d?.thongBao ? 'Lịch đang được trung tâm cập nhật' : 'Lịch này đã được phê duyệt và phát hành'}` : ''}
        actions={d?.nhieuLop && <Button variant="outline" icon={ArrowLeftRight} onClick={() => nav('/phu-huynh/chon-lop')}>Đổi lớp</Button>} />
      {d && (
        <div className="row gap-12" style={{ marginBottom: 24 }}>
          <button type="button" className="icon-btn sq" aria-label="Tuần trước" onClick={() => doiTuan(-1)}><ChevronLeft size={18} /></button>
          <div style={{ fontSize: 16, lineHeight: '19px', fontWeight: 600 }}>Tuần {ddmm(d.tuan.tuNgay)} – {ddmmyyyy(d.tuan.denNgay)}</div>
          <button type="button" className="icon-btn sq" aria-label="Tuần sau" onClick={() => doiTuan(1)}><ChevronRight size={18} /></button>
        </div>
      )}
      <section className="card" style={{ padding: 20 }}>
        {loi ? (
          <div style={{ padding: '12px 0' }}>
            <Empty cream icon={AlertTriangle} title="Không tải được thời khóa biểu. Vui lòng thử lại!" action={<Button icon={RefreshCw} onClick={tai}>Tải lại</Button>} />
          </div>
        ) : !d ? <Loading /> : d.thongBao ? (
          // Figma PH-12-e: biểu tượng đồng hồ nền xanh, dòng phụ 15/18 đậm #8a949d
          <div className="empty" style={{ padding: '76px 24px' }}>
            <div className="empty-icon" style={{ background: 'var(--blue-bg)', color: 'var(--blue-900)' }}><Clock size={28} /></div>
            <div className="empty-title">{d.thongBao}</div>
            <div style={{ fontSize: 15, lineHeight: '18px', fontWeight: 700, color: 'var(--ink-400)' }}>Thời khóa biểu sẽ hiển thị lại khi trung tâm phát hành lịch mới.</div>
          </div>
        ) : (
          <div className="tkb-grid">
            <div />
            {d.cot.map((c) => <div key={c.ngay} className="lr-head"><div className="t-13 w-600 c-ink">{c.thu}</div><div className="t-12 c-muted mt-2">{c.nhanNgay}</div></div>)}
            {d.dong.map((r) => (
              <div key={r.maCa} style={{ display: 'contents' }}>
                <div className="lr-ca"><div className="t-14 w-600">{r.tenCa}</div><div className="t-12 c-muted mt-2">{r.gio}</div></div>
                {d.cot.map((c) => {
                  const b = d.caHoc.find((x) => x.ngayDay === c.ngay && x.maCa === r.maCa);
                  if (!b) return <div key={c.ngay} className="tkb-o" />;
                  return (
                    <button key={c.ngay} type="button" className={`tkb-o co ${chon?.maLichDay === b.maLichDay ? 'on' : ''}`} onClick={() => moChiTiet(b)}>
                      <span className="t-12 w-600" style={{ textAlign: 'left' }}>{b.tenLop}</span>
                      <span className="t-11 c-muted" style={{ marginTop: 6 }}>{b.tenPhong}{b.buoiBu ? ' · Buổi bù' : ''}</span>
                      {b.baoVang && <span className="badge badge-blue" style={{ height: 20, fontSize: 11, marginTop: 6 }}>Báo vắng</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {chon && (
        <Modal open style={{ width: 500 }} onClose={() => setChon(null)} title={chon.tenLop} sub="Chi tiết ca học"
          footer={<>
            <Button variant="outline" onClick={() => setChon(null)}>Đóng</Button>
            {/* Figma PH-12-b: viền đỏ #e32128; PH-13-c: khóa nền kem */}
            <Button variant={chon.coTheXinNghi ? 'outline' : 'primary'} icon={CalendarX2} onClick={moXinNghi} disabled={!chon.coTheXinNghi}
              style={chon.coTheXinNghi ? { borderColor: 'var(--brand)', color: 'var(--brand)' } : undefined}>Xin nghỉ ca này</Button>
          </>}>
          <dl className="kv kv-figma" style={{ gridTemplateColumns: '140px 1fr', columnGap: 12, rowGap: 16 }}>
            <dt>Môn học</dt><dd>{chon.monHoc}</dd>
            <dt>Ngày / Giờ học</dt><dd>{chon.ngayGioHoc}</dd>
            <dt>Số phòng</dt><dd>{chon.soPhong}</dd>
            <dt>Giáo viên</dt><dd>{chon.giaoVien || '—'}</dd>
            <dt>Trợ giảng</dt><dd>{chon.troGiang || '—'}</dd>
          </dl>
          {chon.daBaoVang && <div style={{ marginTop: 16 }}><Alert type="info">Ca học này đã được báo vắng trước đó.</Alert></div>}
          {chon.lyDoKhongTheXinNghi && <div style={{ marginTop: 16 }}><Alert type="warning">{chon.lyDoKhongTheXinNghi}</Alert></div>}
        </Modal>
      )}
      {xinNghi && <XinNghi ca={xinNghi} onClose={() => setXinNghi(null)} onXong={() => {
        toast({ title: 'Gửi yêu cầu xin nghỉ thành công', text: `Ca ${thuCua(xinNghi.buoi.ngayDay)} ${ddmm(xinNghi.buoi.ngayDay)} đã chuyển sang “Báo vắng”. Quản lý đã nhận thông báo.` });
        setXinNghi(null);
        tai();
      }} />}
    </>
  );
}

/** MH37 – Biểu mẫu xin nghỉ học */
function XinNghi({ ca, onClose, onXong }) {
  const [lyDo, setLyDo] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [loi, setLoi] = useState({});
  const [loiChung, setLoiChung] = useState(null);
  const [dang, setDang] = useState(false);
  const [ngay, gio] = ca.ngayHoc.split(' · ');
  const gui = async () => {
    setLoi({});
    setLoiChung(null);
    if (!lyDo) { setLoi({ lyDoXinNghi: 'Vui lòng chọn lý do xin nghỉ.' }); return; }
    setDang(true);
    try {
      await api(`/phu-huynh/ca-hoc/${ca.maLichDay}/xin-nghi`, { method: 'POST', body: { lyDoXinNghi: lyDo, ghiChu } });
      onXong();
    } catch (e) {
      if (Object.keys(e.fieldErrors).length) setLoi(e.fieldErrors);
      else setLoiChung(e.message); // 1a, 5a, đã gửi trước đó
    } finally {
      setDang(false);
    }
  };
  return (
    <Modal open style={{ width: 540 }} onClose={onClose} title="Xin nghỉ học" sub="Thông tin ca học được điền sẵn"
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button icon={Send} loading={dang} onClick={gui}>Gửi yêu cầu</Button></>}>
      <dl className="kv kv-figma" style={{ background: 'var(--cream-100)', borderRadius: 10, padding: 16, gridTemplateColumns: '110px 1fr', columnGap: 12, rowGap: 10 }}>
        <dt>Tên lớp</dt><dd>{ca.tenLop}</dd>
        <dt>Ngày học</dt><dd>{ngay}</dd>
        <dt>Ca học</dt><dd>{ca.buoi.tenCa} · {gio}</dd>
        <dt>Giáo viên</dt><dd>{ca.giaoVien || '—'}</dd>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Field label="Lý do xin nghỉ" required error={loi.lyDoXinNghi}>
          <Select value={lyDo} onChange={(v) => { setLyDo(v); setLoi({}); }} placeholder="Chọn lý do" error={loi.lyDoXinNghi}
            options={ca.dsLyDo.map((l) => ({ value: l, label: NHAN_LY_DO_NGHI[l] || l }))} />
        </Field>
      </div>
      <div style={{ marginTop: 16 }}>
        <Field label="Ghi chú chi tiết" error={loi.ghiChu}>
          <TextArea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Nhập ghi chú (không bắt buộc)" rows={3} error={loi.ghiChu} style={{ height: 64, minHeight: 64 }} />
        </Field>
      </div>
      {loiChung && <div style={{ marginTop: 16 }}><Alert type="error">{loiChung}</Alert></div>}
    </Modal>
  );
}
