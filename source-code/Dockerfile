# syntax=docker/dockerfile:1
# Hệ thống quản lý lịch dạy Broadway – một image gồm API (Node.js/Express) và giao diện React đã build.
# Mạng nội bộ có proxy kiểm tra TLS (tùy chọn): docker build --secret id=npm_ca,src=<chứng chỉ CA> ...

FROM node:22-alpine AS giao-dien
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS thu-vien
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    UPLOAD_DIR=/data/uploads \
    FRONTEND_DIST=/app/frontend/dist \
    TZ=Asia/Ho_Chi_Minh
WORKDIR /app/backend
COPY --from=thu-vien /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=giao-dien /app/frontend/dist /app/frontend/dist
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 8080
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/api/suc-khoe >/dev/null || exit 1
# Mỗi lần khởi động: bổ sung dữ liệu danh mục gốc còn thiếu (ca học, phòng học, môn học, tài khoản Admin
# khởi tạo nếu CSDL chưa có Quản lý). Chỉ THÊM, không bao giờ xóa / ghi đè dữ liệu có sẵn. Sau đó mở máy chủ.
CMD ["sh", "-c", "node src/seed/init-master-data.js && exec node src/server.js"]
