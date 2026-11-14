#!/usr/bin/env bash
# =====================================================================================================================
#  Cài đặt hệ thống Broadway lên MÁY CHỦ (VPS / máy chủ tại trung tâm) để chạy 24/7 – máy tính cá nhân tắt vẫn hoạt động.
#  Hỗ trợ Ubuntu 22.04 / 24.04 (và Debian 12). Chạy trong thư mục repo đã clone về máy chủ:
#
#      sudo bash trien-khai/cai-dat-may-chu.sh
#
#  Việc trình cài đặt làm:
#   1. Kiểm tra máy (CPU hỗ trợ MongoDB 7, RAM, ổ đĩa), đặt múi giờ Việt Nam, tạo bộ nhớ swap nếu RAM ít
#   2. Cài Docker (kho chính thức của Docker), bật tự khởi động cùng máy chủ
#   3. Bật tường lửa: chỉ mở SSH + cổng web
#   4. Tạo tệp .env với các mật khẩu / khóa bí mật ngẫu nhiên (chỉ root đọc được)
#   5. Build và khởi động hệ thống; mọi dịch vụ tự chạy lại khi lỗi hoặc khi máy chủ khởi động lại
#   6. Cài lịch tự động: sao lưu 02:30 hằng ngày, tự giám sát mỗi 2 phút; cập nhật bảo mật hệ điều hành tự động
#
#  Chạy lại an toàn: bước nào đã xong thì bỏ qua; KHÔNG ghi đè .env, KHÔNG xóa dữ liệu.
#  Không hỏi (tự động hóa): đặt sẵn TEN_MIEN, EMAIL_ACME, ADMIN_EMAIL, ADMIN_SO_DIEN_THOAI và KHONG_HOI=1.
#  Dùng tường lửa của nhà cung cấp thay cho ufw: BO_QUA_TUONG_LUA=1.
# =====================================================================================================================
set -euo pipefail

THU_MUC="$(cd "$(dirname "$0")/.." && pwd)"
buoc() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
canh_bao() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
dung_lai() { printf '\033[1;31m[x] %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || dung_lai "Cần quyền root: sudo bash trien-khai/cai-dat-may-chu.sh"
command -v apt-get >/dev/null || dung_lai "Trình cài đặt hỗ trợ Ubuntu / Debian."
[ -f "$THU_MUC/docker-compose.yml" ] || dung_lai "Không thấy docker-compose.yml – hãy chạy trong thư mục repo đã clone."
[[ "$THU_MUC" =~ [[:space:]] ]] && dung_lai "Đường dẫn thư mục cài đặt không được có dấu cách: $THU_MUC"
cd "$THU_MUC"

# ---------------------------------------------------------------------------------------------------------------------
buoc "1/6 Kiểm tra máy chủ"
if [ "$(uname -m)" = x86_64 ] && ! grep -qw avx /proc/cpuinfo; then
  dung_lai "CPU không hỗ trợ AVX nên MongoDB 7 không chạy được. Hãy chọn gói VPS khác (đa số VPS hiện nay đều hỗ trợ)."
fi
RAM_MB="$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)"
DIA_GB="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
echo "CPU: $(nproc) nhân · RAM: ${RAM_MB} MB · Ổ đĩa trống: ${DIA_GB} GB"
[ "$RAM_MB" -lt 1800 ] && canh_bao "RAM dưới 2 GB – có thể chạy chậm; khuyến nghị gói tối thiểu 2 GB RAM."
[ "$DIA_GB" -lt 10 ] && canh_bao "Ổ đĩa trống dưới 10 GB – khuyến nghị tối thiểu 20 GB (dữ liệu + bản sao lưu 14 ngày)."

if command -v timedatectl >/dev/null && timedatectl set-timezone Asia/Ho_Chi_Minh 2>/dev/null; then :; else
  ln -sf /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime 2>/dev/null || true
fi
echo "Múi giờ: $(date +%Z) (giờ hiện tại $(date '+%H:%M %d/%m/%Y'))"

if [ -z "$(swapon --noheadings 2>/dev/null)" ] && [ "$RAM_MB" -lt 3500 ]; then
  if fallocate -l 2G /swapfile 2>/dev/null && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile 2>/dev/null; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Đã tạo bộ nhớ swap 2 GB (giúp build và chạy ổn định khi RAM ít)."
  else
    rm -f /swapfile; canh_bao "Không tạo được swap – bỏ qua."
  fi
fi

# ---------------------------------------------------------------------------------------------------------------------
buoc "2/6 Cài Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl cron logrotate unattended-upgrades >/dev/null
if ! command -v docker >/dev/null; then
  # shellcheck disable=SC1091
  . /etc/os-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
# Docker và cron tự chạy cùng máy chủ → hệ thống tự lên lại sau khi máy chủ khởi động lại
if command -v systemctl >/dev/null && systemctl enable --now docker cron >/dev/null 2>&1; then :; else
  canh_bao "Không bật được dịch vụ docker / cron bằng systemd – kiểm tra hai dịch vụ này đã tự chạy khi khởi động máy."
fi
PHIEN_BAN_COMPOSE="$(docker compose version --short 2>/dev/null || echo 0)"
printf '%s\n%s\n' 2.24.0 "$PHIEN_BAN_COMPOSE" | sort -V -C || dung_lai "Cần Docker Compose ≥ 2.24 (đang có $PHIEN_BAN_COMPOSE): apt-get install docker-compose-plugin"
echo "$(docker --version) · Compose $PHIEN_BAN_COMPOSE"

# ---------------------------------------------------------------------------------------------------------------------
buoc "3/6 Cấu hình (.env)"
hoi() { # hoi <BIẾN> <câu hỏi> – giữ giá trị đặt sẵn trong môi trường; KHONG_HOI=1 thì không hỏi
  local bien="$1" cau="$2" tra_loi
  [ -n "${!bien:-}" ] && return 0
  [ "${KHONG_HOI:-0}" = 1 ] && { printf -v "$bien" '%s' ""; return 0; }
  read -r -p "$cau" tra_loi || tra_loi=""
  printf -v "$bien" '%s' "$tra_loi"
}
if [ -f .env ]; then
  echo "Đã có tệp .env – giữ nguyên (không đổi mật khẩu, không đổi tên miền)."
  TEN_MIEN="$(grep -E '^TEN_MIEN=' .env | cut -d= -f2- || true)"
else
  hoi TEN_MIEN "Tên miền đã trỏ về máy chủ này (VD lichday.broadway.edu.vn; để trống nếu chưa có → chạy http://IP:8080): "
  TEN_MIEN="$(echo "${TEN_MIEN:-}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
  if [ -n "$TEN_MIEN" ]; then
    hoi EMAIL_ACME "Email nhận thông báo chứng chỉ HTTPS: "
    [[ "${EMAIL_ACME:-}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || dung_lai "Email chứng chỉ không hợp lệ."
  fi
  hoi ADMIN_EMAIL "Email tài khoản Quản lý khởi tạo: "
  [[ "${ADMIN_EMAIL:-}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || dung_lai "Email Quản lý không hợp lệ."
  hoi ADMIN_SO_DIEN_THOAI "Số điện thoại tài khoản Quản lý khởi tạo (10 số, bắt đầu bằng 0): "
  ADMIN_SO_DIEN_THOAI="$(echo "${ADMIN_SO_DIEN_THOAI:-}" | tr -d '[:space:]')"
  [[ "$ADMIN_SO_DIEN_THOAI" =~ ^0[0-9]{9}$ ]] || dung_lai "Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0)."

  IP_MAY="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$TEN_MIEN" ]; then DIA_CHI="https://$TEN_MIEN"; else DIA_CHI="http://${IP_MAY:-localhost}:8080"; fi
  umask 077
  {
    echo "# Tạo bởi trien-khai/cai-dat-may-chu.sh lúc $(date '+%F %T'). Chứa mật khẩu – KHÔNG chia sẻ, KHÔNG đưa lên Git."
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "CORS_ORIGIN=$DIA_CHI"
    echo "MONGO_ROOT_USER=quantri"
    echo "MONGO_ROOT_PASSWORD=$(openssl rand -hex 24)"
    echo "MONGO_APP_USER=broadway_app"
    echo "MONGO_APP_PASSWORD=$(openssl rand -hex 24)"
    echo "ADMIN_TEN_DANG_NHAP=admin"
    echo "ADMIN_EMAIL=$ADMIN_EMAIL"
    echo "ADMIN_SO_DIEN_THOAI=$ADMIN_SO_DIEN_THOAI"
    echo "CONG=8080"
    # Máy ít RAM (VD máy chủ miễn phí 1 GB): giới hạn bộ nhớ đệm MongoDB để còn chỗ cho ứng dụng
    [ "$RAM_MB" -lt 2000 ] && echo "MONGO_CACHE_GB=0.25"
    if [ -n "$TEN_MIEN" ]; then
      echo "COMPOSE_FILE=docker-compose.yml:docker-compose.https.yml"
      echo "TEN_MIEN=$TEN_MIEN"
      echo "EMAIL_ACME=$EMAIL_ACME"
    fi
  } > .env
  chmod 600 .env
  echo "Đã tạo .env (chỉ root đọc được) với khóa bí mật và mật khẩu CSDL ngẫu nhiên."
fi
if [ -n "${TEN_MIEN:-}" ]; then
  IP_TEN_MIEN="$(getent ahostsv4 "$TEN_MIEN" 2>/dev/null | awk 'NR == 1 {print $1}')"
  if [ -z "$IP_TEN_MIEN" ]; then
    canh_bao "Tên miền $TEN_MIEN chưa phân giải được. HTTPS chỉ hoạt động khi bản ghi DNS A trỏ về IP công khai của máy chủ này."
  else
    echo "Tên miền $TEN_MIEN → $IP_TEN_MIEN. Địa chỉ này phải là IP CÔNG KHAI của máy chủ (xem trên trang quản trị của nhà cung cấp)."
    echo "(IP nội bộ của máy: $(hostname -I 2>/dev/null) – trên Google Cloud / Oracle luôn khác IP công khai, không sao.)"
  fi
fi

# ---------------------------------------------------------------------------------------------------------------------
buoc "4/6 Tường lửa"
if [ -n "${TEN_MIEN:-}" ]; then CONG_WEB="80/tcp 443/tcp 443/udp"; else CONG_WEB="8080/tcp"; fi
LUAT_IPTABLES=/etc/iptables/rules.v4
if [ "${BO_QUA_TUONG_LUA:-0}" = 1 ]; then
  echo "Bỏ qua ufw (BO_QUA_TUONG_LUA=1) – nhớ mở cổng ở tường lửa của nhà cung cấp."
elif [ -f "$LUAT_IPTABLES" ] && grep -qE '^-A INPUT .*-j REJECT' "$LUAT_IPTABLES"; then
  # Ảnh Ubuntu của một số nhà cung cấp (VD Oracle Cloud) có sẵn iptables chặn mọi cổng trừ SSH (netfilter-persistent).
  # Không cài ufw chồng lên; chỉ thêm luật mở cổng web TRƯỚC luật REJECT, cả lúc đang chạy lẫn trong tệp lưu cho lần khởi động sau.
  for c in $CONG_WEB; do
    cong="${c%/*}"; gt="${c#*/}"
    iptables -C INPUT -p "$gt" -m state --state NEW -m "$gt" --dport "$cong" -j ACCEPT 2>/dev/null \
      || iptables -I INPUT 1 -p "$gt" -m state --state NEW -m "$gt" --dport "$cong" -j ACCEPT
    dong="-A INPUT -p $gt -m state --state NEW -m $gt --dport $cong -j ACCEPT"
    if ! grep -qxF -- "$dong" "$LUAT_IPTABLES"; then
      awk -v d="$dong" '!xong && /^-A INPUT .*-j REJECT/ { print d; xong = 1 } { print }' "$LUAT_IPTABLES" > "$LUAT_IPTABLES.moi"
      cat "$LUAT_IPTABLES.moi" > "$LUAT_IPTABLES" && rm -f "$LUAT_IPTABLES.moi"
    fi
  done
  echo "Đã mở $CONG_WEB trong iptables có sẵn của máy (lưu ở $LUAT_IPTABLES)."
elif command -v ufw >/dev/null || apt-get install -y -qq ufw >/dev/null; then
  CONG_SSH="$( (sshd -T 2>/dev/null || true) | awk '/^port / {print $2; exit}')"
  ufw allow "${CONG_SSH:-22}/tcp" comment 'SSH' >/dev/null       # mở SSH TRƯỚC khi bật để không tự khóa mình ở ngoài
  for c in $CONG_WEB; do ufw allow "$c" comment 'Broadway' >/dev/null; done
  ufw --force enable >/dev/null && echo "Đã bật ufw: SSH ${CONG_SSH:-22} + cổng web." || canh_bao "Không bật được ufw."
else
  canh_bao "Không cài được ufw – hãy dùng tường lửa của nhà cung cấp."
fi
echo "Nhớ mở cùng các cổng đó ở tường lửa / Security Group của nhà cung cấp VPS (nếu có)."

# ---------------------------------------------------------------------------------------------------------------------
buoc "5/6 Build và khởi động hệ thống (lần đầu mất 3–10 phút)"
docker compose up -d --build
printf 'Chờ ứng dụng sẵn sàng'
for _ in $(seq 1 120); do
  ID_APP="$(docker compose ps -q app 2>/dev/null || true)"
  [ -n "$ID_APP" ] && [ "$(docker inspect -f '{{.State.Health.Status}}' "$ID_APP" 2>/dev/null)" = healthy ] && break
  printf '.'; sleep 5
done
echo
if [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null)" != healthy ]; then
  docker compose ps -a
  docker compose logs --tail 40 thiet-lap-csdl app
  dung_lai "Ứng dụng chưa sẵn sàng sau 10 phút – xem log ở trên."
fi
docker compose ps --format '  {{.Service}}: {{.Status}}'

# ---------------------------------------------------------------------------------------------------------------------
buoc "6/6 Tự động hóa: sao lưu, giám sát, cập nhật bảo mật"
cat > /etc/cron.d/broadway <<EOF
# Hệ thống Broadway ($THU_MUC) – tạo bởi trien-khai/cai-dat-may-chu.sh
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 2 * * * root $THU_MUC/trien-khai/sao-luu.sh >> /var/log/broadway-sao-luu.log 2>&1
*/2 * * * * root $THU_MUC/trien-khai/giam-sat.sh >> /var/log/broadway-giam-sat.log 2>&1
EOF
chmod 644 /etc/cron.d/broadway
cat > /etc/logrotate.d/broadway <<'EOF'
/var/log/broadway-*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
}
EOF
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
echo "Đã cài: sao lưu 02:30 hằng ngày (giữ 14 ngày), tự giám sát mỗi 2 phút, tự cập nhật bản vá bảo mật hệ điều hành."
echo "Chạy thử sao lưu lần đầu:"
"$THU_MUC/trien-khai/sao-luu.sh"

# ---------------------------------------------------------------------------------------------------------------------
DIA_CHI="$(grep -E '^CORS_ORIGIN=' .env | cut -d= -f2-)"
MAT_KHAU_TAM="$(docker compose logs app 2>/dev/null | grep -o 'Mật khẩu tạm: [^ ]*' | head -1 | sed 's/Mật khẩu tạm: //')"
buoc "HOÀN TẤT – hệ thống đang chạy 24/7 trên máy chủ này"
cat <<EOF
  Địa chỉ truy cập     : $DIA_CHI
  Đăng nhập Quản lý    : admin / ${MAT_KHAU_TAM:-"(đã tạo từ lần cài trước – dùng mật khẩu đã đổi)"}
                         (mật khẩu tạm chỉ hiện một lần; hệ thống bắt buộc đổi ở lần đăng nhập đầu)
  Sao lưu              : /var/backups/broadway  (02:30 hằng ngày, giữ 14 ngày)
  Nhật ký giám sát     : /var/log/broadway-giam-sat.log
  Cập nhật phiên bản   : sudo $THU_MUC/trien-khai/cap-nhat.sh
  Hướng dẫn vận hành   : tai-lieu/golive/VAN_HANH_24_7.md
EOF
