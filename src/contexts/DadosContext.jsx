import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { watchFrentes, watchItensAbertosDoUsuario } from "../lib/firestore";
import { buscarAditivosPendentesTI, watchContratos } from "../lib/contratos";
import { itemAtrasado } from "../lib/agenda";
import { contratoDaBase, ehBaseContrato } from "../lib/itens";
import { watchDemandas, watchFila, watchFilasCompartilhadas } from "../lib/filas";
import { limparNotificacoesAntigas, watchNotificacoes } from "../lib/notificacoes";
import { itemVisivel, mesclarFuncionalidades, notificacaoVisivel } from "../lib/funcionalidades";
import { watchContratosSoMedicao, watchFuncionalidades } from "../lib/push";
import { watchPlanejamentos } from "../lib/orcamentosDb";

// Dados que várias partes da tela usam ao mesmo tempo (painel, menu lateral,
// busca, barra do celular): carregados uma vez só e mantidos em tempo real.
const DadosContext = createContext(null);

export function DadosProvider({ children }) {
  const { user } = useAuth();
  const [frentes, setFrentes] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [itensAbertos, setItensAbertos] = useState([]);
  const [carregandoItens, setCarregandoItens] = useState(true);
  const [erroItens, setErroItens] = useState("");
  const [erroContratos, setErroContratos] = useState("");
  const [aditivosTI, setAditivosTI] = useState([]);
  const [minhaFila, setMinhaFila] = useState(null);
  const [minhasDemandas, setMinhasDemandas] = useState([]);
  const [filasCompartilhadas, setFilasCompartilhadas] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [planejamentos, setPlanejamentos] = useState([]);
  // Contratos em que a pessoa só faz medição (sem lembrete de vencimento/aditivo).
  const [contratosSoMedicao, setContratosSoMedicao] = useState([]);
  // Frentes, Contratos e Demandas podem ser desligados por cada pessoa (Configurações).
  const [funcionalidades, setFuncionalidades] = useState(() => mesclarFuncionalidades(null));

  useEffect(() => {
    if (!user) return;
    return watchFuncionalidades(user.uid, (f) => setFuncionalidades(mesclarFuncionalidades(f)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    limparNotificacoesAntigas(user.uid).catch((e) => console.error("Erro ao limpar notificações antigas:", e));
    return watchNotificacoes(user.uid, setNotificacoes);
  }, [user]);

  // Minha fila de demandas (para o menu e o quadro do "O que fazer") e as
  // filas que outras pessoas compartilharam comigo.
  useEffect(() => {
    if (!user) return;
    return watchFila(user.uid, setMinhaFila);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchDemandas(user.uid, setMinhasDemandas);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchFilasCompartilhadas(user.uid, setFilasCompartilhadas);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchFrentes(user.uid, setFrentes);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchPlanejamentos(user.uid, setPlanejamentos);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchContratosSoMedicao(user.uid, setContratosSoMedicao);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchContratos(user.uid, setContratos, (e) => setErroContratos(e.message || String(e)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return watchItensAbertosDoUsuario(
      user.uid,
      (itens) => {
        setItensAbertos(itens);
        setErroItens("");
        setCarregandoItens(false);
      },
      (e) => {
        setErroItens(e.message || String(e));
        setCarregandoItens(false);
      }
    );
  }, [user]);

  // Aditivos pendentes em TI: uma consulta pontual, refeita quando a lista de
  // contratos muda (um aditivo criado ou finalizado altera o contrato).
  const chaveContratos = contratos.map((c) => `${c.id}:${c.status}:${c.aditivoAtivoPendenteEm || ""}`).join("|");
  useEffect(() => {
    if (!user) return;
    buscarAditivosPendentesTI(user.uid)
      .then(setAditivosTI)
      .catch((e) => console.error("Erro ao buscar aditivos pendentes em TI:", e));
  }, [user, chaveContratos]);

  const valor = useMemo(() => {
    // O que estiver desligado chega vazio para as telas (nada é apagado).
    const f = funcionalidades;
    const frentesV = f.frentes ? frentes : [];
    const contratosV = f.contratos ? contratos : [];
    const itensV = itensAbertos.filter((i) => itemVisivel(i, f));
    const notificacoesV = notificacoes.filter((n) => notificacaoVisivel(n, f, contratosSoMedicao));
    const mapaFrentes = Object.fromEntries(frentesV.map((x) => [x.id, x]));
    const mapaContratos = Object.fromEntries(contratosV.map((c) => [c.id, c]));
    const contagemPorFrente = {};
    for (const item of itensV) {
      const c = (contagemPorFrente[item.frenteId] ||= { abertos: 0, atrasados: 0 });
      c.abertos++;
      if (itemAtrasado(item)) c.atrasados++;
    }
    return {
      funcionalidades: f,
      frentes: frentesV,
      contratos: contratosV,
      itensAbertos: itensV,
      carregandoItens,
      erroItens,
      erroContratos,
      aditivosTI: f.contratos ? aditivosTI.filter((a) => !contratosSoMedicao.includes(a.contratoId)) : [],
      contratosSoMedicao,
      ehSoMedicao: (contratoId) => contratosSoMedicao.includes(contratoId),
      mapaFrentes,
      mapaContratos,
      contagemPorFrente,
      // Papel em uma "base" de item: a frente ou o contrato (ver lib/itens.js).
      papelNaFrente: (base) =>
        ehBaseContrato(base) ? mapaContratos[contratoDaBase(base)]?.membros?.[user?.uid] : mapaFrentes[base]?.membros?.[user?.uid],
      // Frente do item, ou um "rótulo" com o contrato para itens de contrato.
      origemDe: (base) =>
        ehBaseContrato(base)
          ? mapaContratos[contratoDaBase(base)] && { id: base, nome: `Contrato · ${mapaContratos[contratoDaBase(base)].titulo}` }
          : mapaFrentes[base],
      minhaFila: f.demandas ? minhaFila : null,
      minhasDemandas: f.demandas ? minhasDemandas : [],
      filasCompartilhadas: f.demandas ? filasCompartilhadas : [],
      planejamentos: f.orcamentos ? planejamentos : [],
      notificacoes: notificacoesV,
      naoLidas: notificacoesV.filter((n) => !n.lida).length,
    };
  }, [frentes, contratos, itensAbertos, carregandoItens, erroItens, erroContratos, aditivosTI, user, minhaFila, minhasDemandas, filasCompartilhadas, notificacoes, funcionalidades, planejamentos, contratosSoMedicao]);

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>;
}

export function useDados() {
  return useContext(DadosContext);
}
