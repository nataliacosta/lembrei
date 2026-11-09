import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useMatch } from "react-router-dom";
import { IconeDocumento, IconeFila, IconeGrafico, IconeLista, IconeMais, IconePasta } from "./Icones";
import { useDados } from "../contexts/DadosContext";
import { dividirBarra, SERVICOS } from "../lib/funcionalidades";

// Telas de formulário ocupam a tela toda no celular, com Cancelar/Salvar no
// próprio formulário: nelas a navegação inferior some (senão cobre o Salvar).
const ROTA_DE_FORMULARIO = /\/(novo|nova|editar|compartilhar)$|^\/demandas\/[^/]+\/[^/]+$/;

// Navegação inferior, visível só no celular (ver .tab-bar no CSS).
export default function TabBar() {
  const { pathname } = useLocation();
  const { funcionalidades, servicos } = useDados();
  const [maisAberto, setMaisAberto] = useState(false);
  useEffect(() => setMaisAberto(false), [pathname]);
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

  if (emFormulario) return null;

  const dados = {
    hoje: { to: "/dashboard", Icone: IconeLista, ativo: (p) => p.startsWith("/dashboard") },
    demandas: { to: "/demandas", Icone: IconeFila, ativo: (p) => p.startsWith("/demandas") },
    frentes: { to: "/frentes", Icone: IconePasta, ativo: (p) => p.startsWith("/frentes") },
    contratos: { to: "/contratos", Icone: IconeDocumento, ativo: (p) => p.startsWith("/contratos") },
    orcamentos: { to: "/controle-orcamentario", Icone: IconeGrafico, ativo: () => emOrcamento },
  };
  const info = (k) => ({ ...SERVICOS.find((s) => s.chave === k), ...dados[k] });
  // Com 5 ou mais serviços, os 3 primeiros da ordem ficam na barra e o resto vai para "Mais".
  const { barra, mais } = dividirBarra(servicos);
  const maisAtivo = mais.some((k) => dados[k].ativo(pathname));
  const abas = barra.map((k) => {
    const s = info(k);
    return (
      <NavLink key={k} to={s.to} className={() => (s.ativo(pathname) ? "ativo" : "")}>
        <s.Icone size={22} />
        {s.curto}
      </NavLink>
    );
  });
  if (mais.length) {
    abas.push(
      <button key="mais" type="button" className={`tab-mais ${maisAtivo || maisAberto ? "ativo" : ""}`} onClick={() => setMaisAberto(!maisAberto)} aria-expanded={maisAberto} aria-haspopup="dialog">
        <IconeMaisServicos size={22} />
        Mais
      </button>
    );
  }

  const painelMais = maisAberto && (
    <>
      <div className="mais-fundo" onClick={() => setMaisAberto(false)} aria-hidden="true" />
      <div className="mais-painel" role="dialog" aria-label="Mais serviços">
        <div className="mais-alca" aria-hidden="true" />
        <div className="mais-topo">
          <b>Mais serviços</b>
          <button type="button" className="link-botao" onClick={() => setMaisAberto(false)}>
            Fechar
          </button>
        </div>
        {mais.map((k) => {
          const s = info(k);
          return (
            <Link key={k} to={s.to} className={`mais-item ${s.ativo(pathname) ? "ativo" : ""}`} onClick={() => setMaisAberto(false)}>
              <s.Icone size={22} />
              <span style={{ flex: 1 }}>
                {s.titulo}
                <span className="mais-detalhe">{s.detalhe}</span>
              </span>
              <span aria-hidden="true" style={{ color: "#9aa5a4" }}>
                ›
              </span>
            </Link>
          );
        })}
        <div className="mais-rodape">
          <Link to="/configuracoes" onClick={() => setMaisAberto(false)}>
            Mudar a ordem do menu ›
          </Link>
          <div className="mais-detalhe">Os 3 primeiros da sua ordem ficam na barra; os outros, aqui.</div>
        </div>
      </div>
    </>
  );

  // O "+" fica sempre no centro: metade das abas de cada lado (com número
  // ímpar, a esquerda fica com uma a mais e as abas dela, um pouco mais estreitas).
  if (!linkNovo) {
    return (
      <>
        {painelMais}
        <nav className="tab-bar" aria-label="Navegação principal">
          {abas}
        </nav>
      </>
    );
  }
  const meio = Math.ceil(abas.length / 2);
  return (
    <>
      {painelMais}
      <nav className={`tab-bar com-mais ${abas.length >= 5 ? "seis-abas" : ""}`} aria-label="Navegação principal">
        <div className="tab-lado">{abas.slice(0, meio)}</div>
        <NavLink to={linkNovo} className="tab-novo" aria-label={linkNovo === "/demandas/nova" ? "Nova demanda" : "Novo item"}>
          <IconeMais size={24} />
        </NavLink>
        <div className="tab-lado">{abas.slice(meio)}</div>
      </nav>
    </>
  );
}

function IconeMaisServicos({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
