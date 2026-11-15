/** Khối giới thiệu nền đỏ bên trái của MH02, MH03 */
export default function LoginPanel({ dong1, dong2, moTa }) {
  return (
    <section className="login-panel">
      <div style={{ position: 'relative' }}>
        <div className="login-kicker">BROADWAY</div>
        <h1 className="t-38" style={{ marginTop: 20, lineHeight: '50px', whiteSpace: 'nowrap' }}>{dong1}<br />{dong2}</h1>
        <p className="t-16" style={{ marginTop: 20, lineHeight: '26px', maxWidth: 420, color: 'rgba(255,255,255,.8)' }}>{moTa}</p>
      </div>
      <div className="login-copy">© 2026 Trung tâm Ngoại ngữ Quốc tế Broadway</div>
    </section>
  );
}
