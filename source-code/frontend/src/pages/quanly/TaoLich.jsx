/**
 * MH20 – Tạo lịch dạy (QL-6.1-a), MH21 – Phương án đề xuất (QL-6.1-c)
 * 3.a chưa chọn lớp (QL-6.1-b), 5.a không có phương án (QL-6.1-e), 7.a sửa phương án,
 * 7.b phương án bị trùng (QL-6.1-d), thành công (QL-6.1-f), 8.a không lưu được (QL-6.1-g)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Pencil, RotateCw, Sparkle } from 'lucide-react';
import { api } from '../../api/client';
import { Alert, Button, DateRangePicker, Empty, Field, Loading, PageHeader, Select, TextInput, ThongBaoModal } from '../../components/ui';

const THU = [[1, 'T2'], [2, 'T3'], [3, 'T4'], [4, 'T5'], [5, 'T6'], [6, 'T7'], [0, 'CN']];
const nhanThu = (ds) => {
  const sx = [...ds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const so = sx.filter((t) => t !== 0).map((t) => t + 1);
  const co = sx.includes(0);
  return so.length ? `Thứ ${so.join(', ')}${co ? ', CN' : ''}` : co ? 'CN' : '';
};

export default function TaoLich() {
  const nav = useNavigate();
  const [dsLop, setDsLop] = useState(null);
  const [dm, setDm] = useState({ ca: [], phong: [] });
  const [f, setF] = useState({ maLop: '', tongSoTiet: '', soLuongHocVien: '', tuNgay: '', denNgay: '' });
  const [loi, setLoi] = useState({});
  const [dsPA, setDsPA] = useState(null);
  const [chon, setChon] = useState(0);
  const [dangSua, setDangSua] = useState(false);
  const [nhap, setNhap] = useState(null); // bản sửa của phương án đang chọn
  const [daSua, setDaSua] = useState({}); // { [index]: { thu, ca, phong } } đánh dấu "(đã sửa)"
  const [trung, setTrung] = useState(null);
  const [dang, setDang] = useState('');
  const [hop, setHop] = useState(null); // 'khongCo' | 'thanhCong' | 'loiLuu'
  const [loiChung, setLoiChung] = useState(null);

  useEffect(() => {
    Promise.all([api('/quan-ly/quan-ly-lich/lop-chua-co-lich'), api('/danh-muc/ca-hoc'), api('/danh-muc/phong-hoc')])
      .then(([l, c, p]) => { setDsLop(l.data); setDm({ ca: c.data, phong: p.data }); })
      .catch((e) => setLoiChung(e.message));
  }, []);

  const lop = dsLop?.find((l) => l.maLop === f.maLop);
  const chonLop = (maLop) => {
    const l = dsLop.find((x) => x.maLop === maLop);
    setF({ maLop, tongSoTiet: String(l.tongSoTiet), soLuongHocVien: String(l.soLuongHocVien), tuNgay: l.khoaHoc.ngayBatDau || '', denNgay: l.khoaHoc.ngayKetThuc || '' });
    setLoi({});
    setDsPA(null);
    setTrung(null);
    setDangSua(false);
  };
  const thamSo = () => ({ maLop: f.maLop, tongSoTiet: f.tongSoTiet, soLuongHocVien: f.soLuongHocVien, tuNgay: f.tuNgay, denNgay: f.denNgay });

  const deXuat = async () => {
    setLoi({});
    setTrung(null);
    setLoiChung(null);
    if (!f.maLop) { setLoi({ maLop: 'Vui lòng chọn lớp học!' }); return; } // 3.a
    setDang('deXuat');
    try {
      const { data } = await api('/quan-ly/quan-ly-lich/de-xuat', { method: 'POST', body: thamSo() });
      setDsPA(data.phuongAn);
      setChon(0);
      setDaSua({});
      setDangSua(false);
    } catch (e) {
      if (e.status === 422) setHop('khongCo'); // 5.a
      else if (Object.keys(e.fieldErrors).length) setLoi(e.fieldErrors);
      else setLoiChung(e.message);
    } finally {
      setDang('');
    }
  };

  const batDauSua = () => {
    const pa = dsPA[chon];
    setNhap({ thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong });
    setDangSua(true);
    setTrung(null);
  };

  const kiemTraLai = async () => {
    const pa = dsPA[chon];
    const ban = nhap || { thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong };
    setDang('kiemTra');
    setTrung(null);
    try {
      const { data } = await api('/quan-ly/quan-ly-lich/kiem-tra-phuong-an', { method: 'POST', body: { ...thamSo(), ...ban } });
      setDsPA((ds) => ds.map((x, i) => (i === chon ? { ...data.phuongAn, soThuTu: x.soThuTu } : x)));
      setDaSua((d) => ({ ...d, [chon]: { thu: nhanThu(ban.thu) !== pa.nhanThu, ca: ban.maCa !== pa.maCa, phong: ban.maPhong !== pa.maPhong } }));
      setDangSua(false);
      setNhap(null);
    } catch (e) {
      setTrung({ index: chon, lyDo: e.data?.lyDo || [] }); // 7.b: giữ phương án đang sửa
      setDaSua((d) => ({ ...d, [chon]: { thu: nhanThu(ban.thu) !== pa.nhanThu, ca: ban.maCa !== pa.maCa, phong: ban.maPhong !== pa.maPhong } }));
    } finally {
      setDang('');
    }
  };

  const luu = async () => {
    const pa = dsPA[chon];
    const ban = dangSua && nhap ? nhap : { thu: pa.thu, maCa: pa.maCa, maPhong: pa.maPhong };
    setDang('luu');
    setTrung(null);
    try {
      await api('/quan-ly/quan-ly-lich', { method: 'POST', body: { ...thamSo(), ...ban } });
      setHop('thanhCong');
    } catch (e) {
      if (e.status === 409 && e.code !== 'TRUNG_LAP') setTrung({ index: chon, lyDo: e.data?.lyDo || [] });
      else setHop('loiLuu'); // 8.a
    } finally {
      setDang('');
    }
  };

  if (!dsLop && !loiChung) return <Loading />;

  const phongCua = (m) => dm.phong.find((p) => p._id === m);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy', to: '/quan-ly/quan-ly-lich' }, { label: 'Tạo lịch dạy' }]}
        title="Tạo lịch dạy mới" sub="Hệ thống đề xuất ngày học, giờ học, phòng học dựa trên phòng trống và lịch rảnh giáo viên." />
      {loiChung && <div style={{ marginBottom: 16 }}><Alert type="error">{loiChung}</Alert></div>}
      <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
        <section className="card" style={{ width: 400, flex: 'none', padding: 24 }}>
          <div className="card-title">Thông tin lớp học</div>
          <div className="col gap-16" style={{ marginTop: 16 }}>
            <Field label="Lớp học" required error={loi.maLop}>
              <Select value={f.maLop} onChange={chonLop} placeholder="Chọn lớp học" error={loi.maLop}
                options={(dsLop || []).map((l) => ({ value: l.maLop, label: l.tenLop }))} />
              {/* Bổ sung ngoài Figma: giải thích khi mọi lớp đều đã có lịch (UC_6.1 chỉ áp dụng cho lớp chưa có lịch) */}
              {dsLop?.length === 0 && (
                <div className="c-muted" style={{ fontSize: 13, marginTop: 6 }}>
                  Tất cả lớp đều đã có lịch. Để lập lịch cho tuần tới, dùng “Tạo lịch tuần mới”.
                </div>
              )}
            </Field>
            <Field label="Khóa học">
              <TextInput value={lop?.khoaHoc.tenKhoaHoc || ''} placeholder="Tự động theo lớp" readOnly size="readonly" tabIndex={-1} />
            </Field>
            <div className="row gap-12">
              <div style={{ flex: 1 }}><Field label="Tổng số tiết" error={loi.tongSoTiet}>
                <TextInput inputMode="numeric" value={f.tongSoTiet} onChange={(e) => setF({ ...f, tongSoTiet: e.target.value.replace(/\D/g, '') })} />
              </Field></div>
              <div style={{ flex: 1 }}><Field label="Số lượng học viên" error={loi.soLuongHocVien}>
                <TextInput inputMode="numeric" value={f.soLuongHocVien} onChange={(e) => setF({ ...f, soLuongHocVien: e.target.value.replace(/\D/g, '') })} />
              </Field></div>
            </div>
            <Field label="Khoảng thời gian học" error={loi.khoangThoiGian}>
              <DateRangePicker tuNgay={f.tuNgay} denNgay={f.denNgay} placeholder="Từ ngày → Đến ngày" error={loi.khoangThoiGian}
                onChange={({ tuNgay, denNgay }) => setF({ ...f, tuNgay, denNgay })} />
            </Field>
            <Button block variant={dsPA ? 'outline' : 'primary'} icon={Sparkle} loading={dang === 'deXuat'} onClick={deXuat} style={{ marginTop: 2 }}>Đề xuất lịch</Button>
          </div>
        </section>

        <section className="card grow" style={{ padding: 24, minHeight: dsPA ? undefined : 408 }}>
          {!dsPA ? (
            <div style={{ paddingTop: 56 }}>
              <Empty cream icon={Calendar} title="Chưa có phương án" text="Điền thông tin lớp và bấm “Đề xuất lịch”." />
            </div>
          ) : (
            <>
              <div className="card-title">Phương án đề xuất</div>
              <div className="t-13 c-muted" style={{ marginTop: 3, lineHeight: '16px' }}>Chọn một phương án rồi bấm “Lưu”</div>
              <div className="col gap-16" style={{ marginTop: 16 }} role="radiogroup" aria-label="Phương án đề xuất">
                {dsPA.map((pa, i) => {
                  const sua = dangSua && i === chon;
                  const ds = daSua[i] || {};
                  return (
                    <div key={pa.soThuTu} role="radio" aria-checked={i === chon} tabIndex={0}
                      className={`pa-card ${i === chon ? 'on' : ''} ${trung?.index === i ? 'trung' : ''}`}
                      onClick={() => { if (i !== chon) { setChon(i); setDangSua(false); setTrung(null); } }}>
                      <span className="pa-radio" />
                      <div style={{ width: 130 }}>
                        <div className="t-14 w-600">Phương án {pa.soThuTu}</div>
                        <div className="t-12 c-muted mt-2">{pa.soTuan} tuần · {pa.tongSoTiet} tiết</div>
                      </div>
                      <div style={{ width: 133 }}>
                        <div className="pa-lbl">Ngày học</div>
                        {sua ? (
                          <div className="row gap-4 wrap" style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                            {THU.map(([t, n]) => (
                              <button key={t} type="button" className={`pa-thu ${nhap.thu.includes(t) ? 'on' : ''}`}
                                onClick={() => setNhap((x) => ({ ...x, thu: x.thu.includes(t) ? x.thu.filter((y) => y !== t) : [...x.thu, t] }))}>{n}</button>
                            ))}
                          </div>
                        ) : <div className="pa-val">{pa.nhanThu}{ds.thu ? ' (đã sửa)' : ''}</div>}
                      </div>
                      <div style={{ width: 133 }}>
                        <div className="pa-lbl">Giờ học</div>
                        {sua ? (
                          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
                            <Select size="sm" value={nhap.maCa} onChange={(v) => setNhap((x) => ({ ...x, maCa: v }))}
                              options={dm.ca.map((c) => ({ value: c._id, label: `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}` }))} />
                          </div>
                        ) : <div className="pa-val">{pa.gioHoc}{ds.ca ? ' (đã sửa)' : ''}</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="pa-lbl">Phòng</div>
                        {sua ? (
                          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
                            <Select size="sm" value={nhap.maPhong} onChange={(v) => setNhap((x) => ({ ...x, maPhong: v }))}
                              options={dm.phong.map((p) => ({ value: p._id, label: `${p.tenPhong} · ${p.sucChua} chỗ` }))} />
                          </div>
                        ) : <div className="pa-val">{trung?.index === i && nhap ? phongCua(nhap.maPhong)?.tenPhong : pa.tenPhong}{ds.phong ? ' (đã sửa)' : ''}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {trung && (
                <div style={{ marginTop: 16 }}>
                  <Alert type="error">
                    Thời gian hoặc phòng học bị trùng. Phương án đang sửa được giữ lại để điều chỉnh.
                    {trung.lyDo.length > 0 && <div className="t-12 mt-4" style={{ opacity: 0.85 }}>{trung.lyDo.slice(0, 3).join(' · ')}{trung.lyDo.length > 3 ? ' …' : ''}</div>}
                  </Alert>
                </div>
              )}
              <div className="row between" style={{ marginTop: 16, background: 'var(--cream-100)', borderRadius: 10, padding: '14px 16px' }}>
                <span className="t-13 c-ink-600 w-500">Muốn sửa phương án?</span>
                <div className="row gap-8">
                  <Button variant="outline" size="sm" icon={Pencil} onClick={batDauSua} disabled={dangSua}>Sửa ngày / giờ / phòng</Button>
                  <Button variant="outline" size="sm" icon={RotateCw} loading={dang === 'kiemTra'} onClick={kiemTraLai}>Kiểm tra lại</Button>
                </div>
              </div>
              <div className="row gap-12" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <Button variant="outline" onClick={() => nav('/quan-ly/quan-ly-lich')}>Hủy</Button>
                <Button loading={dang === 'luu'} onClick={luu}>Lưu</Button>
              </div>
            </>
          )}
        </section>
      </div>

      <ThongBaoModal open={hop === 'khongCo'} tone="error" onClose={() => setHop(null)}
        title="Không có thời gian và phòng học phù hợp với lớp đã chọn!" text="Lớp đã chọn được giữ nguyên để bạn chọn lại lớp khác."
        footer={<Button onClick={() => setHop(null)}>OK</Button>} />
      <ThongBaoModal open={hop === 'loiLuu'} tone="x-circle" onClose={() => setHop(null)}
        title="Không lưu được lịch dạy. Vui lòng thử lại!" text="Phương án đã chọn được giữ nguyên để bấm “Lưu” lại."
        footer={<Button onClick={() => setHop(null)}>OK</Button>} />
      <ThongBaoModal open={hop === 'thanhCong'} tone="success" onClose={() => nav('/quan-ly/quan-ly-lich')}
        title="Tạo lịch dạy thành công!" text={`${lop?.tenLop} được lưu ở trạng thái “Nháp” và chưa công bố cho giáo viên, phụ huynh.`}
        footer={<Button onClick={() => nav('/quan-ly/quan-ly-lich', { state: { tab: 'Nhap' } })}>Duyệt lịch dạy</Button>} />
    </>
  );
}
