/** MH33 – Chọn lớp (học nhiều lớp) (PH-12-c) */
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Loading, PageHeader, useTai } from '../../components/ui';

export default function ChonLop() {
  const nav = useNavigate();
  const { phien } = useAuth();
  const { data: ds, error } = useTai(() => api('/phu-huynh/lop'), []);
  if (error) return <Alert type="error">{error.message}</Alert>;
  if (!ds) return <Loading />;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Theo dõi lịch học' }]} title="Chọn lớp học" sub={`Học viên ${phien.hocVien.tenHocVien} đang theo học ${ds.length} lớp.`} />
      <div className="grid-2" style={{ gap: 20 }}>
        {ds.map((l) => (
          <section key={l.maLop} className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{l.tenLop}</div>
            <div className="t-14 c-muted" style={{ marginTop: 12 }}>{l.lichHoc || 'Chưa có lịch học chính thức'}</div>
            <div className="t-14 c-muted" style={{ marginTop: 12 }}>{l.giaoVien ? `GV ${l.giaoVien}` : '—'}</div>
            <Button block variant="outline" iconRight={ArrowRight} style={{ marginTop: 16 }} onClick={() => nav(`/phu-huynh/lich-hoc?lop=${l.maLop}`)}>Xem thời khóa biểu</Button>
          </section>
        ))}
      </div>
    </>
  );
}
