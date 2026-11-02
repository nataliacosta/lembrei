import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Busca from "./Busca";
import { IconeBusca } from "./Icones";

export function iniciais(nome) {
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
    <div className="top-bar" style={{ gap: 24, background: "var(--color-white)", borderBottomColor: "var(--color-border)" }}>
      <Link to="/dashboard" className="logo" style={{ color: "inherit", flex: "0 0 auto", minWidth: 200 }}>
        <div className="logo-badge">L</div>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--color-dark)" }}>Lembrei!</span>
      </Link>
      <Busca />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        <Link to="/novo" className="btn btn-primary so-desktop">
          + Novo item
        </Link>
        <Link
          to="/buscar"
          className="so-mobile"
          aria-label="Buscar"
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", color: "var(--color-dark)" }}
        >
          <span style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <IconeBusca size={22} />
          </span>
        </Link>
        <div
          className="avatar so-desktop"
          style={{ width: 36, height: 36, fontSize: 13 }}
          title={user?.displayName || user?.email}
        >
          {iniciais(user?.displayName || user?.email)}
        </div>
        <button onClick={signOut} className="btn-ghost btn so-desktop" style={{ fontSize: 12, padding: "6px 12px" }}>
          Sair
        </button>
      </div>
    </div>
  );
}
