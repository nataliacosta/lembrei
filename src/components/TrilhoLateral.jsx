import { NavLink } from "react-router-dom";
import { useDados } from "../contexts/DadosContext";
import { IconeDocumento, IconeFila, IconeLista, IconePasta } from "./Icones";

// Menu lateral estreito, só com ícones: aparece no tablet em pé (ver
// .trilho-lateral no CSS), no lugar do menu lateral completo.
export default function TrilhoLateral() {
  const { contagemPorFrente, minhaFila, minhasDemandas } = useDados();
  const totalAtrasados = Object.values(contagemPorFrente).reduce((soma, c) => soma + c.atrasados, 0);
  const aguardando = minhaFila ? minhasDemandas.filter((d) => !d.concluida && !(minhaFila.ordem || []).includes(d.id)).length : 0;
  const classe = ({ isActive }) => (isActive ? "ativo" : "");
  const itens = [
    { to: "/dashboard", rotulo: "O que fazer", Icone: IconeLista, badge: totalAtrasados },
    { to: "/demandas", rotulo: "Demandas", Icone: IconeFila, badge: aguardando },
    { to: "/frentes", rotulo: "Frentes", Icone: IconePasta },
    { to: "/contratos", rotulo: "Contratos", Icone: IconeDocumento },
  ];
  return (
    <nav className="trilho-lateral" aria-label="Menu">
      {itens.map(({ to, rotulo, Icone, badge }) => (
        <NavLink key={to} to={to} className={classe}>
          <Icone size={22} />
          {rotulo}
          {badge > 0 && <span className="trilho-badge">{badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
