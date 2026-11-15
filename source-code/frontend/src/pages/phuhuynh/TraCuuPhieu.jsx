/** MH39 – Tra cứu tiến độ theo mã phiếu (PH-14-d). Chỉ hiển thị trạng thái công khai và câu trả lời chính thức (BR02). */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Search, Ticket } from 'lucide-react';
import { api } from '../../api/client';
import { Alert, Badge, Button, PageHeader, TextInput } from '../../components/ui';
import { gioNgay, gioNgayDayDu, NHAN_LOAI_PHAN_HOI } from '../../lib/format';

export const MAU_CONG_KHAI = { ChoXuLy: 'gray', DangXuLy: 'blue', DaXuLy: 'green', TuChoi: 'green' };

export default function TraCuuPhieu() {
  const [sp, setSp] = useSearchParams();
  const [ma, setMa] = useState(sp.get('ma') || '');
  const [p, setP] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dang, setDang] = useState(false);

  const traCuu = useCallback(async (m) => {
    const maPhieu = (m || '').trim().toUpperCase();
    setLoi(null);
    setP(null);
    if (!maPhieu) { setLoi('Vui lòng nhập mã phiếu.'); return; }
    setDang(true);
    try {
      const { data } = await api(`/phu-huynh/gop-y/${encodeURIComponent(maPhieu)}`);
      setP(data);
      setSp({ ma: maPhieu }, { replace: true });
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDang(false);
    }
  }, [setSp]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sp.get('ma')) traCuu(sp.get('ma')); }, []);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Tra cứu phiếu' }]} title="Tra cứu tiến độ phản hồi"
        sub={<>Nhập mã phiếu hoặc xem trong “<Link to="/phu-huynh/lich-su-phan-hoi" style={{ color: 'inherit' }}>Lịch sử phản hồi</Link>”.</>} />
      <form className="row gap-12" onSubmit={(e) => { e.preventDefault(); traCuu(ma); }}>
        <div className="grow"><TextInput icon={Ticket} value={ma} onChange={(e) => setMa(e.target.value)} placeholder="VD: PH-2611-0042" /></div>
        <Button type="submit" icon={Search} loading={dang}>Tra cứu</Button>
      </form>
      {loi && <div style={{ marginTop: 20 }}><Alert type="error">{loi}</Alert></div>}
      {p && (
        <section className="card" style={{ marginTop: 24, padding: 28 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="card-title">{p.tieuDe}</div>
              <div className="t-13 c-muted mt-4">{p.maPhieu} · {NHAN_LOAI_PHAN_HOI[p.loaiPhanHoi]} · Gửi {gioNgayDayDu(p.thoiGianGui).replace(' · ', ' ')}</div>
            </div>
            <Badge tone={MAU_CONG_KHAI[p.trangThaiXuLy]}>{p.nhanTrangThai}</Badge>
          </div>
          <div className="tien-do cong-khai" style={{ marginTop: 24 }}>
            {p.tienDo.map((b, i) => {
              const hienTai = b.daQua && !p.tienDo[i + 1]?.daQua;
              return (
                <div key={b.buoc} className={`td-buoc ${b.daQua ? 'on' : ''} ${hienTai && i > 0 ? 'hien-tai' : ''} ${b.daQua && !hienTai ? 'xong' : ''} ${i === 0 && b.daQua ? 'xong' : ''}`}>
                  <span className="td-so">{b.daQua && (!hienTai || i === 0) ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span>
                    <span className="td-ten" style={{ display: 'block' }}>{b.buoc}</span>
                    {b.thoiGian && <span className="t-12 c-muted">{gioNgay(b.thoiGian).replace(' ', ' · ')}</span>}
                  </span>
                  {i < p.tienDo.length - 1 && <span className="td-noi" />}
                </div>
              );
            })}
          </div>
          <hr className="divider" style={{ margin: '20px 0' }} />
          <div className="t-14 w-600">Câu trả lời chính thức</div>
          {p.cauTraLoiChinhThuc ? (
            <div style={{ marginTop: 10, background: 'var(--cream-50)', borderRadius: 10, padding: 16 }}>
              <p className="t-14" style={{ margin: 0, lineHeight: 1.6 }}>{p.cauTraLoiChinhThuc.noiDung}</p>
              <div className="t-12 c-muted" style={{ marginTop: 8 }}>Trung tâm Broadway · {gioNgayDayDu(p.cauTraLoiChinhThuc.thoiGian).replace(' · ', ' ')}</div>
            </div>
          ) : <div className="t-13 c-muted mt-8">Trung tâm chưa có câu trả lời chính thức.</div>}
        </section>
      )}
    </>
  );
}
