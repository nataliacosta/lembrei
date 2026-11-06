import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDados } from "../contexts/DadosContext";
import Busca from "./Busca";
import { IconeBusca } from "./Icones";
import Avatar from "./Avatar";
import Sino from "./Sino";
import { LogoMarca, LogoNome } from "./Logo";

export default function TopBar() {
  const { user, signOut } = useAuth();
  const { funcionalidades } = useDados();

  return (
    <div className="top-bar" style={{ gap: 24, background: "var(--color-white)", borderBottomColor: "var(--color-border)" }}>
      <Link to="/dashboard" className="logo top-bar-logo" style={{ color: "inherit", flex: "0 0 auto", minWidth: 200 }}>
        <LogoMarca tamanho={32} />
        <LogoNome tamanho={18} />
      </Link>
      <Busca />
      <div className="top-bar-acoes" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
        {(funcionalidades.frentes || funcionalidades.contratos) && (
        <Link to="/novo" className="btn btn-primary so-desktop">
          + Novo item
        </Link>
        )}
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
        <Sino />
        <Link to="/configuracoes" className="so-desktop" aria-label="Configurações" title="Configurações" style={{ display: "flex" }}>
          <Avatar nome={user?.displayName || user?.email} url={user?.photoURL} tamanho={36} decorativo />
        </Link>
        <Link to="/configuracoes" className="so-mobile" aria-label="Configurações" style={{ width: 44, height: 44 }}>
          <span style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Avatar nome={user?.displayName || user?.email} url={user?.photoURL} tamanho={32} decorativo />
          </span>
        </Link>
        <button onClick={signOut} className="btn-ghost btn so-desktop esconder-tablet" style={{ fontSize: 12, padding: "6px 12px" }}>
          Sair
        </button>
      </div>
    </div>
  );
}
