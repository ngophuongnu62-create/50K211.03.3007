/**
 * MH23 – Danh sách giáo viên đề xuất (QL-6.3-a)
 * 4.a chọn ngoài đề xuất (QL-6.3-b), 4.a.8 cảnh báo xung đột (QL-6.3-c), 3.a không có giáo viên (QL-6.3-d),
 * đã lưu – gửi thông báo (QL-6.3-e), gửi thành công (QL-6.3-f), 6.a không lưu được (QL-6.3-g), 8.a chưa gửi được (QL-6.3-h)
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Info, Search, Send, Users } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, Loading, Modal, PageHeader, TextInput, ThongBaoModal } from '../../components/ui';
import { ddmmyyyy, MAU_TRANG_THAI_LICH, NHAN_TRANG_THAI_LICH, vietTat } from '../../lib/format';

/** "Thứ 3, 5 · Ca 3 (17:30 – 21:00) · P.202" → "Thứ 3, 5 · Ca 3 · 17:30 – 21:00" */
export const lichHocKhongPhong = (s = '') => s.replace(/ · [^·]+$/, '').replace(' (', ' · ').replace(')', '');

export function TheThongTinLich({ ttLop, trangThaiLich }) {
  return (
    <section className="card row between" style={{ padding: '20px 20px' }}>
      <div className="row" style={{ gap: 32 }}>
        <div><div className="pa-lbl">Lớp</div><div className="pa-val">{ttLop.tenLop}</div></div>
        <div><div className="pa-lbl">Lịch học</div><div className="pa-val">{ttLop.lichHoc}</div></div>
        <div><div className="pa-lbl">Phòng</div><div className="pa-val">{ttLop.phong}</div></div>
        <div><div className="pa-lbl">Bắt đầu</div><div className="pa-val">{ddmmyyyy(ttLop.batDau)}</div></div>
      </div>
      <Badge tone={MAU_TRANG_THAI_LICH[trangThaiLich]}>{NHAN_TRANG_THAI_LICH[trangThaiLich]}</Badge>
    </section>
  );
}

const moTaGV = (g, dayDu) => [g.chuyenMon.join(', '), dayDu ? `${g.kinhNghiem} năm kinh nghiệm` : `${g.kinhNghiem} năm`, dayDu && g.daDayLopNay ? 'đã dạy lớp này' : null].filter(Boolean).join(' · ');

export default function PhanCong() {
  const { maLop } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState(null);
  const [chon, setChon] = useState(null);
  const [ngoai, setNgoai] = useState(null); // giáo viên chọn ngoài đề xuất
  const [ketQuaKT, setKetQuaKT] = useState(null); // { ok, text }
  const [moDS, setMoDS] = useState(false);
  const [daLuu, setDaLuu] = useState(null); // { gv, trangThaiLich, gui: null|'daGui'|'chuaGui' }
  const [dang, setDang] = useState('');
  const [thanhCong, setThanhCong] = useState(false);

  useEffect(() => {
    api(`/quan-ly/quan-ly-lich/${maLop}/phan-cong`, { query: { vaiTro: 'GiaoVien' } })
      .then(({ data }) => { setDs(data); setChon(data.deXuat[0]?.maNhanSu || null); })
      .catch((e) => setLoi(e.message));
  }, [maLop]);

  const kiemTraLich = async () => {
    setDang('kiemTra');
    setKetQuaKT(null);
    try {
      const { message } = await api(`/quan-ly/quan-ly-lich/${maLop}/kiem-tra-giao-vien`, { method: 'POST', body: { maNhanSu: ngoai.maNhanSu, vaiTro: 'GiaoVien' } });
      setKetQuaKT({ ok: true, text: message || 'Giáo viên phù hợp với thời gian của lịch dạy' });
    } catch (e) {
      setKetQuaKT({ ok: false, text: e.message, lyDo: e.data?.lyDo || [] }); // 4.a.8
    } finally {
      setDang('');
    }
  };

  const xacNhan = async () => {
    const gv = ngoai || ds.deXuat.find((g) => g.maNhanSu === chon);
    if (!gv) return;
    if (ngoai && !ketQuaKT?.ok) { await kiemTraLich(); return; } // BR03: luôn kiểm tra trước khi lưu
    setDang('luu');
    try {
      const { data } = await api(`/quan-ly/quan-ly-lich/${maLop}/phan-cong`, { method: 'POST', body: { maNhanSu: gv.maNhanSu, vaiTro: 'GiaoVien' } });
      setDaLuu({ gv, trangThaiLich: data.trangThaiLich, gui: null });
    } catch (e) {
      if (e.status === 409 && e.data?.lyDo) setKetQuaKT({ ok: false, text: e.message, lyDo: e.data.lyDo });
      else toast({ type: 'error', title: e.message, text: 'Bấm “Xác nhận giáo viên phân công” để lưu lại.' }); // 6.a
    } finally {
      setDang('');
    }
  };

  const guiThongBao = async () => {
    setDang('gui');
    try {
      await api(`/quan-ly/quan-ly-lich/${maLop}/gui-thong-bao`, { method: 'POST' });
      setDaLuu((d) => ({ ...d, gui: 'daGui' }));
      setThanhCong(true);
    } catch {
      setDaLuu((d) => ({ ...d, gui: 'chuaGui' })); // 8.a
    } finally {
      setDang('');
    }
  };

  if (loi) return <><PageHeader crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy', to: '/quan-ly/quan-ly-lich' }, { label: 'Phân công lịch dạy' }]} title="Phân công lịch dạy" /><Alert type="error">{loi}</Alert></>;
  if (!ds) return <Loading />;
  const ttLop = { tenLop: ds.lop.tenLop, lichHoc: lichHocKhongPhong(ds.lichHoc), phong: ds.phong, batDau: ds.batDau };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy', to: '/quan-ly/quan-ly-lich' }, { label: 'Phân công lịch dạy' }]}
        title="Phân công lịch dạy" sub={ds.lop.tenLop}
        actions={daLuu ? (
          <Button icon={Send} loading={dang === 'gui'} onClick={guiThongBao} disabled={daLuu.gui === 'daGui'}>Gửi thông báo cho giáo viên</Button>
        ) : <>
          <Button variant="outline" icon={Users} onClick={() => setMoDS(true)}>Danh sách giáo viên</Button>
          <Button icon={Check} loading={dang === 'luu'} onClick={xacNhan} disabled={!ngoai && !chon}>Xác nhận giáo viên phân công</Button>
        </>}
      />
      <TheThongTinLich ttLop={ttLop} trangThaiLich={daLuu ? daLuu.trangThaiLich : ds.trangThaiLich} />

      <section className="card" style={{ marginTop: 24, padding: 24 }}>
        {daLuu ? (
          <>
            <div className="card-title">Giáo viên được phân công</div>
            <div className="gv-card" style={{ marginTop: 14 }}>
              <span className="avatar gray" style={{ width: 40, height: 40 }}>{vietTat(daLuu.gv.hoTen)}</span>
              <div className="grow"><div className="gv-ten">{daLuu.gv.hoTen}</div><div className="gv-mota">{moTaGV(daLuu.gv, true)}</div></div>
              {daLuu.gui === 'daGui' ? <Badge tone="green">Đã gửi</Badge> : daLuu.gui === 'chuaGui' ? <Badge tone="red">Chưa gửi</Badge> : <Badge tone="blue">Chờ GV xác nhận</Badge>}
            </div>
            <div style={{ marginTop: 14 }}>
              {daLuu.gui === 'chuaGui' ? (
                <Alert type="warning" action={<Button variant="outline" size="sm" loading={dang === 'gui'} onClick={guiThongBao}>Gửi lại</Button>}>
                  Đã lưu phân công nhưng chưa gửi được thông báo cho giáo viên!
                </Alert>
              ) : (
                <div className="alert" style={{ background: 'var(--cream-100)', border: '1px solid var(--cream-200)', color: 'var(--ink-700)' }}>
                  <Info size={20} /><div className="grow">Đã lưu phân công. Bấm “Gửi thông báo cho giáo viên” để gửi lịch dự kiến.</div>
                </div>
              )}
            </div>
          </>
        ) : ngoai ? (
          <>
            <div className="card-title">Giáo viên được chọn ngoài đề xuất</div>
            <div className="t-13 c-muted mt-4">Hệ thống kiểm tra chuyên môn, lịch dạy và lịch rảnh</div>
            <div className={`gv-card on ${ketQuaKT && !ketQuaKT.ok ? 'trung' : ''}`} style={{ marginTop: 14 }}>
              <span className="pa-radio" />
              <span className="avatar gray" style={{ width: 40, height: 40 }}>{vietTat(ngoai.hoTen)}</span>
              <div className="grow"><div className="gv-ten">{ngoai.hoTen}</div><div className="gv-mota">{moTaGV(ngoai)}</div></div>
              <Button variant="outline" size="sm" loading={dang === 'kiemTra'} onClick={kiemTraLich}>Kiểm tra lịch</Button>
            </div>
            {ketQuaKT && (
              <div style={{ marginTop: 14 }}>
                <Alert type={ketQuaKT.ok ? 'success' : 'error'}>
                  {ketQuaKT.text}
                  {!ketQuaKT.ok && ketQuaKT.lyDo?.length > 0 && <div className="t-12 mt-4" style={{ opacity: 0.85 }}>{ketQuaKT.lyDo.slice(0, 3).join(' · ')}</div>}
                </Alert>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="card-title">Giáo viên được đề xuất</div>
            <div className="t-13 c-muted mt-4">Đúng chuyên môn, có lịch rảnh, không trùng lịch · ưu tiên kinh nghiệm và phản hồi tốt</div>
            {ds.deXuat.length === 0 ? (
              <div className="empty" style={{ padding: '36px 0 20px' }}>
                <div className="empty-icon cream"><Users size={24} /></div>
                <div className="empty-title">Không có giáo viên phù hợp với lịch đã chọn!</div>
                <div className="mt-8">Bấm “Danh sách giáo viên” để tự chọn giáo viên ngoài đề xuất.</div>
              </div>
            ) : (
              <div className="col gap-14" style={{ marginTop: 14 }} role="radiogroup" aria-label="Giáo viên được đề xuất">
                {ds.deXuat.map((g) => (
                  <div key={g.maNhanSu} role="radio" aria-checked={chon === g.maNhanSu} tabIndex={0}
                    className={`gv-card ${chon === g.maNhanSu ? 'on' : ''}`} onClick={() => setChon(g.maNhanSu)}>
                    <span className="pa-radio" />
                    <span className="avatar gray" style={{ width: 40, height: 40 }}>{vietTat(g.hoTen)}</span>
                    <div className="grow"><div className="gv-ten">{g.hoTen}</div><div className="gv-mota">{moTaGV(g)}</div></div>
                    {g.daDayLopNay && <span className="badge" style={{ background: 'var(--white)', border: '1px solid var(--border)', color: 'var(--ink-700)', fontWeight: 500 }}>Đã dạy lớp này</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {moDS && <DanhSachGiaoVien onClose={() => setMoDS(false)} onChon={(g) => { setNgoai(g); setKetQuaKT(null); setMoDS(false); }} />}
      <ThongBaoModal open={thanhCong} tone="success" onClose={() => nav('/quan-ly/quan-ly-lich', { state: { tab: 'ChoGVXacNhan' } })}
        title="Gửi phân công lịch dạy thành công!"
        text={`${daLuu?.gv.hoTen} nhận được thông báo lịch dự kiến và cần phản hồi trong 24 giờ.`}
        footer={<Button onClick={() => nav('/quan-ly/quan-ly-lich', { state: { tab: 'ChoGVXacNhan' } })}>OK</Button>} />
    </>
  );
}

/** Luồng 4.a.1–4.a.3: danh sách giáo viên của trung tâm */
function DanhSachGiaoVien({ onClose, onChon }) {
  const [ds, setDs] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api('/quan-ly/nhan-su', { query: { vaiTro: 'GiaoVien' } }).then((r) => setDs(r.data)).catch(() => setDs([])); }, []);
  const loc = (ds || []).filter((g) => !q || g.hoTen.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open wide onClose={onClose} title="Danh sách giáo viên" sub="Chọn giáo viên ngoài danh sách đề xuất rồi bấm “Kiểm tra lịch”.">
      <TextInput icon={Search} placeholder="Tìm theo họ tên" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="col gap-8" style={{ marginTop: 14, maxHeight: 380, overflow: 'auto' }}>
        {!ds && <Loading />}
        {loc.map((g) => (
          <button key={g.maNhanSu} type="button" className="gv-card" style={{ textAlign: 'left', width: '100%' }} onClick={() => onChon(g)}>
            <span className="avatar gray" style={{ width: 40, height: 40 }}>{vietTat(g.hoTen)}</span>
            <div className="grow"><div className="gv-ten">{g.hoTen}</div><div className="gv-mota">{moTaGV(g)}</div></div>
          </button>
        ))}
        {ds && !loc.length && <div className="c-muted t-13">Không có giáo viên phù hợp.</div>}
      </div>
    </Modal>
  );
}
