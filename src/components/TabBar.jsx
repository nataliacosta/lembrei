import { NavLink, useMatch } from "react-router-dom";
import { IconeDocumento, IconeFila, IconeLista, IconeMais, IconePasta } from "./Icones";

// Navegação inferior, visível só no celular (ver .tab-bar no CSS).
export default function TabBar() {
  const naFrente = useMatch("/frentes/:frenteId/*");
  const frenteId = naFrente?.params.frenteId;
  // Dentro de uma frente, o "+" já cria o item nela.
  const naFila = useMatch("/demandas/*");
  // Na fila de demandas, o "+" cria uma demanda.
  const linkNovo = frenteId ? `/frentes/${frenteId}/novo` : naFila ? "/demandas/nova" : "/novo";
  const classe = ({ isActive }) => (isActive ? "ativo" : "");

  return (
    <nav className="tab-bar" aria-label="Navegação principal">
      <NavLink to="/dashboard" className={classe}>
        <IconeLista size={22} />
        Hoje
      </NavLink>
      <NavLink to="/demandas" className={classe}>
        <IconeFila size={22} />
        Demandas
      </NavLink>
      <NavLink to={linkNovo} className="tab-novo" aria-label={naFila ? "Nova demanda" : "Novo item"}>
        <IconeMais size={24} />
      </NavLink>
      <NavLink to="/frentes" className={classe}>
        <IconePasta size={22} />
        Frentes
      </NavLink>
      <NavLink to="/contratos" className={classe}>
        <IconeDocumento size={22} />
        Contratos
      </NavLink>
    </nav>
  );
}
