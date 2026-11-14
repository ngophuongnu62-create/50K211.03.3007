#!/usr/bin/env bash
# Tự giám sát (cron mỗi 2 phút, cài bởi cai-dat-may-chu.sh):
#  - Dịch vụ bị dừng / chưa chạy (VD sau sự cố) → khởi động lại toàn bộ theo đúng thứ tự (docker compose up -d).
#  - Dịch vụ chạy nhưng "unhealthy" (treo, mất kết nối CSDL kéo dài) quá 5 phút từ lần khởi động → khởi động lại dịch vụ đó.
#    (Docker chỉ tự khởi động lại khi tiến trình thoát, không tự xử lý trạng thái treo.)
#  - Ổ đĩa đầy trên 90% → ghi cảnh báo.
# Chỉ ghi log khi có việc phải làm.
set -uo pipefail
THU_MUC="$(cd "$(dirname "$0")/.." && pwd)"
cd "$THU_MUC" || exit 1
log() { echo "[$(date '+%F %T')] $*"; }
NGUONG="${NGUONG_KHONG_KHOE_GIAY:-300}"   # chỉ khởi động lại dịch vụ không khỏe khi nó đã chạy lâu hơn ngưỡng (tránh vòng lặp)

# Không chạy chồng lên lần trước / lên lúc đang cập nhật phiên bản
exec 9>/tmp/broadway-giam-sat.lock
flock -n 9 || exit 0
[ -e /tmp/broadway-dang-cap-nhat ] && exit 0

can_khoi_dong=0
for dv in $(docker compose config --services 2>/dev/null | grep -vx 'thiet-lap-csdl'); do
  id="$(docker compose ps -a -q "$dv" 2>/dev/null | head -1)"
  if [ -z "$id" ]; then
    log "Dịch vụ $dv chưa có container"; can_khoi_dong=1; continue
  fi
  trang_thai="$(docker inspect -f '{{.State.Status}}' "$id")"
  suc_khoe="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$id")"
  case "$trang_thai" in
    running) ;;
    restarting) continue ;;               # Docker đang tự khởi động lại
    paused) log "Dịch vụ $dv bị tạm dừng → tiếp tục"; docker unpause "$id" >/dev/null ;;
    *) log "Dịch vụ $dv ở trạng thái '$trang_thai'"; can_khoi_dong=1; continue ;;
  esac
  if [ "$suc_khoe" = "unhealthy" ]; then
    bat_dau="$(date -d "$(docker inspect -f '{{.State.StartedAt}}' "$id")" +%s 2>/dev/null || echo 0)"
    if [ $(( $(date +%s) - bat_dau )) -ge "$NGUONG" ]; then
      log "Dịch vụ $dv không khỏe (đã chạy quá $((NGUONG / 60)) phút từ lần khởi động) → khởi động lại"
      docker compose restart "$dv" >/dev/null 2>&1 || log "Khởi động lại $dv thất bại"
    fi
  fi
done

if [ "$can_khoi_dong" = 1 ]; then
  log "Khởi động lại hệ thống (docker compose up -d)"
  docker compose up -d --no-build >/dev/null 2>&1 && log "Đã khởi động" || log "Khởi động thất bại – xem: docker compose logs"
fi

dung="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
[ "${dung:-0}" -ge 90 ] && log "CẢNH BÁO: ổ đĩa đã dùng ${dung}% – dọn bản sao lưu cũ hoặc nâng dung lượng"
exit 0
