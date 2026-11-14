#!/bin/bash
# Khởi động MongoDB có XÁC THỰC: replica set rs0 + keyfile (xác thực nội bộ giữa các nút, đồng thời bật kiểm soát truy cập).
# Keyfile sinh ngẫu nhiên một lần, lưu trong volume mongo-config, chỉ tiến trình mongod đọc được.
set -euo pipefail
KHOA=/data/configdb/keyfile
if [ ! -s "$KHOA" ]; then
  head -c 756 /dev/urandom | base64 -w 0 > "$KHOA"
fi
chown mongodb:mongodb "$KHOA"
chmod 400 "$KHOA"
# Lần đầu (thư mục dữ liệu trống) image tự tạo tài khoản quản trị từ MONGO_INITDB_ROOT_USERNAME / _PASSWORD
# MONGO_CACHE_GB (tùy chọn): giới hạn bộ nhớ đệm WiredTiger cho máy ít RAM (VD 0.25 trên máy chủ miễn phí 1 GB)
exec docker-entrypoint.sh mongod --replSet rs0 --bind_ip_all --keyFile "$KHOA" ${MONGO_CACHE_GB:+--wiredTigerCacheSizeGB "$MONGO_CACHE_GB"}
