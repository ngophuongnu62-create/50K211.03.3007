/**
 * Phục vụ tệp tải lên từ MongoDB (GridFS) tại /uploads/<thư mục>/<tên tệp> – cùng đường dẫn đã lưu trong CSDL.
 * Không có trong GridFS → chuyển tiếp (thư mục UPLOAD_DIR trên ổ đĩa vẫn phục vụ tệp của bản cũ, nếu có).
 */
const { timTep, moLuongDoc } = require('../utils/luuTep');

async function phucVuTep(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let ten;
  try {
    ten = decodeURIComponent(req.path.replace(/^\/+/, ''));
  } catch {
    return next();
  }
  let tep;
  try {
    tep = await timTep(ten);
  } catch (err) {
    return next(err);
  }
  if (!tep) return next();

  const etag = `"${tep._id}"`;
  res.set({
    'Content-Type': tep.metadata?.loaiNoiDung || 'application/octet-stream',
    // Tên tệp ngẫu nhiên, nội dung không bao giờ đổi
    'Cache-Control': 'private, max-age=31536000, immutable',
    ETag: etag,
    'Last-Modified': tep.uploadDate.toUTCString(),
  });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('Content-Length', String(tep.length));
  if (req.method === 'HEAD') return res.end();

  const luong = moLuongDoc(tep._id);
  luong.once('error', (err) => {
    if (!res.headersSent) return next(err);
    return res.destroy(err);
  });
  return luong.pipe(res);
}

module.exports = { phucVuTep };
