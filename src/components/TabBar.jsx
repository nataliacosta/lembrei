import { NavLink, useMatch } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { IconeDocumento, IconeLista, IconeMais, IconePasta } from "./Icones";
import { iniciais } from "./TopBar";

// Navegação inferior, visível só no celular (ver .tab-bar no CSS).
export default function TabBar() {
  const { user } = useAuth();
  const naFrente = useMatch("/frentes/:frenteId/*");
  const frenteId = naFrente?.params.frenteId;
  // Dentro de uma frente, o "+" já cria o item nela.
  const linkNovo = frenteId ? `/frentes/${frenteId}/novo` : "/novo";
  const classe = ({ isActive }) => (isActive ? "ativo" : "");

  return (
    <nav className="tab-bar" aria-label="Navegação principal">
      <NavLink to="/dashboard" className={classe}>
        <IconeLista size={22} />
        Hoje
      </NavLink>
      <NavLink to="/frentes" className={classe}>
        <IconePasta size={22} />
        Frentes
      </NavLink>
      <NavLink to={linkNovo} className="tab-novo" aria-label="Novo item">
        <IconeMais size={24} />
      </NavLink>
      <NavLink to="/contratos" className={classe}>
        <IconeDocumento size={22} />
        Contratos
      </NavLink>
      <NavLink to="/conta" className={classe}>
        <span
          className="avatar"
          style={{ width: 24, height: 24, fontSize: 10 }}
          aria-hidden="true"
        >
          {iniciais(user?.displayName || user?.email)}
        </span>
        Conta
      </NavLink>
    </nav>
  );
}
