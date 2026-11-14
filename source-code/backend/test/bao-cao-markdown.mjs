/**
 * Reporter cho node:test: xuất bảng kết quả kiểm thử nghiệp vụ dạng Markdown.
 * Tên ca kiểm thử theo mẫu: "TC-PQ-01 · <kịch bản> → <kết quả mong đợi>"
 */
const NHOM = {
  PQ: 'Sai quyền (xác thực, phân quyền, cách ly dữ liệu)',
  DL: 'Nhập sai dữ liệu',
  TL: 'Trùng lịch',
  TH: 'Thời hạn và xin nghỉ trễ',
  QL: 'Quản lý (trình duyệt)',
  GV: 'Giáo viên / Trợ giảng (trình duyệt)',
  PH: 'Phụ huynh / Học viên (trình duyệt)',
  HT: 'Hệ thống, phân quyền giao diện, vận hành',
  CSDL: 'Xác thực MongoDB và vai trò chỉ ghi nhật ký (MongoDB bật xác thực)',
  SX: 'Tiêu chuẩn production (dữ liệu gốc, chống trùng đồng thời, nhật ký, bảo mật, dữ liệu lạ)',
};
const TIEU_DE = process.env.BAO_CAO_TIEU_DE || 'Kết quả kiểm thử nghiệp vụ và tiêu chuẩn production';
const MO_TA = process.env.BAO_CAO_MO_TA
  || 'bằng `npm test` (thư mục `backend`). Đồng hồ hệ thống cố định ở 09:00 Thứ Tư 11/11/2026 (giờ Việt Nam), dữ liệu mẫu nạp lại trước mỗi nhóm.';

export default async function* baoCaoMarkdown(source) {
  const ds = [];
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const d = ev.data;
    if (d.details?.type === 'suite' || !/^TC-/.test(d.name)) continue;
    const loi = d.details?.error;
    ds.push({
      ten: d.name,
      dat: ev.type === 'test:pass',
      ms: d.details?.duration_ms || 0,
      loi: loi ? String(loi.cause?.message || loi.message || loi).split('\n')[0] : '',
    });
  }
  const dat = ds.filter((x) => x.dat).length;
  const thoiGian = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  let md = `# ${TIEU_DE}\n\n`;
  md += `Chạy lúc ${thoiGian} ${MO_TA}\n\n`;
  md += `**Tổng: ${ds.length} ca · Đạt: ${dat} · Không đạt: ${ds.length - dat}**\n\n`;
  for (const [ma, ten] of Object.entries(NHOM)) {
    const nhom = ds.filter((x) => x.ten.startsWith(`TC-${ma}-`));
    if (!nhom.length) continue;
    md += `## ${ten} (${nhom.filter((x) => x.dat).length}/${nhom.length} đạt)\n\n`;
    md += '| Mã | Kịch bản | Kết quả mong đợi | Kết quả |\n| --- | --- | --- | --- |\n';
    for (const x of nhom) {
      const [dau, mongDoi = ''] = x.ten.split(' → ');
      const [maTC, ...con] = dau.split(' · ');
      const kq = x.dat ? 'Đạt' : `**Không đạt** – ${x.loi.replace(/\|/g, '\\|')}`;
      md += `| ${maTC} | ${con.join(' · ').replace(/\|/g, '\\|')} | ${mongDoi.replace(/\|/g, '\\|')} | ${kq} |\n`;
    }
    md += '\n';
  }
  yield md;
}
