/** MH13 – Danh sách phản hồi (QL-4.1-a); ngoại lệ 3a (QL-4.1-c) */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../../api/client';
import { useToast, useToastChuyenTrang } from '../../components/Toast';
import { Alert, Loading, PageHeader, Seg, Select, TextInput } from '../../components/ui';
import { gioNgay, NHAN_LOAI_NHAN_SU, NHAN_LOAI_PHAN_HOI, NHAN_XU_LY, MAU_XU_LY } from '../../lib/format';

/** Nhãn trạng thái phản hồi dạng thang xám (theo màn hình QL-4.1-a) */
export function NhanXuLy({ trangThai }) {
  return <span className={`badge badge-${MAU_XU_LY[trangThai] || 'gray'}`}>{NHAN_XU_LY[trangThai]}</span>;
}

export const tenNguoiGui = (n) => (n?.loai === 'NhanSu' ? `${n.hoTen} · ${NHAN_LOAI_NHAN_SU[n.vaiTro] || 'Nhân sự'}` : `PH ${n?.hoTen || ''}`);

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'NhanSu', label: 'Giáo viên / Trợ giảng' },
  { key: 'PhuHuynhHocVien', label: 'Phụ huynh / Học viên' },
];

export default function PhanHoiDanhSach() {
  const nav = useNavigate();
  const [nguoiGui, setNguoiGui] = useState('');
  const [q, setQ] = useState(''); // nội dung đang gõ trong ô tìm kiếm
  const [tuKhoa, setTuKhoa] = useState(''); // từ khóa đã áp dụng (sau khi bấm Enter)
  const [trangThai, setTrangThai] = useState('');
  const [kq, setKq] = useState(null);
  const [loi, setLoi] = useState(null);

  const toast = useToast();
  useToastChuyenTrang();

  useEffect(() => {
    const h = setTimeout(() => {
      api('/quan-ly/phan-hoi', { query: { nguoiGui, q: tuKhoa, trangThai } }).then((r) => setKq(r.data)).catch((e) => setLoi(e.message));
    }, 250);
    return () => clearTimeout(h);
  }, [nguoiGui, tuKhoa, trangThai]);

  // QL-4.1-c (ngoại lệ 3a): gõ từ khóa rồi bấm Enter; không có kết quả → thông báo lỗi, xóa ô tìm kiếm, giữ danh sách
  const timKiem = async () => {
    const tu = q.trim();
    if (!tu) { setTuKhoa(''); return; }
    try {
      const r = await api('/quan-ly/phan-hoi', { query: { nguoiGui, q: tu, trangThai } });
      if (!r.data.ds.length) {
        toast({ type: 'error', title: 'Không tìm thấy phản hồi!', text: 'Phản hồi đã bị xóa hoặc hủy trước đó.' });
        setQ('');
        setTuKhoa('');
        return;
      }
      setKq(r.data);
      setTuKhoa(tu);
    } catch (e) {
      setLoi(e.message);
    }
  };

  return (
    <>
      <PageHeader crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Phản hồi & yêu cầu' }]}
        title="Tiếp nhận và xử lý phản hồi" sub="Phản hồi, yêu cầu từ giáo viên, trợ giảng và phụ huynh / học viên." />
      <div className="row between gap-16">
        <Seg cream value={nguoiGui} onChange={setNguoiGui}
          items={TABS.map((t) => ({ ...t, count: t.key === '' && kq?.dem?.ChoXuLy > 0 ? kq.dem.ChoXuLy : undefined }))} />
        <div className="row gap-12">
          <div style={{ width: 280 }}><TextInput icon={Search} placeholder="Tìm theo mã, tiêu đề" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTuKhoa(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') timKiem(); }} /></div>
          <div style={{ width: 200 }}>
            <Select value={trangThai} onChange={setTrangThai}
              options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(NHAN_XU_LY).map(([value, label]) => ({ value, label }))]} />
          </div>
        </div>
      </div>
      {loi && <div className="mt-16"><Alert type="error">{loi}</Alert></div>}
      <div className="card flush" style={{ marginTop: 24 }}>
        {!kq && !loi && <Loading />}
        {kq && (
          <table className="table gray-head">
            <thead><tr><th style={{ width: 122 }}>Mã</th><th style={{ width: 434 }}>Tiêu đề</th><th style={{ width: 250 }}>Người gửi</th><th style={{ width: 150 }}>Thời gian gửi</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {kq.ds.map((p) => (
                <tr key={p.maPhanHoi} className="clickable" style={{ height: 64 }} onClick={() => nav(`/quan-ly/phan-hoi/${p.maPhanHoi}`)}>
                  <td style={{ fontSize: 13, lineHeight: '16px', fontWeight: 500, color: 'var(--ink-500)' }}>{p.maPhanHoi}</td>
                  <td><div className="cell-main">{p.tieuDe}</div><div className="cell-sub">{NHAN_LOAI_PHAN_HOI[p.loaiPhanHoi]}</div></td>
                  <td>{tenNguoiGui(p.nguoiGui)}</td>
                  <td>{gioNgay(p.thoiGianGui).replace(' ', ' · ')}</td>
                  <td><NhanXuLy trangThai={p.trangThaiXuLy} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
