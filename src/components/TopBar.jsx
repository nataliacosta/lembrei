import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function iniciais(nome) {
  if (!nome) return "?";
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

export default function TopBar() {
  const { user, signOut } = useAuth();

  return (
    <div className="top-bar">
      <Link to="/dashboard" className="logo" style={{ color: "inherit" }}>
        <div className="logo-badge">L</div>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--color-dark)" }}>Lembrei!</span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 13 }} title={user?.displayName || user?.email}>
          {iniciais(user?.displayName || user?.email)}
        </div>
        <button onClick={signOut} className="btn-ghost btn" style={{ fontSize: 12, padding: "6px 12px" }}>
          Sair
        </button>
      </div>
    </div>
  );
}
