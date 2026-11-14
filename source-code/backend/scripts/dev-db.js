/**
 * Chạy MongoDB replica set cục bộ (trong bộ nhớ) cho môi trường phát triển, không cần cài MongoDB.
 * Dùng: npm run db:dev  → rồi đặt MONGODB_URI theo địa chỉ in ra.
 */
const { MongoMemoryReplSet } = require('mongodb-memory-server');

(async () => {
  const port = Number(process.env.DEV_DB_PORT) || 27017;
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
    instanceOpts: [{ port }],
    binary: { version: '7.0.14' },
  });
  // eslint-disable-next-line no-console
  console.log(`MongoDB (replica set rs0) đang chạy: ${rs.getUri('BroadwayDB')}`);
  const dung = async () => { await rs.stop(); process.exit(0); };
  process.on('SIGINT', dung);
  process.on('SIGTERM', dung);
})();
