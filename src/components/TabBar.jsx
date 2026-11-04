import { useEffect } from "react";
import { NavLink, useLocation, useMatch } from "react-router-dom";
import { IconeDocumento, IconeFila, IconeLista, IconeMais, IconePasta } from "./Icones";

// Telas de formulário ocupam a tela toda no celular, com Cancelar/Salvar no
// próprio formulário: nelas a navegação inferior some (senão cobre o Salvar).
const ROTA_DE_FORMULARIO = /\/(novo|nova|editar|compartilhar)$|^\/demandas\/[^/]+\/[^/]+$/;

// Navegação inferior, visível só no celular (ver .tab-bar no CSS).
export default function TabBar() {
  const { pathname } = useLocation();
  const emFormulario = ROTA_DE_FORMULARIO.test(pathname);
  useEffect(() => {
    document.body.classList.toggle("sem-tab-bar", emFormulario);
    return () => document.body.classList.remove("sem-tab-bar");
  }, [emFormulario]);
  const naFrente = useMatch("/frentes/:frenteId/*");
  const frenteId = naFrente?.params.frenteId;
  // Dentro de uma frente, o "+" já cria o item nela.
  const naFila = useMatch("/demandas/*");
  // Na fila de demandas, o "+" cria uma demanda.
  const linkNovo = frenteId ? `/frentes/${frenteId}/novo` : naFila ? "/demandas/nova" : "/novo";
  const classe = ({ isActive }) => (isActive ? "ativo" : "");

  if (emFormulario) return null;

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
