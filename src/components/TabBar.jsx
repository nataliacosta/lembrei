import { useEffect } from "react";
import { NavLink, useLocation, useMatch } from "react-router-dom";
import { IconeDocumento, IconeFila, IconeGrafico, IconeLista, IconeMais, IconePasta } from "./Icones";
import { useDados } from "../contexts/DadosContext";

// Telas de formulário ocupam a tela toda no celular, com Cancelar/Salvar no
// próprio formulário: nelas a navegação inferior some (senão cobre o Salvar).
const ROTA_DE_FORMULARIO = /\/(novo|nova|editar|compartilhar)$|^\/demandas\/[^/]+\/[^/]+$/;

// Navegação inferior, visível só no celular (ver .tab-bar no CSS).
export default function TabBar() {
  const { pathname } = useLocation();
  const { funcionalidades } = useDados();
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
  const podeCriarItem = funcionalidades.frentes || funcionalidades.contratos;
  const linkNovo =
    frenteId && funcionalidades.frentes
      ? `/frentes/${frenteId}/novo`
      : (naFila || !podeCriarItem) && funcionalidades.demandas
        ? "/demandas/nova"
        : podeCriarItem
          ? "/novo"
          : null;
  const classe = ({ isActive }) => (isActive ? "ativo" : "");
  const emOrcamento = /^\/(controle-orcamentario|orcamentos)(\/|$)/.test(pathname);
  const qtdAbas = 1 + [funcionalidades.demandas, linkNovo, funcionalidades.frentes, funcionalidades.contratos, funcionalidades.orcamentos].filter(Boolean).length;

  if (emFormulario) return null;

  return (
    <nav className={`tab-bar ${qtdAbas >= 6 ? "seis-abas" : ""}`} aria-label="Navegação principal">
      <NavLink to="/dashboard" className={classe}>
        <IconeLista size={22} />
        Hoje
      </NavLink>
      {funcionalidades.demandas && (
      <NavLink to="/demandas" className={classe}>
        <IconeFila size={22} />
        Demandas
      </NavLink>
      )}
      {linkNovo && (
      <NavLink to={linkNovo} className="tab-novo" aria-label={linkNovo === "/demandas/nova" ? "Nova demanda" : "Novo item"}>
        <IconeMais size={24} />
      </NavLink>
      )}
      {funcionalidades.frentes && (
      <NavLink to="/frentes" className={classe}>
        <IconePasta size={22} />
        Frentes
      </NavLink>
      )}
      {funcionalidades.contratos && (
      <NavLink to="/contratos" className={classe}>
        <IconeDocumento size={22} />
        Contratos
      </NavLink>
      )}
      {funcionalidades.orcamentos && (
      <NavLink to="/controle-orcamentario" className={() => (emOrcamento ? "ativo" : "")}>
        <IconeGrafico size={22} />
        Orçamento
      </NavLink>
      )}
    </nav>
  );
}
