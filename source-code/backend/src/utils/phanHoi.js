/** Chuẩn phản hồi thành công: { success: true, message?, data } */
function traVe(res, data, message, status = 200) {
  const body = { success: true };
  if (message) body.message = message;
  body.data = data === undefined ? null : data;
  return res.status(status).json(body);
}

module.exports = { traVe };
