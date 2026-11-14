/** Bọc controller async để lỗi được chuyển tới errorHandler. */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
