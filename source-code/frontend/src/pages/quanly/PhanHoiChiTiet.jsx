/**
 * MH14 – Chi tiết phản hồi (QL-4.1-b)
 * MH15 – Cập nhật trạng thái xử lý (QL-4.2-a…d): 7a chưa chọn trạng thái, 7b từ chối thiếu lý do
 * MH16 – Soạn phản hồi người gửi (QL-4.3-a…d): 7a nội dung trống, 9a gửi không thành công
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Send } from 'lucide-react';
import { api, duongDanTep } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Button, Field, Loading, Modal, PageHeader, Select, TextArea, useTai } from '../../components/ui';
import { gioNgay, gioNgayDayDu, NHAN_LOAI_PHAN_HOI, NHAN_XU_LY } from '../../lib/format';
import { NhanXuLy, tenNguoiGui } from './PhanHoiDanhSach';

export default function PhanHoiChiTiet() {
  const { maPhanHoi } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: p, error, reload } = useTai(() => api(`/quan-ly/phan-hoi/${maPhanHoi}`), [maPhanHoi]);
  const [moTT, setMoTT] = useState(false);
  const [moPH, setMoPH] = useState(false);

  useEffect(() => {
    // 3a: phản hồi không còn tồn tại → quay lại danh sách kèm thông báo
    if (error) nav('/quan-ly/phan-hoi', { replace: true, state: { toast: { type: 'error', title: error.message, text: 'Phản hồi đã bị xóa hoặc hủy trước đó.' } } });
  }, [error, nav]);

  if (!p) return <Loading />;
  const traLoi = p.lichSuXuLy.filter((l) => l.loaiThaoTac === 'PhanHoiNguoiGui');
  const coTheCapNhat = ['ChoXuLy', 'DangXuLy'].includes(p.trangThaiXuLy);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Phản hồi & yêu cầu', to: '/quan-ly/phan-hoi' }, { label: p.maPhanHoi }]}
        title={p.tieuDe}
        sub={`Mã phản hồi ${p.maPhanHoi}`}
        actions={<>
          <Button variant="outline" icon={ArrowLeft} onClick={() => nav('/quan-ly/phan-hoi')}>Quay lại</Button>
          <Button variant="outline" onClick={() => setMoTT(true)} disabled={!coTheCapNhat} title={coTheCapNhat ? undefined : 'Chỉ cập nhật phản hồi đang Chờ xử lý hoặc Đang xử lý'}>Cập nhật trạng thái</Button>
          <Button icon={Send} onClick={() => setMoPH(true)}>Phản hồi</Button>
        </>}
      />
      <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
        <div className="grow col gap-20">
          <section className="card" style={{ padding: 28 }}>
            <dl className="kv kv-figma" style={{ gridTemplateColumns: '150px 1fr', columnGap: 12, rowGap: 18 }}>
              <dt>Loại phản hồi</dt><dd>{NHAN_LOAI_PHAN_HOI[p.loaiPhanHoi]}</dd>
              <dt>Người gửi</dt><dd>{tenNguoiGui(p.nguoiGui)}</dd>
              <dt>Thời gian gửi</dt><dd>{gioNgayDayDu(p.thoiGianGui)}</dd>
              <dt>Trạng thái</dt><dd><NhanXuLy trangThai={p.trangThaiXuLy} /></dd>
            </dl>
            <hr className="divider" style={{ margin: '18px 0' }} />
            <div className="t-13 c-muted w-500" style={{ lineHeight: '16px' }}>Nội dung chi tiết</div>
            <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: '24px', color: 'var(--ink-900)', whiteSpace: 'pre-wrap' }}>{p.noiDung}</p>
            {p.tepDinhKem.length > 0 && (
              <div className="row gap-12 wrap" style={{ marginTop: 16 }}>
                {p.tepDinhKem.map((t) => (
                  <a key={t.maTep} href={duongDanTep(t.duongDan)} target="_blank" rel="noreferrer" className="btn btn-outline sm"><FileText size={15} />{t.tenTep}</a>
                ))}
              </div>
            )}
          </section>
          {traLoi.map((t) => (
            <section key={t.maLichSu} className="card" style={{ padding: 28, background: 'var(--cream-50)' }}>
              <div className="t-14 w-600">Phản hồi của Quản lý <span className="c-muted w-500">· {gioNgay(t.thoiGianXuLy).replace(' ', ' · ')}</span></div>
              <p className="t-15" style={{ marginTop: 10, lineHeight: 1.6 }}>{t.noiDungPhanHoi}</p>
            </section>
          ))}
        </div>
        <section className="card" style={{ width: 340, flex: 'none' }}>
          <div className="card-title">Lịch sử xử lý</div>
          <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }} className="col gap-16">
            <MocLichSu tieuDe="Tiếp nhận phản hồi" phu={`Hệ thống · ${gioNgay(p.thoiGianGui)}`} />
            {p.lichSuXuLy.map((l) => (
              <MocLichSu key={l.maLichSu}
                tieuDe={l.loaiThaoTac === 'PhanHoiNguoiGui' ? 'Đã gửi phản hồi cho người gửi' : `${NHAN_XU_LY[l.trangThaiSau]}${l.ghiChuXuLy ? ` — ${l.ghiChuXuLy}` : ''}`}
                phu={`${l.hoTenQuanLy || 'Quản lý'} · ${gioNgay(l.thoiGianXuLy)}`} />
            ))}
          </ol>
        </section>
      </div>
      {moTT && <CapNhatTrangThai p={p} onClose={() => setMoTT(false)} onXong={(msg) => { setMoTT(false); reload(); toast({ title: msg, text: 'Trạng thái mới đã đồng bộ tới người gửi.' }); }} />}
      {moPH && <SoanPhanHoi p={p} onClose={() => setMoPH(false)} onXong={(msg) => { setMoPH(false); reload(); toast({ title: msg, text: `${p.nguoiGui.hoTen} đã nhận được phản hồi.` }); }} />}
    </>
  );
}

function MocLichSu({ tieuDe, phu }) {
  return (
    <li className="row gap-12" style={{ alignItems: 'flex-start' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand)', marginTop: 3, flex: 'none' }} />
      <div><div className="t-13 w-500" style={{ lineHeight: '16px', color: 'var(--ink-900)' }}>{tieuDe}</div><div className="t-12 c-muted" style={{ marginTop: 2, lineHeight: '15px' }}>{phu}</div></div>
    </li>
  );
}

/** MH15 */
function CapNhatTrangThai({ p, onClose, onXong }) {
  const [tt, setTt] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [loi, setLoi] = useState({});
  const [dangGui, setDangGui] = useState(false);
  const luu = async () => {
    setDangGui(true);
    setLoi({});
    try {
      const { message } = await api(`/quan-ly/phan-hoi/${p.maPhanHoi}/trang-thai`, { method: 'PATCH', body: { trangThaiMoi: tt, ghiChu } });
      onXong(message);
    } catch (e) {
      setLoi({ ...e.fieldErrors, chung: Object.keys(e.fieldErrors).length ? null : e.message });
    } finally {
      setDangGui(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Cập nhật trạng thái xử lý" sub={`${p.maPhanHoi} · ${p.tieuDe}`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button loading={dangGui} onClick={luu}>Lưu</Button></>}>
      <div className="col gap-16">
        {loi.chung && <Alert type="error">{loi.chung}</Alert>}
        <Field label="Trạng thái mới" required error={loi.trangThaiMoi}>
          <Select value={tt} onChange={(v) => { setTt(v); setLoi({}); }} placeholder="Chọn trạng thái" error={loi.trangThaiMoi}
            options={[{ value: 'DangXuLy', label: 'Đang xử lý' }, { value: 'DaXuLy', label: 'Đã xử lý' }, { value: 'TuChoi', label: 'Từ chối' }]} />
        </Field>
        <Field label="Ghi chú xử lý" required={tt === 'TuChoi'} error={loi.ghiChu}>
          <TextArea value={ghiChu} onChange={(e) => { setGhiChu(e.target.value); setLoi({}); }} error={loi.ghiChu} placeholder={tt === 'TuChoi' ? 'Nhập lý do từ chối' : 'Nhập ghi chú'} />
        </Field>
      </div>
    </Modal>
  );
}

/** MH16 */
function SoanPhanHoi({ p, onClose, onXong }) {
  const [noiDung, setNoiDung] = useState('');
  const [loi, setLoi] = useState(null);
  const [loiChung, setLoiChung] = useState(null);
  const [dangGui, setDangGui] = useState(false);
  const gui = async () => {
    setDangGui(true);
    setLoi(null);
    setLoiChung(null);
    try {
      const { message } = await api(`/quan-ly/phan-hoi/${p.maPhanHoi}/tra-loi`, { method: 'POST', body: { noiDung } });
      onXong(message);
    } catch (e) {
      if (e.fieldErrors.noiDung) setLoi(e.fieldErrors.noiDung);
      else setLoiChung(e.message); // 9a
    } finally {
      setDangGui(false);
    }
  };
  return (
    <Modal open wide onClose={onClose} title="Phản hồi lại người gửi" style={{ width: 600 }}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button icon={Send} loading={dangGui} onClick={gui}>Gửi</Button></>}>
      <dl className="kv kv-figma" style={{ background: 'var(--cream-100)', borderRadius: 10, padding: 16, gridTemplateColumns: '130px 1fr', columnGap: 12, rowGap: 10 }}>
        <dt>Mã yêu cầu</dt><dd>{p.maPhanHoi}</dd>
        <dt>Người gửi</dt><dd>{tenNguoiGui(p.nguoiGui)}</dd>
        <dt>Thời gian gửi</dt><dd>{gioNgayDayDu(p.thoiGianGui)}</dd>
        <dt>Nội dung</dt><dd>{p.tieuDe}</dd>
      </dl>
      <div style={{ marginTop: 16 }}>
        <Field label="Nội dung phản hồi" required error={loi}>
          <TextArea value={noiDung} onChange={(e) => { setNoiDung(e.target.value); setLoi(null); }} error={loi} placeholder="Nhập nội dung phản hồi cho người gửi" rows={5} />
        </Field>
      </div>
      {loiChung && <div style={{ marginTop: 16 }}><Alert type="error">{loiChung} Vui lòng gửi lại.</Alert></div>}
    </Modal>
  );
}
