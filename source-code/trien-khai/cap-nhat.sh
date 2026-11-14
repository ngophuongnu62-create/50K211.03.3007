#!/usr/bin/env bash
# Cập nhật phiên bản mới từ GitHub: sao lưu trước → lấy mã mới → build và khởi động lại → kiểm tra sức khỏe.
# Chạy: sudo trien-khai/cap-nhat.sh
set -euo pipefail
THU_MUC="$(cd "$(dirname "$0")/.." && pwd)"
cd "$THU_MUC"
log() { echo "[$(date '+%F %T')] $*"; }

touch /tmp/broadway-dang-cap-nhat
trap 'rm -f /tmp/broadway-dang-cap-nhat' EXIT

log "1/4 Sao lưu trước khi cập nhật"
"$THU_MUC/trien-khai/sao-luu.sh"
log "2/4 Lấy mã mới"
git pull --ff-only
log "3/4 Build và khởi động lại (dữ liệu trong volume được giữ nguyên)"
docker compose up -d --build
log "4/4 Chờ ứng dụng sẵn sàng"
for _ in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null)" = healthy ] && break
  sleep 5
done
if [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)")" != healthy ]; then
  log "Ứng dụng chưa sẵn sàng sau 5 phút – xem: docker compose logs app"; exit 1
fi
docker image prune -f >/dev/null
log "Cập nhật xong: $(git log --oneline -1)"
