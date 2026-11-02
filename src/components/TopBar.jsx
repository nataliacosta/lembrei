import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Busca from "./Busca";
import { IconeBusca } from "./Icones";
import Avatar from "./Avatar";
import { LogoMarca, LogoNome } from "./Logo";

export default function TopBar() {
  const { user, signOut } = useAuth();

  return (
    <div className="top-bar" style={{ gap: 24, background: "var(--color-white)", borderBottomColor: "var(--color-border)" }}>
      <Link to="/dashboard" className="logo" style={{ color: "inherit", flex: "0 0 auto", minWidth: 200 }}>
        <LogoMarca tamanho={32} />
        <LogoNome tamanho={18} />
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
        <Avatar className="so-desktop" nome={user?.displayName || user?.email} url={user?.photoURL} tamanho={36} />
        <Link to="/conta" className="so-mobile" aria-label="Conta" style={{ width: 44, height: 44 }}>
          <span style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Avatar nome={user?.displayName || user?.email} url={user?.photoURL} tamanho={32} decorativo />
          </span>
        </Link>
        <button onClick={signOut} className="btn-ghost btn so-desktop" style={{ fontSize: 12, padding: "6px 12px" }}>
          Sair
        </button>
      </div>
    </div>
  );
}
