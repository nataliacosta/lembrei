import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Link, matchPath, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useDados } from "./DadosContext";

// Guarda o caminho que a pessoa fez dentro do app, para o "voltar" levar à
// página onde ela estava de fato (e não a um nível acima na hierarquia).
const HistoricoContext = createContext(null);

export function HistoricoProvider({ children }) {
  const location = useLocation();
  const tipo = useNavigationType();
  const [pilha, setPilha] = useState(() => [{ key: location.key, pathname: location.pathname }]);

  useEffect(() => {
    const atual = { key: location.key, pathname: location.pathname };
    setPilha((p) => {
      if (p[p.length - 1]?.key === atual.key) return p;
      if (tipo === "REPLACE") return [...p.slice(0, -1), atual];
      if (tipo === "POP") {
        const i = p.findIndex((e) => e.key === atual.key);
        if (i >= 0) return p.slice(0, i + 1); // voltou
        return [...p, atual]; // avançou
      }
      return [...p, atual];
    });
  }, [location.key, location.pathname, tipo]);

  return <HistoricoContext.Provider value={pilha}>{children}</HistoricoContext.Provider>;
}

function rotuloDoCaminho(pathname, { mapaFrentes, mapaContratos, itensAbertos }) {
  const fixos = { "/dashboard": "O que fazer", "/frentes": "Frentes", "/contratos": "Contratos", "/buscar": "Busca", "/configuracoes": "Configurações", "/notificacoes": "Notificações" };
  if (fixos[pathname]) return fixos[pathname];
  let m = matchPath("/frentes/:frenteId/itens/:itemId", pathname);
  if (m) return itensAbertos.find((i) => i.id === m.params.itemId)?.titulo || "Item";
  m = matchPath("/frentes/:frenteId", pathname);
  if (m) return mapaFrentes[m.params.frenteId]?.nome || "Frente";
  m = matchPath("/contratos/:contratoId/aditivos/:aditivoId", pathname);
  if (m) return "Aditivo";
  m = matchPath("/contratos/:contratoId", pathname);
  if (m) return mapaContratos[m.params.contratoId]?.titulo || "Contrato";
  return "Voltar";
}

// voltar(): vai para a página anterior; se não houver (link aberto direto),
// vai para `destinoPadrao`. `rotulo` é o nome da página para onde vai.
export function useVoltar(destinoPadrao) {
  const pilha = useContext(HistoricoContext) || [];
  const navigate = useNavigate();
  const dados = useDados();
  const anterior = pilha.length > 1 ? pilha[pilha.length - 2] : null;
  const rotulo = rotuloDoCaminho(anterior ? anterior.pathname : destinoPadrao, dados);

  const voltar = useCallback(() => {
    if (anterior) navigate(-1);
    else navigate(destinoPadrao, { replace: true });
  }, [anterior, navigate, destinoPadrao]);

  return { voltar, rotulo, temAnterior: Boolean(anterior) };
}

export function BotaoVoltar({ destinoPadrao, style }) {
  const { voltar, rotulo } = useVoltar(destinoPadrao);
  return (
    <Link
      to={destinoPadrao}
      onClick={(e) => {
        e.preventDefault();
        voltar();
      }}
      style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", minHeight: 32, ...style }}
    >
      ← {rotulo}
    </Link>
  );
}
