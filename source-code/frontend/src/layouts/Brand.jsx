export default function Brand({ sub = 'Trung tâm Ngoại ngữ Quốc tế' }) {
  return (
    <div className="brand">
      <img src="/logo-broadway.png" alt="Logo Broadway" />
      <div>
        <div className="brand-name">Broadway</div>
        <div className="brand-sub">{sub}</div>
      </div>
    </div>
  );
}
