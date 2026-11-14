/**
 * MH38 – Biểu mẫu gửi phản hồi / ý kiến (PH-14-a)
 * 5a thiếu tiêu đề / nội dung (PH-14-b), gửi thành công và mã phiếu (PH-14-c)
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Copy, Paperclip, Send, X } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/Toast';
import { Alert, Button, Field, PageHeader, TextArea, TextInput } from '../../components/ui';
import { NHAN_LOAI_PHAN_HOI } from '../../lib/format';

const LOAI = ['ChatLuongGiangDay', 'CoSoVatChat', 'DichVu', 'YKienKhac'];
const sdtDep = (s = '') => s.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
const kichThuoc = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function GuiYKien() {
  const nav = useNavigate();
  const toast = useToast();
  const { phien } = useAuth();
  const hv = phien.hocVien;
  const [f, setF] = useState({ loaiPhanHoi: '', tieuDe: '', noiDung: '' });
  const [tep, setTep] = useState(null);
  const [loi, setLoi] = useState({});
  const [loiChung, setLoiChung] = useState(null);
  const [dang, setDang] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const fileRef = useRef(null);

  const doi = (k) => (e) => { const v = e?.target ? e.target.value : e; setF((x) => ({ ...x, [k]: v })); setLoi((l) => ({ ...l, [k]: undefined })); };

  const gui = async () => {
    setLoiChung(null);
    setLoi({});
    if (!f.loaiPhanHoi) { setLoi({ loaiPhanHoi: 'Vui lòng chọn phân loại ý kiến.' }); return; }
    if (!f.tieuDe.trim() || !f.noiDung.trim()) {
      setLoiChung('Vui lòng nhập đầy đủ Tiêu đề và Nội dung phản hồi trước khi gửi!'); // 5a
      setLoi({ tieuDe: !f.tieuDe.trim(), noiDung: !f.noiDung.trim() });
      return;
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(f)) fd.append(k, v);
    if (tep) fd.append('tepDinhKem', tep);
    setDang(true);
    try {
      const { data } = await api('/phu-huynh/gop-y', { method: 'POST', form: fd });
      setKetQua(data);
    } catch (e) {
      setLoiChung(e.message); // giữ nguyên dữ liệu đã nhập
    } finally {
      setDang(false);
    }
  };

  if (ketQua) {
    return (
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 220 }}>
        <span className="tb-icon success" style={{ width: 64, height: 64 }}><CheckCircle2 size={32} /></span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '24px 0 0' }}>Gửi thành công</h1>
        <p className="t-15 c-muted" style={{ marginTop: 22 }}>Trung tâm đã nhận ý kiến của bạn và chuyển tới Quản lý để xử lý.</p>
        <div className="card" style={{ width: 560, padding: '22px 0', marginTop: 14 }}>
          <div className="t-12 w-600 c-muted" style={{ letterSpacing: '.04em' }}>MÃ PHIẾU (TICKET ID)</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--brand)', letterSpacing: '.03em', marginTop: 4 }}>{ketQua.maPhieu}</div>
        </div>
        <p className="t-13 c-ink-600" style={{ maxWidth: 480, marginTop: 24, lineHeight: 1.55 }}>Dùng mã phiếu ở mục “Tra cứu phiếu” để theo dõi tiến độ và nhận câu trả lời chính thức.</p>
        <div className="row gap-12" style={{ marginTop: 14 }}>
          <Button variant="outline" icon={Copy} onClick={() => navigator.clipboard?.writeText(ketQua.maPhieu).then(() => toast({ title: 'Đã sao chép mã phiếu.' }))}>Sao chép mã</Button>
          <Button iconRight={ArrowRight} onClick={() => nav(`/phu-huynh/tra-cuu-phieu?ma=${ketQua.maPhieu}`)}>Tra cứu tiến độ</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader crumbs={[{ label: 'Gửi ý kiến' }]} title="Gửi phản hồi / ý kiến" sub="Góp ý về chất lượng giảng dạy, cơ sở vật chất, dịch vụ. Bạn sẽ nhận mã phiếu để theo dõi." />
      {loiChung && <div style={{ marginBottom: 16 }}><Alert type="error">{loiChung}</Alert></div>}
      <section className="card" style={{ padding: 32 }}>
        <div className="grid-2" style={{ gap: 20 }}>
          <Field label="Tên học viên"><TextInput value={hv.tenHocVien} readOnly size="readonly" tabIndex={-1} /></Field>
          <Field label="Số điện thoại"><TextInput value={sdtDep(hv.soDienThoai || '') || hv.soDienThoaiAn} readOnly size="readonly" tabIndex={-1} /></Field>
        </div>
        <div style={{ marginTop: 18 }}>
          <Field label="Phân loại ý kiến" required error={typeof loi.loaiPhanHoi === 'string' ? loi.loaiPhanHoi : null}>
            <div className="row gap-10" role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {LOAI.map((l) => (
                <button key={l} type="button" role="radio" aria-checked={f.loaiPhanHoi === l}
                  className={`radio-o ${f.loaiPhanHoi === l ? 'on' : ''} ${loi.loaiPhanHoi ? 'error' : ''}`} onClick={() => doi('loaiPhanHoi')(l)}>
                  <span className="pa-radio" />{NHAN_LOAI_PHAN_HOI[l]}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div style={{ marginTop: 18 }}>
          <Field label="Tiêu đề" required>
            <TextInput value={f.tieuDe} onChange={doi('tieuDe')} placeholder="Nhập tiêu đề" error={loi.tieuDe} maxLength={200} />
          </Field>
        </div>
        <div style={{ marginTop: 18 }}>
          <Field label="Nội dung đóng góp" required>
            <TextArea value={f.noiDung} onChange={doi('noiDung')} placeholder="Mô tả chi tiết ý kiến của bạn" error={loi.noiDung} rows={4} />
          </Field>
        </div>
        <div className="row gap-12" style={{ marginTop: 14, border: '1px dashed var(--border-strong)', borderRadius: 10, padding: '12px 16px' }}>
          <Paperclip size={18} color="var(--ink-500)" />
          <div className="grow">
            <div className="t-13 w-500">{tep ? `${tep.name} · ${kichThuoc(tep.size)}` : 'Đính kèm hình ảnh hoặc tệp minh chứng'}</div>
            <div className="t-12 c-muted mt-2">.jpg, .png hoặc .pdf (không bắt buộc)</div>
          </div>
          {tep && <button type="button" className="icon-btn" aria-label="Bỏ tệp" onClick={() => setTep(null)}><X size={16} /></button>}
          <Button variant="outline" size="sm" onClick={() => fileRef.current.click()}>Chọn tệp</Button>
          <input ref={fileRef} type="file" hidden accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={(e) => { const t = e.target.files[0]; if (t && /\.(jpe?g|png|pdf)$/i.test(t.name)) setTep(t); e.target.value = ''; }} />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <Button icon={Send} loading={dang} onClick={gui}>Gửi phản hồi</Button>
        </div>
      </section>
    </>
  );
}
