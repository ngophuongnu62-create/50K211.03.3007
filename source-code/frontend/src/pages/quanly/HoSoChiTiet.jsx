/** MH10 – Chi tiết hồ sơ giáo viên (QL-3.1-b); ngoại lệ 5a (QL-3.1-c). Chỉ xem (BR03). */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Button, Loading, PageHeader, useTai } from '../../components/ui';
import { NHAN_HINH_THUC, NHAN_LOAI_NHAN_SU } from '../../lib/format';
import { TheBangCap } from './HoSoForm';

const sdtDep = (s = '') => s.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

export default function HoSoChiTiet() {
  const { maNhanSu } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: hs, loading, error } = useTai(() => api(`/quan-ly/ho-so-giao-vien/${maNhanSu}`), [maNhanSu]);

  useEffect(() => {
    if (error) {
      // 5a: không có thông tin → thông báo và quay lại danh sách
      toast({ type: 'error', title: error.message, text: 'Hệ thống quay lại danh sách hồ sơ giáo viên.' });
      nav('/quan-ly/ho-so-giao-vien', { replace: true });
    }
  }, [error, nav, toast]);

  if (loading || !hs) return <Loading />;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Hồ sơ giáo viên', to: '/quan-ly/ho-so-giao-vien' }, { label: hs.hoTen }]}
        title={hs.hoTen}
        sub={`${hs.maNhanSu} · ${NHAN_LOAI_NHAN_SU[hs.loaiNhanSu]}`}
        actions={<>
          <Button variant="outline" icon={ArrowLeft} onClick={() => nav('/quan-ly/ho-so-giao-vien')}>Quay lại</Button>
          <Button variant="outline" icon={Pencil} onClick={() => nav(`/quan-ly/ho-so-giao-vien/${hs.maNhanSu}/sua`)}>Chỉnh sửa</Button>
        </>}
      />
      <section className="card" style={{ padding: 28 }}>
        <div className="card-title">Thông tin cá nhân</div>
        <dl className="kv" style={{ marginTop: 16, gridTemplateColumns: '172px 1fr' }}>
          <dt>Họ và tên</dt><dd>{hs.hoTen}</dd>
          <dt>Số điện thoại</dt><dd>{sdtDep(hs.soDienThoai)}</dd>
          <dt>Email</dt><dd>{hs.email}</dd>
          <dt>Địa chỉ</dt><dd>{hs.diaChi || '—'}</dd>
          <dt>Hình thức làm việc</dt><dd>{NHAN_HINH_THUC[hs.hinhThucLamViec]}</dd>
          <dt>Chuyên môn</dt><dd>{hs.chuyenMon.map((c) => c.tenMonHoc).join(', ') || '—'}</dd>
        </dl>
      </section>
      <section className="card" style={{ padding: 28, marginTop: 24 }}>
        <div className="card-title">Trình độ học vấn</div>
        <div className="row gap-16 wrap" style={{ marginTop: 16, alignItems: 'flex-start' }}>
          {hs.bangCap.map((b) => <TheBangCap key={b.maBangCap} bang={b} />)}
          {!hs.bangCap.length && <div className="c-muted">Chưa có bằng cấp, chứng chỉ.</div>}
        </div>
      </section>
    </>
  );
}
