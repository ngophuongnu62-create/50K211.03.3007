/** Cấu hình Mongoose dùng chung: collection, validator và chỉ mục do ketNoiCSDL() tạo có kiểm soát. */
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

module.exports = mongoose;
