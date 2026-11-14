#!/usr/bin/env bash
# Sao lưu hằng ngày: toàn bộ CSDL (mongodump bằng tài khoản quản trị) + tệp tải lên (ảnh bằng cấp, minh chứng).
# Cài tự động bởi cai-dat-may-chu.sh (cron 02:30 mỗi ngày). Chạy tay: sudo trien-khai/sao-luu.sh
# Biến tùy chọn: THU_MUC_SAO_LUU (mặc định /var/backups/broadway), GIU_NGAY (mặc định 14 ngày).
set -euo pipefail
THU_MUC="$(cd "$(dirname "$0")/.." && pwd)"
DICH="${THU_MUC_SAO_LUU:-/var/backups/broadway}"
GIU_NGAY="${GIU_NGAY:-14}"
LUC="$(date +%F-%H%M)"
log() { echo "[$(date '+%F %T')] $*"; }

cd "$THU_MUC"
umask 077
mkdir -p "$DICH"

# 1. CSDL – ghi ra tệp tạm, kiểm tra toàn vẹn rồi mới đổi tên (không bao giờ để lại bản sao lưu hỏng mang tên hợp lệ)
TAM="$DICH/.csdl-$LUC.tmp"
docker compose exec -T mongo sh -c 'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db BroadwayDB --archive --gzip --quiet' > "$TAM"
gzip -t "$TAM"
mv "$TAM" "$DICH/csdl-$LUC.archive.gz"

# 2. Tệp tải lên – đọc từ chính container ứng dụng (không cần tải thêm image)
TAM="$DICH/.tep-$LUC.tmp"
docker compose exec -T app tar czf - -C /data/uploads . > "$TAM"
gzip -t "$TAM"
mv "$TAM" "$DICH/tep-tai-len-$LUC.tgz"

# 3. Xóa bản sao lưu cũ hơn GIU_NGAY ngày
find "$DICH" -maxdepth 1 -type f \( -name 'csdl-*.archive.gz' -o -name 'tep-tai-len-*.tgz' \) -mtime "+$GIU_NGAY" -delete
find "$DICH" -maxdepth 1 -type f -name '.*.tmp' -mmin +120 -delete

log "Sao lưu xong: $(du -h "$DICH/csdl-$LUC.archive.gz" | cut -f1) CSDL, $(du -h "$DICH/tep-tai-len-$LUC.tgz" | cut -f1) tệp tải lên → $DICH (giữ $GIU_NGAY ngày)"
